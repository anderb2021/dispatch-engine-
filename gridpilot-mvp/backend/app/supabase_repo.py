from __future__ import annotations

from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
from typing import Any

from supabase import Client, create_client

from . import config
from .security import decrypt, encrypt
from .tesla import TeslaOAuthError


class SupabaseRepo:
    def __init__(self):
        if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
            raise TeslaOAuthError(
                "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend .env"
            )
        self.client: Client = create_client(
            config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY
        )
        publishable_or_service = (
            config.SUPABASE_PUBLISHABLE_KEY or config.SUPABASE_SERVICE_ROLE_KEY
        )
        self.auth_client: Client = create_client(
            config.SUPABASE_URL, publishable_or_service
        )

    def upsert_tesla_connection(self, user_id: str, token_payload: dict[str, Any]) -> dict[str, Any]:
        expires_in = int(token_payload.get("expires_in", 0) or 0)
        token_expires_at = None
        if expires_in > 0:
            token_expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

        payload = {
            "user_id": user_id,
            "access_token_encrypted": encrypt(token_payload.get("access_token", "")),
            "refresh_token_encrypted": encrypt(token_payload.get("refresh_token", "")),
            "token_expires_at": token_expires_at,
            "scopes": token_payload.get("scope", "").split(),
            "status": "connected",
            "last_sync_at": datetime.now(timezone.utc).isoformat(),
            "last_error": None,
        }

        existing = (
            self.client.table("tesla_connections")
            .select("id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if existing.data:
            response = (
                self.client.table("tesla_connections")
                .update(payload)
                .eq("id", existing.data[0]["id"])
                .execute()
            )
        else:
            response = self.client.table("tesla_connections").insert(payload).execute()

        if not response.data:
            raise TeslaOAuthError("Failed to upsert tesla_connections row.")
        return response.data[0]

    def get_tesla_connection(self, user_id: str) -> dict[str, Any]:
        response = (
            self.client.table("tesla_connections")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            raise TeslaOAuthError("No Tesla connection found for this user.")
        return response.data[0]

    def get_access_token(self, user_id: str) -> str:
        row = self.get_tesla_connection(user_id)
        encrypted = row.get("access_token_encrypted")
        if not encrypted:
            raise TeslaOAuthError("Missing access token for this user.")
        return decrypt(encrypted)

    def get_refresh_token(self, user_id: str) -> str:
        row = self.get_tesla_connection(user_id)
        encrypted = row.get("refresh_token_encrypted")
        if not encrypted:
            raise TeslaOAuthError("Missing refresh token for this user.")
        return decrypt(encrypted)

    def upsert_vehicles(
        self, user_id: str, tesla_connection_id: str | None, vehicles_payload: dict[str, Any]
    ) -> list[dict[str, Any]]:
        raw_vehicles = vehicles_payload.get("response") or vehicles_payload.get("vehicles") or []
        records = []
        for vehicle in raw_vehicles:
            tesla_vehicle_id = str(vehicle.get("id_s") or vehicle.get("id") or "")
            if not tesla_vehicle_id:
                continue
            vin = vehicle.get("vin") or ""
            charge_state = vehicle.get("charge_state") or {}
            vehicle_config = vehicle.get("vehicle_config") or {}
            records.append(
                {
                    "user_id": user_id,
                    "tesla_connection_id": tesla_connection_id,
                    "tesla_vehicle_id": tesla_vehicle_id,
                    "vin_last_6": vin[-6:] if vin else None,
                    "display_name": vehicle.get("display_name"),
                    "model": vehicle_config.get("car_type"),
                    "state": vehicle.get("state"),
                    "battery_capacity_kwh": None,
                    "controllable_kw": charge_state.get("charger_power"),
                    "is_active": True,
                }
            )

        if not records:
            return []

        response = (
            self.client.table("vehicles")
            .upsert(records, on_conflict="user_id,tesla_vehicle_id")
            .execute()
        )
        return response.data or []

    def list_active_vehicles(self, user_id: str) -> list[dict[str, Any]]:
        response = (
            self.client.table("vehicles")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        return response.data or []

    def insert_vehicle_snapshot(
        self, user_id: str, vehicle_row: dict[str, Any], telemetry_payload: dict[str, Any]
    ) -> dict[str, Any]:
        response_data = telemetry_payload.get("response") or telemetry_payload
        charge_state = response_data.get("charge_state") or {}
        drive_state = response_data.get("drive_state") or {}

        snapshot = {
            "vehicle_id": vehicle_row["id"],
            "user_id": user_id,
            "battery_level": charge_state.get("battery_level"),
            "charging_state": charge_state.get("charging_state"),
            "plugged_in": bool(charge_state.get("charge_port_door_open")),
            "charge_limit_soc": charge_state.get("charge_limit_soc"),
            "charger_power_kw": charge_state.get("charger_power"),
            "charger_voltage": charge_state.get("charger_voltage"),
            "charger_current": charge_state.get("charger_actual_current"),
            "time_to_full_charge_hours": charge_state.get("time_to_full_charge"),
            "latitude": drive_state.get("latitude"),
            "longitude": drive_state.get("longitude"),
            "odometer": vehicle_state_to_odometer(response_data),
            "raw_payload": response_data,
        }

        response = self.client.table("vehicle_snapshots").insert(snapshot).execute()
        if not response.data:
            raise TeslaOAuthError("Failed to insert vehicle snapshot.")
        return response.data[0]

    def get_dashboard_summary(self, user_id: str) -> dict[str, Any]:
        response = (
            self.client.table("user_dashboard_summary")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            raise TeslaOAuthError("No dashboard summary found for this user.")
        return response.data[0]

    def sign_in_from_tesla_identity(self, identity: dict[str, Any]) -> dict[str, Any]:
        tesla_sub = identity.get("sub")
        if not tesla_sub:
            raise TeslaOAuthError("Tesla identity is missing sub.")
        tesla_email = identity.get("email")
        display_name = identity.get("name")
        password = _deterministic_password(tesla_sub)

        candidates = []
        if tesla_email:
            candidates.append(tesla_email.lower())
        candidates.append(f"tesla_{tesla_sub[:24]}@tesla.gridpilot.local")

        for email in candidates:
            session = self._sign_in_or_create(email=email, password=password, user_metadata={
                "login_source": "tesla",
                "tesla_sub": tesla_sub,
                "tesla_email": tesla_email,
            })
            if session:
                user = getattr(session, "user", None)
                supabase_user_id = getattr(user, "id", None)
                if not supabase_user_id:
                    raise TeslaOAuthError("Supabase session missing user id.")

                # Ensure profile has current email/name after Tesla login.
                self.client.table("profiles").upsert(
                    {
                        "id": supabase_user_id,
                        "email": tesla_email or email,
                        "full_name": display_name,
                    },
                    on_conflict="id",
                ).execute()

                return {
                    "user_id": supabase_user_id,
                    "email": tesla_email or email,
                    "access_token": getattr(session, "access_token", None),
                    "refresh_token": getattr(session, "refresh_token", None),
                }

        raise TeslaOAuthError("Unable to create Supabase session from Tesla login.")

    def _sign_in_or_create(
        self, email: str, password: str, user_metadata: dict[str, Any]
    ):
        try:
            sign_in_response = self.auth_client.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
            session = getattr(sign_in_response, "session", None)
            if session:
                return session
        except Exception:
            pass

        try:
            self.client.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": user_metadata,
                }
            )
        except Exception:
            # User may already exist with another auth method/password.
            return None

        try:
            sign_in_response = self.auth_client.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
            return getattr(sign_in_response, "session", None)
        except Exception:
            return None


def vehicle_state_to_odometer(response_data: dict[str, Any]) -> float | None:
    vehicle_state = response_data.get("vehicle_state") or {}
    odometer = vehicle_state.get("odometer")
    return float(odometer) if odometer is not None else None


def _deterministic_password(seed: str) -> str:
    message = seed.encode("utf-8")
    key = (config.SECRET_KEY or "gridpilot-tesla-login").encode("utf-8")
    digest = hmac.new(key, message, hashlib.sha256).digest()
    token = base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")
    return f"Tsla!{token[:40]}"

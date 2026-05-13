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

    def upsert_participant_preferences(
        self, user_id: str, allow_charging_management: bool
    ) -> dict[str, Any]:
        payload = {
            "user_id": user_id,
            "auto_flex_enabled": bool(allow_charging_management),
            "manual_override_enabled": True,
        }
        response = (
            self.client.table("participant_preferences")
            .upsert(payload, on_conflict="user_id")
            .execute()
        )
        if not response.data:
            raise TeslaOAuthError("Failed to save participant preferences.")
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

    def validate_admin_access_token(self, access_token: str) -> str:
        if not access_token:
            raise TeslaOAuthError("Missing access token.")

        try:
            user_response = self.auth_client.auth.get_user(access_token)
        except Exception as exc:
            raise TeslaOAuthError("Invalid Supabase access token.") from exc

        user = getattr(user_response, "user", None)
        user_id = getattr(user, "id", None)
        if not user_id:
            raise TeslaOAuthError("Supabase token did not contain a user id.")

        profile_response = (
            self.client.table("profiles")
            .select("id,role")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        profile = (profile_response.data or [{}])[0]
        if profile.get("role") != "admin":
            raise TeslaOAuthError("Admin role required.")

        return str(user_id)

    def get_admin_telemetry(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)

        profiles = self._safe_select(
            "profiles",
            "id,full_name,email,created_at",
            order_column="created_at",
            descending=True,
            limit=5000,
        )
        vehicles = self._safe_select(
            "vehicles",
            "id,user_id,display_name,model,state,controllable_kw,is_active",
            eq_filters={"is_active": True},
            limit=5000,
        )
        snapshots = self._safe_select(
            "vehicle_snapshots",
            "id,user_id,battery_level,charging_state,plugged_in,charger_power_kw,captured_at",
            order_column="captured_at",
            descending=True,
            limit=5000,
        )
        rewards = self._safe_select(
            "reward_ledger",
            "id,user_id,amount,created_at",
            order_column="created_at",
            descending=True,
            limit=5000,
        )
        dispatch_events = self._safe_select(
            "dispatch_events",
            "id,event_type,status,verified_kw,verified_kwh_shifted,reward_amount,created_at",
            order_column="created_at",
            descending=True,
            limit=100,
        )
        summary_rows = self._safe_select(
            "user_dashboard_summary",
            "user_id,dispatch_reliability,flexibility_score",
            limit=5000,
        )

        active_users = len({row.get("id") for row in profiles if row.get("id")})
        signup_total = active_users
        signup_last_7_days = sum(
            1 for row in profiles if _is_after(row.get("created_at"), week_start)
        )
        connected_vehicles = len(vehicles)
        controllable_kw = sum(_to_float(row.get("controllable_kw")) for row in vehicles)
        flexible_kwh = sum(
            _to_float(row.get("charger_power_kw")) for row in snapshots if row.get("plugged_in")
        )

        dispatch_reliability_values = [
            _to_float(row.get("dispatch_reliability"))
            for row in summary_rows
            if row.get("dispatch_reliability") is not None
        ]
        dispatch_reliability = _avg(dispatch_reliability_values)

        flex_score_values = [
            _to_float(row.get("flexibility_score"))
            for row in summary_rows
            if row.get("flexibility_score") is not None
        ]
        avg_flex_score = _avg(flex_score_values)

        monthly_reward_liability = sum(
            _to_float(row.get("amount"))
            for row in rewards
            if _is_after(row.get("created_at"), month_start)
        )
        shifted_kwh_month = sum(
            _to_float(row.get("verified_kwh_shifted"))
            for row in dispatch_events
            if _is_after(row.get("created_at"), month_start)
        )

        latest_snapshot_by_user: dict[str, dict[str, Any]] = {}
        for snapshot in snapshots:
            user_id = snapshot.get("user_id")
            if user_id and user_id not in latest_snapshot_by_user:
                latest_snapshot_by_user[user_id] = snapshot

        vehicle_by_user: dict[str, dict[str, Any]] = {}
        for vehicle in vehicles:
            user_id = vehicle.get("user_id")
            if user_id and user_id not in vehicle_by_user:
                vehicle_by_user[user_id] = vehicle

        summary_by_user = {
            row.get("user_id"): row
            for row in summary_rows
            if row.get("user_id")
        }

        reward_by_user_this_month: dict[str, float] = {}
        for row in rewards:
            user_id = row.get("user_id")
            if not user_id or not _is_after(row.get("created_at"), month_start):
                continue
            reward_by_user_this_month[user_id] = reward_by_user_this_month.get(user_id, 0.0) + _to_float(
                row.get("amount")
            )

        users: list[dict[str, Any]] = []
        for profile in profiles[:200]:
            user_id = profile.get("id")
            if not user_id:
                continue
            vehicle = vehicle_by_user.get(user_id, {})
            snapshot = latest_snapshot_by_user.get(user_id, {})
            summary = summary_by_user.get(user_id, {})

            users.append(
                {
                    "id": _admin_user_id(user_id),
                    "name": _display_name(
                        profile.get("full_name"),
                        profile.get("email"),
                    ),
                    "vehicle": vehicle.get("display_name")
                    or vehicle.get("model")
                    or "No vehicle",
                    "battery": round(_to_float(snapshot.get("battery_level"))),
                    "status": snapshot.get("charging_state")
                    or vehicle.get("state")
                    or "Unknown",
                    "flexScore": round(_to_float(summary.get("flexibility_score"))),
                    "reliability": round(_to_float(summary.get("dispatch_reliability"))),
                    "rewards": round(reward_by_user_this_month.get(user_id, 0.0), 2),
                    "controllableKw": round(_to_float(vehicle.get("controllable_kw")), 1),
                }
            )

        events = [
            {
                "id": str(event.get("id") or f"D-{idx + 1}"),
                "time": event.get("created_at") or "Recent",
                "type": event.get("event_type") or "Dispatch event",
                "users": active_users,
                "kw": round(_to_float(event.get("verified_kw")), 1),
                "kwh": round(_to_float(event.get("verified_kwh_shifted")), 1),
                "rewards": round(_to_float(event.get("reward_amount")), 2),
                "status": event.get("status") or "Completed",
            }
            for idx, event in enumerate(dispatch_events[:20])
        ]

        return {
            "network": {
                "activeUsers": active_users,
                "signupsTotal": signup_total,
                "signupsLast7Days": signup_last_7_days,
                "connectedVehicles": connected_vehicles,
                "controllableKw": round(controllable_kw, 1),
                "flexibleKwh": round(flexible_kwh, 1),
                "dispatchReliability": round(dispatch_reliability),
                "monthlyRewardLiability": round(monthly_reward_liability, 2),
                "shiftedKwhMonth": round(shifted_kwh_month, 1),
                "avgFlexScore": round(avg_flex_score),
            },
            "users": users,
            "events": events,
            "generatedAt": now.isoformat(),
        }

    def sign_in_from_tesla_identity(self, identity: dict[str, Any]) -> dict[str, Any]:
        tesla_sub = identity.get("sub")
        if not tesla_sub:
            raise TeslaOAuthError("Tesla identity is missing sub.")
        tesla_email = identity.get("email")
        display_name = identity.get("name") or "Tesla Driver"
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

    def _safe_select(
        self,
        table_name: str,
        columns: str,
        *,
        eq_filters: dict[str, Any] | None = None,
        order_column: str | None = None,
        descending: bool = False,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        try:
            query = self.client.table(table_name).select(columns)
            if eq_filters:
                for key, value in eq_filters.items():
                    query = query.eq(key, value)
            if order_column:
                query = query.order(order_column, desc=descending)
            if limit:
                query = query.limit(limit)
            response = query.execute()
            return response.data or []
        except Exception:
            return []


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


def _to_float(value: Any) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _avg(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _parse_datetime(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _is_after(value: Any, threshold: datetime) -> bool:
    parsed = _parse_datetime(value)
    return bool(parsed and parsed >= threshold)


def _display_name(full_name: Any, email: Any) -> str:
    if isinstance(full_name, str) and full_name.strip():
        return full_name.strip()
    if isinstance(email, str) and "@" in email:
        local = email.split("@", 1)[0].strip()
        if local:
            return local.replace(".", " ").replace("_", " ").strip().title()
    return "GridPilot User"


def _admin_user_id(user_id: str) -> str:
    token = user_id.replace("-", "").upper()
    return f"U-{token[:8]}" if token else "U-UNKNOWN"

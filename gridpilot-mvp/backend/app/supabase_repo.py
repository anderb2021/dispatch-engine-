from __future__ import annotations

from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
from typing import Any

from supabase import Client, create_client

from . import config
from . import marketplace_qualification as marketplace_lib
from . import telemetry as telemetry_lib
from .security import decrypt, encrypt
from .tesla import TeslaOAuthError, refresh_access_token


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

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        granted_scopes, requested_scopes = marketplace_lib.scopes_from_token_payload(
            token_payload
        )
        has_location_scope = marketplace_lib.has_vehicle_location_scope(granted_scopes)

        payload: dict[str, Any] = {
            "user_id": user_id,
            "access_token_encrypted": encrypt(token_payload.get("access_token", "")),
            "refresh_token_encrypted": encrypt(token_payload.get("refresh_token", "")),
            "token_expires_at": token_expires_at,
            "scopes": granted_scopes,
            "granted_scopes": granted_scopes,
            "requested_scopes": requested_scopes,
            "vehicle_location_scope_granted": has_location_scope,
            "last_scope_check_at": now_iso,
            "status": "connected",
            "last_sync_at": now_iso,
            "last_error": None,
        }
        if has_location_scope:
            payload["location_scope_granted_at"] = now_iso
        payload["location_scope_requested_at"] = now_iso

        existing = (
            self.client.table("tesla_connections")
            .select("id,location_scope_granted_at")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if existing.data:
            prior = existing.data[0]
            if has_location_scope and prior.get("location_scope_granted_at"):
                payload.pop("location_scope_granted_at", None)
            if prior.get("location_scope_requested_at"):
                payload.pop("location_scope_requested_at", None)
            response = self._upsert_tesla_connection_row(payload, existing_id=prior["id"])
        else:
            response = self._upsert_tesla_connection_row(payload)

        if not response:
            raise TeslaOAuthError("Failed to upsert tesla_connections row.")
        self.sync_marketplace_qualification_flags(user_id)
        return response

    def _upsert_tesla_connection_row(
        self, payload: dict[str, Any], existing_id: str | None = None
    ) -> dict[str, Any] | None:
        try:
            if existing_id:
                response = (
                    self.client.table("tesla_connections")
                    .update(payload)
                    .eq("id", existing_id)
                    .execute()
                )
            else:
                response = self.client.table("tesla_connections").insert(payload).execute()
            return (response.data or [None])[0]
        except Exception:
            # Migration may not be applied yet — fall back to legacy columns only.
            legacy = {
                key: value
                for key, value in payload.items()
                if key
                in {
                    "user_id",
                    "access_token_encrypted",
                    "refresh_token_encrypted",
                    "token_expires_at",
                    "scopes",
                    "status",
                    "last_sync_at",
                    "last_error",
                }
            }
            if existing_id:
                response = (
                    self.client.table("tesla_connections")
                    .update(legacy)
                    .eq("id", existing_id)
                    .execute()
                )
            else:
                response = self.client.table("tesla_connections").insert(legacy).execute()
            return (response.data or [None])[0]

    def user_has_vehicle_location_scope(self, user_id: str) -> bool:
        try:
            row = self.get_tesla_connection(user_id)
        except TeslaOAuthError:
            return False
        if row.get("vehicle_location_scope_granted") is True:
            return True
        granted = marketplace_lib.parse_scope_list(
            row.get("granted_scopes") or row.get("scopes")
        )
        return marketplace_lib.has_vehicle_location_scope(granted)

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
            vin = str(vehicle.get("vin") or "").strip()
            charge_state = vehicle.get("charge_state") or {}
            vehicle_config = vehicle.get("vehicle_config") or {}
            records.append(
                {
                    "user_id": user_id,
                    "tesla_connection_id": tesla_connection_id,
                    "tesla_vehicle_id": tesla_vehicle_id,
                    "vin": vin or None,
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
        allow_location = self.user_has_vehicle_location_scope(user_id)
        snapshot = telemetry_lib.normalize_snapshot(
            user_id,
            vehicle_row,
            telemetry_payload,
            vehicle_online=True,
            allow_tesla_location=allow_location,
        )
        row = self._insert_snapshot_record(snapshot)
        self._update_qualification_from_snapshot(user_id, vehicle_row.get("id"), row)
        return row

    def insert_offline_snapshot(
        self, user_id: str, vehicle_row: dict[str, Any], note: str | None = None
    ) -> dict[str, Any]:
        # Records that a poll happened but the car was asleep/offline. We do not
        # force-wake the vehicle (reserved for active dispatch events).
        snapshot = telemetry_lib.normalize_snapshot(
            user_id,
            vehicle_row,
            None,
            vehicle_online=False,
            raw_override={"vehicle_online": False, "note": note} if note else None,
        )
        return self._insert_snapshot_record(snapshot)

    def _insert_snapshot_record(self, record: dict[str, Any]) -> dict[str, Any]:
        try:
            response = self.client.table("vehicle_snapshots").insert(record).execute()
            if response.data:
                return response.data[0]
        except Exception:
            # The provider/vehicle_online columns may not be migrated yet.
            # Retry with the original v1 column set so polling never breaks.
            reduced = {
                key: value
                for key, value in record.items()
                if key not in {"provider", "vehicle_online"}
            }
            response = self.client.table("vehicle_snapshots").insert(reduced).execute()
            if response.data:
                return response.data[0]
        raise TeslaOAuthError("Failed to insert vehicle snapshot.")

    # ------------------------------------------------------------------
    # Telemetry polling + flexibility analytics (modular MVP feature).
    # ------------------------------------------------------------------

    def list_connected_user_ids(self) -> list[str]:
        rows = self._safe_select(
            "tesla_connections",
            "user_id,status",
            eq_filters={"status": "connected"},
            limit=5000,
        )
        ordered: list[str] = []
        for row in rows:
            uid = row.get("user_id")
            if uid and uid not in ordered:
                ordered.append(uid)
        return ordered

    def refresh_tokens_for_user(self, user_id: str) -> str:
        existing_refresh_token = self.get_refresh_token(user_id)
        refreshed_payload = refresh_access_token(existing_refresh_token)
        if not refreshed_payload.get("refresh_token"):
            refreshed_payload["refresh_token"] = existing_refresh_token
        self.upsert_tesla_connection(user_id=user_id, token_payload=refreshed_payload)
        return self.get_access_token(user_id)

    def get_snapshots_for_vehicle_since(
        self, vehicle_id: str, since_iso: str, limit: int = 2000
    ) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("vehicle_snapshots")
                .select(
                    "id,vehicle_id,user_id,captured_at,plugged_in,charging_state,"
                    "charger_power_kw,latitude,longitude"
                )
                .eq("vehicle_id", vehicle_id)
                .gte("captured_at", since_iso)
                .order("captured_at", desc=False)
                .limit(limit)
                .execute()
            )
            return response.data or []
        except Exception:
            return []

    def recompute_daily_flexibility(
        self, user_id: str, vehicle_id: str, summary_date: str | None = None
    ) -> dict[str, Any] | None:
        now = datetime.now(timezone.utc)
        if summary_date is None:
            summary_date = now.date().isoformat()
        # Recompute the running UTC day from its midnight boundary.
        day_start = datetime.fromisoformat(summary_date).replace(tzinfo=timezone.utc)
        snapshots = self.get_snapshots_for_vehicle_since(
            vehicle_id, day_start.isoformat()
        )
        summary = telemetry_lib.summarize_daily_flexibility(
            user_id, vehicle_id, summary_date, snapshots, now=now
        )
        if summary is None:
            return None
        return self.upsert_daily_flexibility_summary(summary)

    def upsert_daily_flexibility_summary(
        self, record: dict[str, Any]
    ) -> dict[str, Any] | None:
        try:
            response = (
                self.client.table("daily_flexibility_summaries")
                .upsert(record, on_conflict="vehicle_id,summary_date")
                .execute()
            )
            return (response.data or [None])[0]
        except Exception:
            # Table may not be migrated yet; do not break polling.
            return None

    def get_telemetry_summary(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        day_ago = now - timedelta(hours=24)
        recent_window = now - timedelta(hours=2)
        today = now.date().isoformat()

        vehicles = self._safe_select(
            "vehicles",
            "id,user_id,controllable_kw,is_active",
            eq_filters={"is_active": True},
            limit=5000,
        )
        snapshots = self._safe_select(
            "vehicle_snapshots",
            "id,vehicle_id,user_id,captured_at,plugged_in,charging_state,charger_power_kw",
            order_column="captured_at",
            descending=True,
            limit=5000,
        )
        daily = self._safe_select(
            "daily_flexibility_summaries",
            "vehicle_id,summary_date,estimated_flexible_kwh,flexibility_score",
            limit=5000,
        )

        controllable_by_vehicle = {
            v.get("id"): _to_float(v.get("controllable_kw"))
            for v in vehicles
            if v.get("id")
        }

        latest_by_vehicle: dict[str, dict[str, Any]] = {}
        for snapshot in snapshots:
            vid = snapshot.get("vehicle_id")
            if vid and vid not in latest_by_vehicle:
                latest_by_vehicle[vid] = snapshot

        snaps_last_24h = [s for s in snapshots if _is_after(s.get("captured_at"), day_ago)]
        active_vehicle_count_24h = len(
            {s.get("vehicle_id") for s in snaps_last_24h if s.get("vehicle_id")}
        )

        plugged_in_now = 0
        charging_now = 0
        dispatchable_kw = 0.0
        for vid, snapshot in latest_by_vehicle.items():
            # "Now" only counts vehicles whose latest snapshot is fresh (<= 2h).
            if not _is_after(snapshot.get("captured_at"), recent_window):
                continue
            charging_state = snapshot.get("charging_state")
            power = _to_float(snapshot.get("charger_power_kw"))
            if snapshot.get("plugged_in"):
                plugged_in_now += 1
                # Dispatchable kW estimate: prefer the vehicle's controllable_kw,
                # fall back to the live charger power.
                dispatchable_kw += controllable_by_vehicle.get(vid, 0.0) or power
            if power > 0 or (
                isinstance(charging_state, str)
                and charging_state.strip().lower() == "charging"
            ):
                charging_now += 1

        most_recent = _parse_datetime(snapshots[0].get("captured_at")) if snapshots else None
        telemetry_lag_minutes = (
            round((now - most_recent).total_seconds() / 60.0, 1) if most_recent else None
        )

        flexible_today = sum(
            _to_float(d.get("estimated_flexible_kwh"))
            for d in daily
            if str(d.get("summary_date")) == today
        )
        flex_scores_today = [
            _to_float(d.get("flexibility_score"))
            for d in daily
            if str(d.get("summary_date")) == today and d.get("flexibility_score") is not None
        ]

        return {
            "connected_vehicle_count": len(vehicles),
            "active_vehicle_count_24h": active_vehicle_count_24h,
            "plugged_in_now": plugged_in_now,
            "charging_now": charging_now,
            "estimated_dispatchable_kw": round(dispatchable_kw, 1),
            "estimated_flexible_kwh_today": round(flexible_today, 1),
            "avg_flexibility_score": round(_avg(flex_scores_today), 1)
            if flex_scores_today
            else 0.0,
            "telemetry_lag_minutes": telemetry_lag_minutes,
            "snapshots_last_24h": len(snaps_last_24h),
            "generatedAt": now.isoformat(),
        }

    def get_recent_snapshots(self, limit: int = 50) -> dict[str, Any]:
        snapshots = self._safe_select(
            "vehicle_snapshots",
            "id,vehicle_id,user_id,captured_at,battery_level,charging_state,"
            "plugged_in,charger_power_kw,latitude,longitude,vehicle_online",
            order_column="captured_at",
            descending=True,
            limit=limit,
        )
        vehicles = self._safe_select("vehicles", "id,display_name,model", limit=5000)
        name_by_id = {
            v.get("id"): (v.get("display_name") or v.get("model") or "Vehicle")
            for v in vehicles
            if v.get("id")
        }

        rows: list[dict[str, Any]] = []
        for snapshot in snapshots:
            # Privacy: never return raw coordinates here. Only a boolean flag.
            location_captured = (
                snapshot.get("latitude") is not None
                and snapshot.get("longitude") is not None
            )
            online = snapshot.get("vehicle_online")
            rows.append(
                {
                    "id": str(snapshot.get("id")),
                    "vehicle": name_by_id.get(snapshot.get("vehicle_id"), "Vehicle"),
                    "battery": round(_to_float(snapshot.get("battery_level"))),
                    "chargingState": snapshot.get("charging_state")
                    or ("Offline" if online is False else "Unknown"),
                    "powerKw": round(_to_float(snapshot.get("charger_power_kw")), 1),
                    "pluggedIn": bool(snapshot.get("plugged_in")),
                    "lastSeen": snapshot.get("captured_at"),
                    "locationCaptured": location_captured,
                }
            )
        return {"snapshots": rows, "count": len(rows)}

    def get_daily_flexibility(self, days: int = 7) -> dict[str, Any]:
        since = (datetime.now(timezone.utc).date() - timedelta(days=days - 1)).isoformat()
        rows = self._safe_select(
            "daily_flexibility_summaries",
            "summary_date,vehicle_id,user_id,total_plugged_minutes,"
            "total_charging_minutes,idle_plugged_minutes,avg_charger_power_kw,"
            "estimated_energy_delivered_kwh,estimated_flexible_kwh,"
            "flexibility_score,dispatch_confidence",
            limit=5000,
        )
        rows = [r for r in rows if str(r.get("summary_date", "")) >= since]

        by_date: dict[str, dict[str, Any]] = {}
        for row in rows:
            date_key = row.get("summary_date")
            if not date_key:
                continue
            agg = by_date.setdefault(
                str(date_key),
                {"flexibleKwh": 0.0, "active": 0, "flexScores": [], "confidences": []},
            )
            agg["active"] += 1
            agg["flexibleKwh"] += _to_float(row.get("estimated_flexible_kwh"))
            if row.get("flexibility_score") is not None:
                agg["flexScores"].append(_to_float(row.get("flexibility_score")))
            if row.get("dispatch_confidence") is not None:
                agg["confidences"].append(_to_float(row.get("dispatch_confidence")))

        days_out = []
        for date_key in sorted(by_date.keys(), reverse=True):
            agg = by_date[date_key]
            days_out.append(
                {
                    "date": date_key,
                    "activeVehicles": agg["active"],
                    "flexibleKwh": round(agg["flexibleKwh"], 1),
                    "avgFlexScore": round(_avg(agg["flexScores"]), 1)
                    if agg["flexScores"]
                    else 0.0,
                    "dispatchConfidence": round(_avg(agg["confidences"]), 3)
                    if agg["confidences"]
                    else 0.0,
                }
            )
        return {"days": days_out}

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

    def user_exists(self, user_id: str) -> bool:
        rows = self._safe_select("profiles", "id", eq_filters={"id": user_id}, limit=1)
        return bool(rows)

    def validate_user_access_token(self, access_token: str) -> str:
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
        return str(user_id)

    def get_marketplace_qualification_row(
        self, user_id: str
    ) -> dict[str, Any] | None:
        rows = self._safe_select(
            "marketplace_qualification",
            "*",
            eq_filters={"user_id": user_id},
            limit=1,
        )
        return rows[0] if rows else None

    def sync_marketplace_qualification_flags(self, user_id: str) -> dict[str, Any] | None:
        has_scope = self.user_has_vehicle_location_scope(user_id)
        has_connection = self._user_has_connected_tesla(user_id)
        existing = self.get_marketplace_qualification_row(user_id) or {}
        payload = {
            "user_id": user_id,
            "needs_location_scope": bool(has_connection and not has_scope),
            "iso_rto": existing.get("iso_rto") or "PJM",
        }
        if existing.get("zip_code"):
            payload["zip_code"] = existing.get("zip_code")
            payload["utility_verified"] = marketplace_lib.zip_verified(existing)
        if existing.get("utility_provider"):
            payload["utility_provider"] = existing.get("utility_provider")
            payload["utility_verified"] = bool(
                str(existing.get("utility_provider") or "").strip()
            )
        return self._upsert_marketplace_qualification(payload)

    def upsert_marketplace_qualification_user(
        self, user_id: str, body: dict[str, Any]
    ) -> dict[str, Any]:
        existing = self.get_marketplace_qualification_row(user_id) or {}
        zip_code = str(body.get("zip_code") or existing.get("zip_code") or "").strip()
        utility = str(
            body.get("utility_provider") or existing.get("utility_provider") or ""
        ).strip()
        state = str(body.get("state") or existing.get("state") or "").strip() or None
        pjm_zone = str(body.get("pjm_zone") or existing.get("pjm_zone") or "").strip() or None
        address_line1 = str(
            body.get("address_line1") or existing.get("address_line1") or ""
        ).strip() or None
        address_line2 = str(
            body.get("address_line2") or existing.get("address_line2") or ""
        ).strip() or None
        city = str(body.get("city") or existing.get("city") or "").strip() or None

        payload: dict[str, Any] = {
            "user_id": user_id,
            "zip_code": zip_code or None,
            "utility_provider": utility or None,
            "state": state,
            "pjm_zone": pjm_zone,
            "address_line1": address_line1,
            "address_line2": address_line2,
            "city": city,
            "iso_rto": str(body.get("iso_rto") or existing.get("iso_rto") or "PJM"),
            "utility_verified": bool(utility),
            "needs_location_scope": not self.user_has_vehicle_location_scope(user_id)
            if self._user_has_connected_tesla(user_id)
            else False,
        }
        if zip_code:
            payload["location_verification_method"] = (
                existing.get("location_verification_method") or "user_zip"
            )
        row = self._upsert_marketplace_qualification(payload)
        return self.build_me_marketplace_response(user_id, row)

    def build_me_marketplace_response(
        self, user_id: str, qualification: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        qual = qualification or self.get_marketplace_qualification_row(user_id) or {}
        has_connection = self._user_has_connected_tesla(user_id)
        has_scope = self.user_has_vehicle_location_scope(user_id)
        has_recent = self.user_has_recent_telemetry(user_id)
        eligible, status, action = marketplace_lib.compute_marketplace_eligibility(
            has_tesla_connection=has_connection,
            vehicle_location_scope_granted=has_scope,
            qualification=qual,
            has_recent_telemetry=has_recent,
        )
        update_payload = {
            "user_id": user_id,
            "marketplace_eligible": eligible,
            "needs_location_scope": bool(has_connection and not has_scope),
            "eligibility_notes": status,
        }
        for key in (
            "zip_code",
            "utility_provider",
            "state",
            "iso_rto",
            "pjm_zone",
            "address_line1",
            "address_line2",
            "city",
            "charging_location_verified",
            "utility_verified",
            "location_verification_method",
        ):
            if qual.get(key) is not None:
                update_payload[key] = qual.get(key)
        qual = self._upsert_marketplace_qualification(update_payload) or qual

        return {
            "zip_code": qual.get("zip_code"),
            "utility_provider": qual.get("utility_provider"),
            "state": qual.get("state"),
            "address_line1": qual.get("address_line1"),
            "address_line2": qual.get("address_line2"),
            "city": qual.get("city"),
            "iso_rto": qual.get("iso_rto") or "PJM",
            "pjm_zone": qual.get("pjm_zone"),
            "vehicle_location_scope_granted": has_scope,
            "charging_location_verified": marketplace_lib.charging_location_verified(
                qual
            ),
            "utility_verified": marketplace_lib.utility_verified(qual),
            "marketplace_eligible": eligible,
            "needs_location_scope": bool(has_connection and not has_scope),
            "qualification_status": status,
            "recommended_next_action": action,
            "recommended_next_action_label": marketplace_lib.next_action_label(action),
        }

    def _upsert_marketplace_qualification(
        self, payload: dict[str, Any]
    ) -> dict[str, Any] | None:
        try:
            response = (
                self.client.table("marketplace_qualification")
                .upsert(payload, on_conflict="user_id")
                .execute()
            )
            return (response.data or [None])[0]
        except Exception:
            return None

    def _update_qualification_from_snapshot(
        self, user_id: str, vehicle_id: str | None, snapshot: dict[str, Any]
    ) -> None:
        if not vehicle_id:
            return
        lat, lon = snapshot.get("latitude"), snapshot.get("longitude")
        if lat is None or lon is None:
            return
        if not self.user_has_vehicle_location_scope(user_id):
            return
        history = self.get_snapshots_for_vehicle_since(
            str(vehicle_id),
            (datetime.now(timezone.utc) - timedelta(days=14)).isoformat(),
            limit=200,
        )
        location_type = marketplace_lib.classify_charging_location(snapshot, history)
        payload = {
            "user_id": user_id,
            "vehicle_id": vehicle_id,
            "charging_location_lat": lat,
            "charging_location_lon": lon,
            "charging_location_verified": True,
            "location_verification_method": "tesla_charging_location",
            "eligibility_notes": f"charging_site:{location_type}",
        }
        existing = self.get_marketplace_qualification_row(user_id) or {}
        for key in ("zip_code", "utility_provider", "state", "iso_rto", "pjm_zone"):
            if existing.get(key):
                payload[key] = existing.get(key)
        self._upsert_marketplace_qualification(payload)
        self.build_me_marketplace_response(user_id)

    def _user_has_connected_tesla(self, user_id: str) -> bool:
        rows = self._safe_select(
            "tesla_connections",
            "id,status",
            eq_filters={"user_id": user_id, "status": "connected"},
            limit=1,
        )
        return bool(rows)

    def user_has_recent_telemetry(self, user_id: str, days: int = 7) -> bool:
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        rows = self._safe_select(
            "vehicle_snapshots",
            "id,captured_at",
            eq_filters={"user_id": user_id},
            order_column="captured_at",
            descending=True,
            limit=1,
        )
        if not rows:
            return False
        return _is_after(rows[0].get("captured_at"), datetime.now(timezone.utc) - timedelta(days=days))

    def get_admin_marketplace_summary(self) -> dict[str, Any]:
        connections = self._safe_select(
            "tesla_connections",
            "user_id,status,vehicle_location_scope_granted,granted_scopes,scopes",
            eq_filters={"status": "connected"},
            limit=5000,
        )
        qualifications = self._safe_select("marketplace_qualification", "*", limit=5000)
        qual_by_user = {str(q.get("user_id")): q for q in qualifications if q.get("user_id")}

        total = len(connections)
        scope_enabled = 0
        zip_verified = 0
        utility_verified = 0
        eligible = 0
        needs_verification = 0

        for conn in connections:
            uid = str(conn.get("user_id") or "")
            has_scope = bool(conn.get("vehicle_location_scope_granted")) or (
                marketplace_lib.has_vehicle_location_scope(
                    marketplace_lib.parse_scope_list(
                        conn.get("granted_scopes") or conn.get("scopes")
                    )
                )
            )
            if has_scope:
                scope_enabled += 1
            qual = qual_by_user.get(uid, {})
            zip_ok = marketplace_lib.zip_verified(qual)
            util_ok = marketplace_lib.utility_verified(qual)
            if zip_ok:
                zip_verified += 1
            if util_ok:
                utility_verified += 1
            row_eligible, _, _ = marketplace_lib.compute_marketplace_eligibility(
                has_tesla_connection=True,
                vehicle_location_scope_granted=has_scope,
                qualification=qual,
                has_recent_telemetry=self.user_has_recent_telemetry(uid),
            )
            if row_eligible:
                eligible += 1
            else:
                needs_verification += 1

        return {
            "total_connected_users": total,
            "vehicle_location_scope_enabled": scope_enabled,
            "missing_location_scope": max(0, total - scope_enabled),
            "zip_verified": zip_verified,
            "utility_verified": utility_verified,
            "marketplace_eligible": eligible,
            "needs_verification": needs_verification,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

    def get_admin_marketplace_users(self, limit: int = 200) -> dict[str, Any]:
        profiles = self._safe_select(
            "profiles",
            "id,full_name,email",
            order_column="created_at",
            descending=True,
            limit=limit,
        )
        connections = self._safe_select(
            "tesla_connections",
            "user_id,status,vehicle_location_scope_granted,granted_scopes,scopes",
            eq_filters={"status": "connected"},
            limit=5000,
        )
        conn_by_user = {str(c["user_id"]): c for c in connections if c.get("user_id")}
        vehicles = self._safe_select(
            "vehicles",
            "id,user_id,display_name,model",
            eq_filters={"is_active": True},
            limit=5000,
        )
        vehicle_by_user: dict[str, dict[str, Any]] = {}
        for vehicle in vehicles:
            uid = str(vehicle.get("user_id") or "")
            if uid and uid not in vehicle_by_user:
                vehicle_by_user[uid] = vehicle
        qualifications = self._safe_select("marketplace_qualification", "*", limit=5000)
        qual_by_user = {str(q.get("user_id")): q for q in qualifications if q.get("user_id")}

        users_out: list[dict[str, Any]] = []
        for profile in profiles:
            uid = str(profile.get("id") or "")
            if uid not in conn_by_user:
                continue
            conn = conn_by_user[uid]
            qual = qual_by_user.get(uid, {})
            has_scope = bool(conn.get("vehicle_location_scope_granted")) or (
                marketplace_lib.has_vehicle_location_scope(
                    marketplace_lib.parse_scope_list(
                        conn.get("granted_scopes") or conn.get("scopes")
                    )
                )
            )
            eligible, status, action = marketplace_lib.compute_marketplace_eligibility(
                has_tesla_connection=True,
                vehicle_location_scope_granted=has_scope,
                qualification=qual,
                has_recent_telemetry=self.user_has_recent_telemetry(uid),
            )
            vehicle = vehicle_by_user.get(uid, {})
            users_out.append(
                {
                    "user_id": uid,
                    "name": _display_name(profile.get("full_name"), profile.get("email")),
                    "vehicle": vehicle.get("display_name")
                    or vehicle.get("model")
                    or "No vehicle",
                    "zip_code": qual.get("zip_code") or "—",
                    "utility_provider": qual.get("utility_provider") or "—",
                    "pjm_zone": qual.get("pjm_zone") or "—",
                    "location_scope": "Enabled" if has_scope else "Missing",
                    "location_verification": marketplace_lib.location_verification_label(
                        qual
                    ),
                    "qualification_status": status,
                    "next_action": marketplace_lib.next_action_label(action),
                    "marketplace_eligible": eligible,
                }
            )

        return {"users": users_out, "count": len(users_out)}

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

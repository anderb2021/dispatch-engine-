"""Marketplace qualification + Tesla vehicle_location scope helpers (MVP).

Precise coordinates should only be used for flexibility marketplace qualification
and utility territory mapping. Do not expose precise locations on normal dashboards.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

# Mirrors backend Tesla OAuth DEFAULT_SCOPES for requested_scopes fallback.
REQUESTED_TESLA_SCOPES = [
    "openid",
    "offline_access",
    "user_data",
    "vehicle_device_data",
    "vehicle_cmds",
    "vehicle_charging_cmds",
    "vehicle_location",
]

LOCATION_SCOPE = "vehicle_location"


def parse_scope_list(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        return [part.strip() for part in raw.split() if part.strip()]
    if isinstance(raw, list):
        return [str(part).strip() for part in raw if str(part).strip()]
    return []


def scopes_from_token_payload(token_payload: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Return (granted_scopes, requested_scopes) from Tesla token response."""
    granted = parse_scope_list(
        token_payload.get("scope") or token_payload.get("scopes") or token_payload.get("granted_scopes")
    )
    requested = parse_scope_list(token_payload.get("requested_scopes"))
    if not requested:
        requested = list(REQUESTED_TESLA_SCOPES)
    return granted, requested


def has_vehicle_location_scope(granted_scopes: list[str] | None) -> bool:
    return LOCATION_SCOPE in set(granted_scopes or [])


def classify_charging_location(
    snapshot: dict[str, Any],
    historical_snapshots: list[dict[str, Any]] | None = None,
) -> str:
    """MVP charging-site classification from snapshot + recent history.

    Uses rounded coordinates in logic only; exact coords stay in restricted tables.
    """
    lat = snapshot.get("latitude")
    lon = snapshot.get("longitude")
    if lat is None or lon is None:
        return "unknown"

    # Round to ~100m for clustering without over-precision in derived labels.
    rounded = (round(float(lat), 3), round(float(lon), 3))
    hour = _snapshot_hour_utc(snapshot)
    overnight_hits = 0

    for row in historical_snapshots or []:
        if row.get("latitude") is None or row.get("longitude") is None:
            continue
        other = (round(float(row["latitude"]), 3), round(float(row["longitude"]), 3))
        if other != rounded:
            continue
        row_hour = _snapshot_hour_utc(row)
        if row_hour is None:
            continue
        if row_hour >= 22 or row_hour <= 6:
            overnight_hits += 1

    if overnight_hits >= 2 or (hour is not None and (hour >= 22 or hour <= 6)):
        return "home_candidate"
    if hour is not None and 9 <= hour <= 17:
        return "work_candidate"
    return "public_candidate"


def _snapshot_hour_utc(snapshot: dict[str, Any]) -> int | None:
    captured = snapshot.get("captured_at")
    if not captured or not isinstance(captured, str):
        return None
    try:
        raw = captured.replace("Z", "+00:00")
        return datetime.fromisoformat(raw).astimezone(timezone.utc).hour
    except ValueError:
        return None


def zip_verified(qualification: dict[str, Any] | None) -> bool:
    if not qualification:
        return False
    zip_code = str(qualification.get("zip_code") or "").strip()
    return len(zip_code) >= 5


def utility_verified(qualification: dict[str, Any] | None) -> bool:
    if not qualification:
        return False
    return bool(qualification.get("utility_verified")) and bool(
        str(qualification.get("utility_provider") or "").strip()
    )


def charging_location_verified(qualification: dict[str, Any] | None) -> bool:
    if not qualification:
        return False
    return bool(qualification.get("charging_location_verified"))


def compute_marketplace_eligibility(
    *,
    has_tesla_connection: bool,
    vehicle_location_scope_granted: bool,
    qualification: dict[str, Any] | None,
    has_recent_telemetry: bool,
) -> tuple[bool, str, str]:
    """Return (marketplace_eligible, qualification_status, recommended_next_action)."""
    qual = qualification or {}
    iso = str(qual.get("iso_rto") or "PJM").upper()
    zip_ok = zip_verified(qual)
    utility_ok = utility_verified(qual)
    tesla_loc_ok = charging_location_verified(qual)
    needs_scope = bool(qual.get("needs_location_scope"))

    if not has_tesla_connection:
        return False, "Needs Tesla Connection", "reconnect_tesla"

    if iso != "PJM":
        return False, "Pending Review", "admin_review"

    location_path = vehicle_location_scope_granted and tesla_loc_ok
    zip_utility_path = zip_ok and utility_ok

    if not has_recent_telemetry:
        if location_path or zip_utility_path:
            return False, "Pending Review", "wait_for_telemetry"
        if needs_scope:
            return False, "Needs Tesla Location Scope", "upgrade_tesla_location_scope"
        if not zip_ok:
            return False, "Needs ZIP", "add_zip"
        if not utility_ok:
            return False, "Needs Utility", "add_utility"
        return False, "Pending Review", "wait_for_telemetry"

    if location_path or zip_utility_path:
        return True, "Eligible", "none"

    if needs_scope:
        return False, "Needs Tesla Location Scope", "upgrade_tesla_location_scope"
    if not zip_ok:
        return False, "Needs ZIP", "add_zip"
    if not utility_ok:
        return False, "Needs Utility", "add_utility"
    return False, "Pending Review", "admin_review"


def location_verification_label(qualification: dict[str, Any] | None) -> str:
    """Admin-safe label (no raw coordinates)."""
    if not qualification:
        return "Not verified"
    method = str(qualification.get("location_verification_method") or "")
    if method == "tesla_charging_location" and qualification.get("charging_location_verified"):
        return "Tesla charging location captured"
    if method in {"user_zip", "user_utility"} or zip_verified(qualification):
        return "ZIP/utility only"
    return "Not verified"


def next_action_label(action: str) -> str:
    mapping = {
        "none": "Complete",
        "add_zip": "Add ZIP",
        "add_utility": "Add utility",
        "upgrade_tesla_location_scope": "Upgrade Tesla scope",
        "reconnect_tesla": "Reconnect Tesla",
        "wait_for_telemetry": "Wait for telemetry",
        "admin_review": "Admin review",
    }
    return mapping.get(action, action.replace("_", " ").title())

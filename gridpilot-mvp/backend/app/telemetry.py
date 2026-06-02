"""Tesla telemetry polling + flexibility analytics (modular MVP).

This module is intentionally self-contained so the whole feature can be removed
by deleting this file, the scheduler hook, the three /admin endpoints, and the
daily_flexibility_summaries table. It contains only pure helpers plus one
orchestration function (`poll_all_connected_vehicles`) that depends on a
SupabaseRepo and the existing Tesla client.

Privacy rules enforced here:
- Latitude/longitude are stored ONLY when the vehicle is plugged in or charging.
  Otherwise they are set to None. We never persist continuous driving history.
- Precise coordinates are intended ONLY for utility / PJM eligibility and
  marketplace qualification, never for normal user-facing dashboards.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

# Charging states (from Tesla charge_state.charging_state) that mean the car is
# physically connected to a charger. Used for the location-storage rule.
CONNECTED_CHARGING_STATES = {
    "charging",
    "starting",
    "complete",
    "stopped",
    "no_power",
    "nopower",
    "connected",
}

# conn_charge_cable values when nothing is plugged in (Tesla Fleet API).
_NO_CABLE_VALUES = {"<invalid>", "invalid", "none", ""}

# Cap applied to the gap between two consecutive snapshots when integrating
# plugged/charging minutes. Polling runs every 15 min; if a poll is missed we do
# not want a multi-hour gap to overcount. 0.5h is a conservative ceiling.
MAX_INTERVAL_HOURS = 0.5

# Conservative fraction of idle-plugged energy assumed to be dispatchable.
FLEXIBLE_ENERGY_FRACTION = 0.5


def derive_plugged_in(charge_state: dict[str, Any]) -> bool:
    """Detect cable connected from Tesla charge_state (not charge_port_door_open).

    charge_port_door_open only means the flap is open, not that a charger is connected.
    """
    cable = str(charge_state.get("conn_charge_cable") or "").strip().lower()
    if cable and cable not in _NO_CABLE_VALUES:
        return True
    state = str(charge_state.get("charging_state") or "").strip().lower()
    if state in CONNECTED_CHARGING_STATES:
        return True
    return False


def is_connected_or_charging(plugged_in: Any, charging_state: Any) -> bool:
    """True when the vehicle is plugged in / connected to a charger."""
    if bool(plugged_in):
        return True
    if isinstance(charging_state, str):
        return charging_state.strip().lower() in CONNECTED_CHARGING_STATES
    return False


def _coerce_coord(value: Any) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed == 0.0:
        return None
    return parsed


def extract_drive_location(drive_state: dict[str, Any]) -> tuple[float | None, float | None]:
    """Read lat/lon from Tesla drive_state (tries primary and fallback fields)."""
    if not drive_state:
        return None, None
    for lat_key, lon_key in (
        ("latitude", "longitude"),
        ("corrected_latitude", "corrected_longitude"),
        ("native_latitude", "native_longitude"),
    ):
        lat = _coerce_coord(drive_state.get(lat_key))
        lon = _coerce_coord(drive_state.get(lon_key))
        if lat is None or lon is None:
            continue
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
            continue
        return lat, lon
    return None, None


def _to_float(value: Any) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _odometer(response_data: dict[str, Any]) -> float | None:
    vehicle_state = response_data.get("vehicle_state") or {}
    odo = vehicle_state.get("odometer")
    try:
        return float(odo) if odo is not None else None
    except (TypeError, ValueError):
        return None


def normalize_snapshot(
    user_id: str,
    vehicle_row: dict[str, Any],
    telemetry_payload: dict[str, Any] | None,
    *,
    vehicle_online: bool = True,
    raw_override: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Normalize a Tesla vehicle_data response into the vehicle_snapshots schema.

    When `vehicle_online` is False (asleep/offline poll), charge fields and
    coordinates are null but we still record that we attempted a poll so the
    fleet availability/lag metrics stay honest.
    """
    captured_at = datetime.now(timezone.utc).isoformat()

    if not vehicle_online or telemetry_payload is None:
        return {
            "vehicle_id": vehicle_row["id"],
            "user_id": user_id,
            "provider": "tesla",
            "captured_at": captured_at,
            "vehicle_online": False,
            "battery_level": None,
            "charging_state": None,
            "plugged_in": None,
            "charge_limit_soc": None,
            "charger_power_kw": None,
            "charger_voltage": None,
            "charger_current": None,
            "time_to_full_charge_hours": None,
            "latitude": None,
            "longitude": None,
            "odometer": None,
            "raw_payload": raw_override or {"vehicle_online": False},
        }

    response_data = telemetry_payload.get("response") or telemetry_payload
    charge_state = response_data.get("charge_state") or {}
    drive_state = response_data.get("drive_state") or {}

    plugged_in = derive_plugged_in(charge_state)
    charging_state = charge_state.get("charging_state")

    # Location privacy rule: only keep coordinates while connected/charging.
    # Tesla requires vehicle_location OAuth scope or drive_state omits lat/lon.
    latitude = None
    longitude = None
    if is_connected_or_charging(plugged_in, charging_state):
        latitude, longitude = extract_drive_location(drive_state)

    return {
        "vehicle_id": vehicle_row["id"],
        "user_id": user_id,
        "provider": "tesla",
        "captured_at": captured_at,
        "vehicle_online": True,
        "battery_level": charge_state.get("battery_level"),
        "charging_state": charging_state,
        "plugged_in": plugged_in,
        "charge_limit_soc": charge_state.get("charge_limit_soc"),
        "charger_power_kw": charge_state.get("charger_power"),
        "charger_voltage": charge_state.get("charger_voltage"),
        "charger_current": charge_state.get("charger_actual_current"),
        "time_to_full_charge_hours": charge_state.get("time_to_full_charge"),
        "latitude": latitude,
        "longitude": longitude,
        "odometer": _odometer(response_data),
        "raw_payload": response_data,
    }


def is_offline_or_asleep_error(message: str) -> bool:
    """Detect Tesla's "vehicle is offline or asleep" (HTTP 408) response."""
    lowered = (message or "").lower()
    return (
        "offline or asleep" in lowered
        or "vehicle unavailable" in lowered
        or "408" in lowered
    )


# ---------------------------------------------------------------------------
# Flexibility analytics (rule-based MVP)
# ---------------------------------------------------------------------------


def _parse_dt(value: Any) -> datetime | None:
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
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def compute_flexibility_score(
    total_plugged_minutes: float,
    total_charging_minutes: float,
    idle_plugged_minutes: float,
    telemetry_lag_minutes: float,
) -> float:
    """Rule-based 0..100 score.

    Weighted blend of:
      - availability   : how long the car was plugged in today
      - idle flexibility: idle-plugged time is the shiftable window
      - consistency     : fraction of plugged time that involved real charging
      - freshness       : penalize stale telemetry
    """
    plugged_hours = total_plugged_minutes / 60.0
    idle_hours = idle_plugged_minutes / 60.0

    availability = min(plugged_hours / 12.0, 1.0)
    idle_factor = min(idle_hours / 6.0, 1.0)
    consistency = (
        min(total_charging_minutes / total_plugged_minutes, 1.0)
        if total_plugged_minutes > 0
        else 0.0
    )
    freshness = _freshness(telemetry_lag_minutes)

    score = 100.0 * (
        0.40 * availability
        + 0.35 * idle_factor
        + 0.15 * consistency
        + 0.10 * freshness
    )
    return round(max(0.0, min(score, 100.0)), 1)


def compute_dispatch_confidence(
    total_plugged_minutes: float,
    idle_plugged_minutes: float,
    telemetry_lag_minutes: float,
) -> float:
    """Conservative 0..1 confidence based on repeated plugged-in behavior and
    low telemetry lag. Capped at 0.95 so the MVP never claims certainty."""
    plugged_hours = total_plugged_minutes / 60.0
    idle_hours = idle_plugged_minutes / 60.0
    base = min(plugged_hours / 8.0, 1.0) * 0.6 + min(idle_hours / 4.0, 1.0) * 0.4
    confidence = base * _freshness(telemetry_lag_minutes)
    return round(min(confidence, 0.95), 4)


def _freshness(lag_minutes: float) -> float:
    """1.0 when telemetry is fresh (<=30m), decaying to 0 by ~150m lag."""
    if lag_minutes <= 30:
        return 1.0
    return max(0.0, 1.0 - (lag_minutes - 30.0) / 120.0)


def summarize_daily_flexibility(
    user_id: str,
    vehicle_id: str,
    summary_date: str,
    snapshots: Iterable[dict[str, Any]],
    *,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    """Aggregate a vehicle's snapshots for one UTC day into a summary row.

    `snapshots` should contain the rows for this vehicle within the day. Returns
    None if there is no usable data.
    """
    rows = [r for r in snapshots if _parse_dt(r.get("captured_at"))]
    rows.sort(key=lambda r: _parse_dt(r.get("captured_at")))  # type: ignore[arg-type]
    if not rows:
        return None

    now = now or datetime.now(timezone.utc)

    first_seen = _parse_dt(rows[0].get("captured_at"))
    last_seen = _parse_dt(rows[-1].get("captured_at"))

    total_plugged_minutes = 0.0
    total_charging_minutes = 0.0
    energy_kwh = 0.0
    charging_power_samples: list[float] = []

    plug_in_time: datetime | None = None
    unplug_time: datetime | None = None
    charging_lat = None
    charging_lon = None

    # Integrate over consecutive snapshot pairs, attributing each interval to the
    # state at the start of the interval.
    for idx, row in enumerate(rows):
        plugged = bool(row.get("plugged_in"))
        power = _to_float(row.get("charger_power_kw"))
        ts = _parse_dt(row.get("captured_at"))

        if plugged:
            if plug_in_time is None:
                plug_in_time = ts
            unplug_time = ts
            # remember last known charging coordinates (privacy: only set when plugged)
            if row.get("latitude") is not None and row.get("longitude") is not None:
                charging_lat = row.get("latitude")
                charging_lon = row.get("longitude")

        if power > 0:
            charging_power_samples.append(power)

        if idx + 1 < len(rows):
            next_ts = _parse_dt(rows[idx + 1].get("captured_at"))
            if ts and next_ts:
                interval_hours = (next_ts - ts).total_seconds() / 3600.0
                interval_hours = max(0.0, min(interval_hours, MAX_INTERVAL_HOURS))
                if plugged:
                    total_plugged_minutes += interval_hours * 60.0
                if power > 0:
                    total_charging_minutes += interval_hours * 60.0
                    energy_kwh += power * interval_hours

    idle_plugged_minutes = max(0.0, total_plugged_minutes - total_charging_minutes)
    avg_charger_power_kw = (
        sum(charging_power_samples) / len(charging_power_samples)
        if charging_power_samples
        else 0.0
    )
    idle_plugged_hours = idle_plugged_minutes / 60.0

    # estimated_flexible_kwh = max(0, idle_plugged_hours * avg_power * fraction)
    estimated_flexible_kwh = max(
        0.0, idle_plugged_hours * avg_charger_power_kw * FLEXIBLE_ENERGY_FRACTION
    )

    telemetry_lag_minutes = (
        (now - last_seen).total_seconds() / 60.0 if last_seen else 9999.0
    )

    flexibility_score = compute_flexibility_score(
        total_plugged_minutes,
        total_charging_minutes,
        idle_plugged_minutes,
        telemetry_lag_minutes,
    )
    dispatch_confidence = compute_dispatch_confidence(
        total_plugged_minutes, idle_plugged_minutes, telemetry_lag_minutes
    )

    return {
        "user_id": user_id,
        "vehicle_id": vehicle_id,
        "summary_date": summary_date,
        "first_seen_at": first_seen.isoformat() if first_seen else None,
        "last_seen_at": last_seen.isoformat() if last_seen else None,
        "plug_in_time": plug_in_time.isoformat() if plug_in_time else None,
        "unplug_time": unplug_time.isoformat() if unplug_time else None,
        "total_plugged_minutes": round(total_plugged_minutes, 2),
        "total_charging_minutes": round(total_charging_minutes, 2),
        "idle_plugged_minutes": round(idle_plugged_minutes, 2),
        "avg_charger_power_kw": round(avg_charger_power_kw, 2),
        "estimated_energy_delivered_kwh": round(energy_kwh, 3),
        "estimated_flexible_kwh": round(estimated_flexible_kwh, 3),
        # Coordinates only for utility/PJM eligibility + marketplace qualification.
        "charging_location_lat": charging_lat,
        "charging_location_lon": charging_lon,
        "charging_location_type": "primary" if charging_lat is not None else None,
        "flexibility_score": flexibility_score,
        "dispatch_confidence": dispatch_confidence,
    }


# ---------------------------------------------------------------------------
# Polling orchestration
# ---------------------------------------------------------------------------


def poll_all_connected_vehicles(repo: "Any") -> dict[str, Any]:
    """Poll every active Tesla-connected vehicle once and store snapshots.

    Safe by design:
    - Refreshes expired tokens via the repo (existing Tesla auth logic).
    - Does NOT force-wake asleep/offline vehicles (records an offline snapshot
      instead). Force-wake is reserved for active dispatch events (future work).
    - Never raises: per-vehicle failures are collected and logged, the loop
      continues, and a summary dict is returned.
    """
    # Imported lazily to avoid any import cycle and keep this module removable.
    from .tesla import TeslaOAuthError, get_vehicle_data

    result: dict[str, Any] = {
        "users_polled": 0,
        "vehicles_polled": 0,
        "snapshots_written": 0,
        "offline_skipped": 0,
        "errors": [],
    }

    try:
        user_ids = repo.list_connected_user_ids()
    except Exception as exc:  # pragma: no cover - defensive
        result["errors"].append(f"list_connected_user_ids failed: {exc}")
        return result

    for user_id in user_ids:
        result["users_polled"] += 1
        try:
            access_token = repo.get_access_token(user_id)
            vehicles = repo.list_active_vehicles(user_id)
        except Exception as exc:
            result["errors"].append(f"{user_id}: setup failed: {exc}")
            continue

        refreshed = False
        for vehicle in vehicles:
            result["vehicles_polled"] += 1
            tesla_vehicle_id = vehicle.get("tesla_vehicle_id")
            try:
                try:
                    payload = get_vehicle_data(
                        tesla_vehicle_id=tesla_vehicle_id, access_token=access_token
                    )
                except TeslaOAuthError as exc:
                    message = str(exc)
                    # Asleep/offline: record an offline snapshot, do not force wake.
                    if is_offline_or_asleep_error(message):
                        repo.insert_offline_snapshot(user_id, vehicle, note=message)
                        result["offline_skipped"] += 1
                        _recompute_today(repo, user_id, vehicle.get("id"), result)
                        continue
                    # Expired token: refresh once and retry.
                    if not refreshed and _is_expired(message):
                        access_token = repo.refresh_tokens_for_user(user_id)
                        refreshed = True
                        payload = get_vehicle_data(
                            tesla_vehicle_id=tesla_vehicle_id,
                            access_token=access_token,
                        )
                    else:
                        raise

                repo.insert_vehicle_snapshot(
                    user_id=user_id, vehicle_row=vehicle, telemetry_payload=payload
                )
                result["snapshots_written"] += 1
                _recompute_today(repo, user_id, vehicle.get("id"), result)
            except Exception as exc:
                # Log and keep going; one bad vehicle must not crash the worker.
                result["errors"].append(f"{user_id}/{tesla_vehicle_id}: {exc}")

    return result


def _is_expired(message: str) -> bool:
    lowered = (message or "").lower()
    return "token expired" in lowered or "401" in lowered


def _recompute_today(repo: "Any", user_id: str, vehicle_id: str | None, result: dict) -> None:
    if not vehicle_id:
        return
    try:
        repo.recompute_daily_flexibility(user_id, vehicle_id)
    except Exception as exc:  # pragma: no cover - defensive
        result["errors"].append(f"{user_id}/{vehicle_id}: summary failed: {exc}")

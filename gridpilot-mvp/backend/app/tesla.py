import secrets
import base64
import json
import hashlib
import hmac
import time
from urllib.parse import quote, urlencode
import requests
from . import config

TOKEN_STORE = {}

# Order matches Tesla Fleet API docs; request full vehicle integration set up front.
DEFAULT_SCOPES = [
    "openid",
    "offline_access",
    "user_data",
    "vehicle_device_data",
    "vehicle_cmds",
    "vehicle_charging_cmds",
    "vehicle_location",  # drive_state lat/lon on firmware 2023.38+
]

# Enforced on callback when allow_charging_management=True.
# vehicle_cmds is requested on authorize but not required for login (partner apps may lack it).
REQUIRED_TESLA_SCOPES = frozenset(
    {
        "offline_access",
        "user_data",
        "vehicle_device_data",
        "vehicle_charging_cmds",
        "vehicle_location",
    }
)

class TeslaOAuthError(Exception):
    pass

def create_upgrade_link_token(
    user_id: str, *, expires_seconds: int | None = None
) -> str:
    """Signed token for email links (no GridPilot login required)."""
    if not user_id:
        raise TeslaOAuthError("Missing user_id for upgrade link.")
    ttl = expires_seconds if expires_seconds is not None else config.TESLA_UPGRADE_LINK_TTL_SECONDS
    now = int(time.time())
    envelope = {
        "user_id": user_id,
        "kind": "tesla_upgrade_link",
        "iat": now,
        "exp": now + int(ttl),
    }
    body = json.dumps(envelope, separators=(",", ":"), sort_keys=True).encode("utf-8")
    body_b64 = _b64url_encode(body)
    signature = _state_signature(body_b64.encode("utf-8"))
    return f"{body_b64}.{_b64url_encode(signature)}"


def verify_upgrade_link_token(token: str) -> dict | None:
    payload = _verify_signed_payload(token)
    if not payload or payload.get("kind") != "tesla_upgrade_link":
        return None
    if not payload.get("user_id"):
        return None
    return payload


def build_upgrade_link_url(user_id: str, *, next_path: str = "/dashboard") -> str:
    token = create_upgrade_link_token(user_id)
    base = config.get_frontend_base_url().rstrip("/")
    return (
        f"{base}/tesla/upgrade-location?token={quote(token)}"
        f"&next={quote(next_path if next_path.startswith('/') else '/dashboard')}"
    )


def build_authorize_url(
    user_id: str | None = None,
    purpose: str = "connect",
    next_path: str = "/dashboard",
    allow_charging_management: bool = True,
    auto_login: bool = False,
) -> dict:
    if not config.TESLA_CLIENT_ID:
        raise TeslaOAuthError("Missing TESLA_CLIENT_ID in backend .env")
    if purpose == "connect" and not user_id:
        raise TeslaOAuthError("Missing user_id. Log in before connecting Tesla.")
    if purpose not in {"connect", "login", "location_upgrade"}:
        raise TeslaOAuthError("Invalid Tesla OAuth purpose.")
    if purpose == "location_upgrade" and not user_id:
        raise TeslaOAuthError("Missing user_id for location scope upgrade.")

    state = _create_signed_state(
        {
            "user_id": user_id,
            "purpose": purpose,
            "next_path": next_path if next_path.startswith("/") else "/dashboard",
            "allow_charging_management": bool(allow_charging_management),
            "auto_login": bool(auto_login),
            "nonce": secrets.token_urlsafe(16),
        }
    )

    params = {
        "response_type": "code",
        "client_id": config.TESLA_CLIENT_ID,
        "redirect_uri": config.TESLA_REDIRECT_URI,
        "scope": " ".join(DEFAULT_SCOPES),
        "state": state,
        "locale": "en-US",
        # User must grant every requested scope (all integration toggles) to continue.
        "prompt_missing_scopes": "true",
        "require_requested_scopes": "true",
    }
    if purpose == "login":
        params["prompt"] = "login"

    return {
        "url": f"{config.TESLA_AUTH_URL}?{urlencode(params)}",
        "state": state,
        "dry_run": config.DRY_RUN,
    }

def exchange_code_for_token(code: str, state: str) -> dict:
    state_data = _verify_signed_state(state)
    if not state_data:
        raise TeslaOAuthError("Invalid OAuth state. Restart the connection flow.")
    user_id = state_data.get("user_id")
    purpose = state_data.get("purpose", "connect")
    next_path = state_data.get("next_path", "/dashboard")

    if config.DRY_RUN:
        token_payload = {
            "access_token": "dry_run_access_token",
            "refresh_token": "dry_run_refresh_token",
            "expires_in": 28800,
            "token_type": "Bearer",
            "dry_run": True,
            "scope": " ".join(DEFAULT_SCOPES),
            "user_id": user_id,
            "purpose": purpose,
            "next_path": next_path,
        }
        if user_id:
            TOKEN_STORE[user_id] = token_payload
        return token_payload

    if not config.TESLA_CLIENT_ID:
        raise TeslaOAuthError("Missing TESLA_CLIENT_ID")
    if not config.TESLA_CLIENT_SECRET:
        raise TeslaOAuthError("Missing TESLA_CLIENT_SECRET")

    data = {
        "grant_type": "authorization_code",
        "client_id": config.TESLA_CLIENT_ID,
        "client_secret": config.TESLA_CLIENT_SECRET,
        "code": code,
        "audience": config.TESLA_AUDIENCE,
        "redirect_uri": config.TESLA_REDIRECT_URI,
    }

    response = requests.post(
        config.TESLA_TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )

    if response.status_code >= 400:
        raise TeslaOAuthError(f"Tesla token exchange failed: {response.status_code} {response.text}")

    token_payload = response.json()
    granted_scopes = extract_granted_scopes(token_payload)
    if granted_scopes:
        token_payload["scope"] = " ".join(sorted(granted_scopes))
    token_payload["user_id"] = user_id
    token_payload["purpose"] = purpose
    token_payload["next_path"] = next_path
    token_payload["allow_charging_management"] = bool(
        state_data.get("allow_charging_management", True)
    )
    if user_id:
        TOKEN_STORE[user_id] = token_payload
    return token_payload


def extract_granted_scopes(token_payload: dict) -> set[str]:
    """Scopes from token body and/or JWT scp claim (Tesla often omits scope in JSON)."""
    scopes: set[str] = set()
    raw = token_payload.get("scope") or token_payload.get("scopes") or token_payload.get(
        "granted_scopes"
    )
    if isinstance(raw, str):
        scopes.update(part for part in raw.split() if part)
    elif isinstance(raw, list):
        scopes.update(str(part).strip() for part in raw if str(part).strip())

    for token_key in ("access_token", "id_token"):
        token = token_payload.get(token_key)
        if not token:
            continue
        claims = _decode_jwt_claims(token)
        scp = claims.get("scp") or claims.get("scope")
        if isinstance(scp, str):
            scopes.update(part for part in scp.split() if part)
        elif isinstance(scp, list):
            scopes.update(str(part).strip() for part in scp if str(part).strip())

    if token_payload.get("refresh_token"):
        scopes.add("offline_access")

    if not scopes and token_payload.get("refresh_token"):
        # User passed require_requested_scopes on Tesla; body often has no scope field.
        scopes.update(REQUIRED_TESLA_SCOPES)
        scopes.add("vehicle_cmds")

    return scopes


def get_state_context(state: str) -> dict | None:
    return _verify_signed_state(state)

def refresh_access_token(refresh_token: str) -> dict:
    if config.DRY_RUN:
        token_payload = {
            "access_token": "dry_run_refreshed_access_token",
            "refresh_token": "dry_run_new_refresh_token",
            "expires_in": 28800,
            "token_type": "Bearer",
            "dry_run": True,
        }
        TOKEN_STORE["demo_user"] = token_payload
        return token_payload

    data = {
        "grant_type": "refresh_token",
        "client_id": config.TESLA_CLIENT_ID,
        "refresh_token": refresh_token,
    }

    if config.TESLA_CLIENT_SECRET:
        data["client_secret"] = config.TESLA_CLIENT_SECRET

    response = requests.post(
        config.TESLA_TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )

    if response.status_code >= 400:
        raise TeslaOAuthError(f"Tesla refresh failed: {response.status_code} {response.text}")

    token_payload = response.json()
    TOKEN_STORE["demo_user"] = token_payload
    return token_payload

def list_vehicles(access_token: str) -> dict:
    if config.DRY_RUN:
        return {
            "dry_run": True,
            "vehicles": [
                {
                    "id": "demo_vehicle_1",
                    "display_name": "Tesla Model Y",
                    "state": "online",
                    "battery_level": 68,
                    "charging_state": "Plugged In",
                }
            ],
        }

    url = f"{config.TESLA_FLEET_BASE_URL}/api/1/vehicles"
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )

    if response.status_code >= 400:
        raise TeslaOAuthError(f"Tesla vehicles request failed: {response.status_code} {response.text}")

    return response.json()


def unwrap_vehicle_data_payload(payload: dict) -> dict:
    """Normalize Fleet API vehicle_data JSON to a flat charge_state / drive_state dict."""
    if not isinstance(payload, dict):
        return {}
    inner = payload.get("response")
    if isinstance(inner, dict) and (
        "charge_state" in inner
        or "drive_state" in inner
        or "location_data" in inner
        or "vehicle_state" in inner
    ):
        return inner
    if "charge_state" in payload or "drive_state" in payload or "location_data" in payload:
        return payload
    return inner if isinstance(inner, dict) else payload


def merge_vehicle_data_parts(base: dict, extra: dict) -> dict:
    """Merge endpoint slices (e.g. location_data follow-up) into one response object."""
    merged = dict(base)
    for key in ("charge_state", "drive_state", "location_data", "vehicle_state"):
        value = extra.get(key)
        if isinstance(value, dict) and value:
            merged[key] = value
    return merged


def get_vehicle_data(
    tesla_vehicle_id: str,
    access_token: str,
    *,
    include_location: bool = True,
    endpoints: str | None = None,
) -> dict:
    if config.DRY_RUN:
        return {
            "dry_run": True,
            "response": {
                "id_s": tesla_vehicle_id,
                "charge_state": {
                    "battery_level": 68,
                    "charging_state": "Charging",
                    "charge_port_door_open": True,
                    "charge_limit_soc": 80,
                    "charger_power": 7.2,
                    "charger_voltage": 240,
                    "charger_actual_current": 30,
                    "time_to_full_charge": 2.5,
                },
                "drive_state": {
                    "latitude": 37.3947,
                    "longitude": -122.1503,
                },
                "location_data": {
                    "latitude": 37.3947,
                    "longitude": -122.1503,
                },
                "vehicle_state": {
                    "odometer": 12034.6,
                },
            },
        }

    # location_data is required on 2023.38+ for lat/lon when parked; skip if scope not granted.
    if endpoints is None:
        endpoints = "charge_state;drive_state"
        if include_location:
            endpoints += ";location_data"
    vehicle_ref = str(tesla_vehicle_id).strip()
    url = (
        f"{config.TESLA_FLEET_BASE_URL}/api/1/vehicles/{vehicle_ref}/vehicle_data"
        f"?endpoints={endpoints}"
    )
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    if response.status_code >= 400:
        raise TeslaOAuthError(
            f"Tesla vehicle_data request failed: {response.status_code} {response.text}"
        )
    return response.json()


def wake_vehicle(tesla_vehicle_id: str, access_token: str) -> dict:
    """Wake an asleep/offline vehicle so a live vehicle_data call can succeed."""
    if config.DRY_RUN:
        return {"dry_run": True, "state": "online"}

    url = f"{config.TESLA_FLEET_BASE_URL}/api/1/vehicles/{tesla_vehicle_id}/wake_up"
    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=45,
    )
    if response.status_code >= 400:
        raise TeslaOAuthError(
            f"Tesla wake_up request failed: {response.status_code} {response.text}"
        )
    return response.json()


def extract_identity(token_payload: dict) -> dict:
    id_token = token_payload.get("id_token")
    claims = _decode_jwt_claims(id_token) if id_token else {}
    sub = claims.get("sub")
    if not sub:
        raise TeslaOAuthError("Tesla identity token missing subject.")
    display_name = (
        claims.get("name")
        or claims.get("preferred_username")
        or _build_name_from_claims(claims)
        or "Tesla Driver"
    )
    return {
        "sub": str(sub),
        "email": claims.get("email"),
        "name": display_name,
    }


def _decode_jwt_claims(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        payload = parts[1]
        padding = "=" * ((4 - len(payload) % 4) % 4)
        decoded = base64.urlsafe_b64decode(payload + padding)
        return json.loads(decoded.decode("utf-8"))
    except Exception:
        return {}


def _build_name_from_claims(claims: dict) -> str | None:
    given = claims.get("given_name")
    family = claims.get("family_name")
    if given and family:
        return f"{given} {family}"
    return given or family


def _create_signed_state(payload: dict) -> str:
    now = int(time.time())
    envelope = {
        **payload,
        "iat": now,
        "exp": now + 900,  # 15 minutes
    }
    body = json.dumps(envelope, separators=(",", ":"), sort_keys=True).encode("utf-8")
    body_b64 = _b64url_encode(body)
    signature = _state_signature(body_b64.encode("utf-8"))
    return f"{body_b64}.{_b64url_encode(signature)}"


def _verify_signed_state(state: str) -> dict | None:
    return _verify_signed_payload(state)


def _verify_signed_payload(token: str) -> dict | None:
    try:
        body_b64, sig_b64 = token.split(".", 1)
    except ValueError:
        return None
    expected_sig = _state_signature(body_b64.encode("utf-8"))
    given_sig = _b64url_decode(sig_b64)
    if not hmac.compare_digest(expected_sig, given_sig):
        return None
    try:
        payload = json.loads(_b64url_decode(body_b64).decode("utf-8"))
    except Exception:
        return None
    now = int(time.time())
    if int(payload.get("exp", 0)) < now:
        return None
    return payload


def _state_signature(data: bytes) -> bytes:
    secret = (config.SECRET_KEY or "gridpilot-oauth-state").encode("utf-8")
    return hmac.new(secret, data, hashlib.sha256).digest()


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode(data + padding)
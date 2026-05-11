import secrets
import base64
import json
import hashlib
import hmac
import time
from urllib.parse import urlencode
import requests
from . import config

TOKEN_STORE = {}

DEFAULT_SCOPES = [
    "openid",
    "offline_access",
    "user_data",
    "vehicle_device_data",
    "vehicle_charging_cmds",
]

class TeslaOAuthError(Exception):
    pass

def build_authorize_url(
    user_id: str | None = None, purpose: str = "connect", next_path: str = "/dashboard"
) -> dict:
    if not config.TESLA_CLIENT_ID:
        raise TeslaOAuthError("Missing TESLA_CLIENT_ID in backend .env")
    if purpose == "connect" and not user_id:
        raise TeslaOAuthError("Missing user_id. Log in before connecting Tesla.")
    if purpose not in {"connect", "login"}:
        raise TeslaOAuthError("Invalid Tesla OAuth purpose.")

    state = _create_signed_state(
        {
            "user_id": user_id,
            "purpose": purpose,
            "next_path": next_path if next_path.startswith("/") else "/dashboard",
            "nonce": secrets.token_urlsafe(16),
        }
    )

    params = {
        "response_type": "code",
        "client_id": config.TESLA_CLIENT_ID,
        "redirect_uri": config.TESLA_REDIRECT_URI,
        "scope": " ".join(DEFAULT_SCOPES),
        "state": state,
        "prompt": "login",
        "locale": "en-US",
        "prompt_missing_scopes": "true",
        "require_requested_scopes": "true",
    }

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
    token_payload["user_id"] = user_id
    token_payload["purpose"] = purpose
    token_payload["next_path"] = next_path
    if user_id:
        TOKEN_STORE[user_id] = token_payload
    return token_payload


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


def get_vehicle_data(tesla_vehicle_id: str, access_token: str) -> dict:
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
                "vehicle_state": {
                    "odometer": 12034.6,
                },
            },
        }

    url = f"{config.TESLA_FLEET_BASE_URL}/api/1/vehicles/{tesla_vehicle_id}/vehicle_data"
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


def extract_identity(token_payload: dict) -> dict:
    id_token = token_payload.get("id_token")
    claims = _decode_jwt_claims(id_token) if id_token else {}
    sub = claims.get("sub")
    if not sub:
        raise TeslaOAuthError("Tesla identity token missing subject.")
    return {
        "sub": str(sub),
        "email": claims.get("email"),
        "name": claims.get("name"),
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
    try:
        body_b64, sig_b64 = state.split(".", 1)
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
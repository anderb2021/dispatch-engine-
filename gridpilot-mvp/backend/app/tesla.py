import secrets
from urllib.parse import urlencode
import requests
from . import config

STATE_STORE = set()
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

def build_authorize_url() -> dict:
    if not config.TESLA_CLIENT_ID:
        raise TeslaOAuthError("Missing TESLA_CLIENT_ID in backend .env")

    state = secrets.token_urlsafe(32)
    STATE_STORE.add(state)

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
    if state not in STATE_STORE:
        raise TeslaOAuthError("Invalid OAuth state. Restart the connection flow.")

    STATE_STORE.remove(state)

    if config.DRY_RUN:
        token_payload = {
            "access_token": "dry_run_access_token",
            "refresh_token": "dry_run_refresh_token",
            "expires_in": 28800,
            "token_type": "Bearer",
            "dry_run": True,
        }
        TOKEN_STORE["demo_user"] = token_payload
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
    TOKEN_STORE["demo_user"] = token_payload
    return token_payload

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

def list_vehicles(access_token: str | None = None) -> dict:
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

    token = access_token or TOKEN_STORE.get("demo_user", {}).get("access_token")
    if not token:
        raise TeslaOAuthError("No Tesla access token available. Connect Tesla first.")

    url = f"{config.TESLA_FLEET_BASE_URL}/api/1/vehicles"
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )

    if response.status_code >= 400:
        raise TeslaOAuthError(f"Tesla vehicles request failed: {response.status_code} {response.text}")

    return response.json()
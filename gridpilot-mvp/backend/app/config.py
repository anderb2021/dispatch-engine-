import os
from dataclasses import dataclass
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()

APP_NAME = os.getenv("APP_NAME", "GridPilot MVP")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./gridpilot.db")
SECRET_KEY = os.getenv("SECRET_KEY", "")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")

TESLA_CLIENT_ID = os.getenv("TESLA_CLIENT_ID", "")
TESLA_CLIENT_SECRET = os.getenv("TESLA_CLIENT_SECRET", "")
TESLA_REDIRECT_URI = os.getenv("TESLA_REDIRECT_URI", "http://localhost:8000/auth/tesla/callback")
TESLA_AUDIENCE = os.getenv("TESLA_AUDIENCE", "https://fleet-api.prd.na.vn.cloud.tesla.com")
FRONTEND_CALLBACK_URL = os.getenv("FRONTEND_CALLBACK_URL", "http://localhost:3000/tesla/callback")
FRONTEND_TESLA_LOGIN_CALLBACK_URL = os.getenv(
    "FRONTEND_TESLA_LOGIN_CALLBACK_URL", "http://localhost:3000/auth/tesla/callback"
)
# Production default when unset (override with FRONTEND_BASE_URL on Render).
GRIDPILOT_PRODUCTION_FRONTEND_URL = "https://www.joingridpilot.com"


def get_frontend_base_url() -> str:
    """Public site origin for email links and redirects."""
    explicit = os.getenv("FRONTEND_BASE_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")

    for env_key in ("FRONTEND_TESLA_LOGIN_CALLBACK_URL", "FRONTEND_CALLBACK_URL"):
        raw = os.getenv(env_key, "").strip()
        if not raw:
            continue
        parsed = urlparse(raw)
        if parsed.scheme and parsed.netloc:
            origin = f"{parsed.scheme}://{parsed.netloc}"
            if "localhost" not in origin and "127.0.0.1" not in origin:
                return origin

    dry_run = os.getenv("DRY_RUN", "true").lower() == "true"
    if not dry_run:
        return GRIDPILOT_PRODUCTION_FRONTEND_URL
    return "http://localhost:3000"


FRONTEND_BASE_URL = get_frontend_base_url()
# Signed email links for Tesla location upgrade (default 30 days).
TESLA_UPGRADE_LINK_TTL_SECONDS = int(
    os.getenv("TESLA_UPGRADE_LINK_TTL_SECONDS", str(30 * 24 * 60 * 60))
)
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"
# Background Tesla telemetry polling (15-minute interval). Set to false to disable.
TELEMETRY_POLLING_ENABLED = (
    os.getenv("TELEMETRY_POLLING_ENABLED", "true").lower() == "true"
)

TESLA_AUTH_URL = "https://auth.tesla.com/oauth2/v3/authorize"
TESLA_TOKEN_URL = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token"
TESLA_FLEET_BASE_URL = TESLA_AUDIENCE


@dataclass
class Settings:
    app_name: str = APP_NAME
    database_url: str = DATABASE_URL
    secret_key: str = SECRET_KEY
    encryption_key: str = ENCRYPTION_KEY
    supabase_url: str = SUPABASE_URL
    supabase_service_role_key: str = SUPABASE_SERVICE_ROLE_KEY
    supabase_publishable_key: str = SUPABASE_PUBLISHABLE_KEY


settings = Settings()
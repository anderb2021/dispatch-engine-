import os
from dataclasses import dataclass
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
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
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
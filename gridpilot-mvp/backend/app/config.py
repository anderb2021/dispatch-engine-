import os
from dotenv import load_dotenv

load_dotenv()

TESLA_CLIENT_ID = os.getenv("TESLA_CLIENT_ID", "")
TESLA_CLIENT_SECRET = os.getenv("TESLA_CLIENT_SECRET", "")
TESLA_REDIRECT_URI = os.getenv("TESLA_REDIRECT_URI", "http://localhost:8000/auth/tesla/callback")
TESLA_AUDIENCE = os.getenv("TESLA_AUDIENCE", "https://fleet-api.prd.na.vn.cloud.tesla.com")
FRONTEND_CALLBACK_URL = os.getenv("FRONTEND_CALLBACK_URL", "http://localhost:3000/tesla/callback")
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"

TESLA_AUTH_URL = "https://auth.tesla.com/oauth2/v3/authorize"
TESLA_TOKEN_URL = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token"
TESLA_FLEET_BASE_URL = TESLA_AUDIENCE
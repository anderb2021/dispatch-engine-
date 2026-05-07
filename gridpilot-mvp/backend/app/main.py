from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from . import config
from .tesla import (
    TeslaOAuthError,
    build_authorize_url,
    exchange_code_for_token,
    refresh_access_token,
    list_vehicles,
)

app = FastAPI(title="GridPilot EBON API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Energy Behavior Orchestration Network",
        "dry_run": config.DRY_RUN,
    }

@app.get("/health")
def health():
    return {"healthy": True}

@app.get("/auth/tesla/start")
def tesla_start():
    try:
        return build_authorize_url()
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.get("/auth/tesla/redirect")
def tesla_redirect():
    try:
        data = build_authorize_url()
        return RedirectResponse(data["url"])
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.get("/auth/tesla/callback")
def tesla_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    try:
        token_payload = exchange_code_for_token(code=code, state=state)
        return RedirectResponse(
            f"{config.FRONTEND_CALLBACK_URL}?connected=true&dry_run={str(token_payload.get('dry_run', False)).lower()}"
        )
    except TeslaOAuthError as exc:
        return RedirectResponse(
            f"{config.FRONTEND_CALLBACK_URL}?connected=false&error={str(exc)}"
        )

@app.post("/auth/tesla/refresh")
def tesla_refresh(refresh_token: str):
    try:
        return refresh_access_token(refresh_token)
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.get("/tesla/vehicles")
def tesla_vehicles():
    try:
        return list_vehicles()
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
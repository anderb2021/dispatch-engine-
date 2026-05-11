from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from urllib.parse import quote

from . import config
from .tesla import (
    TeslaOAuthError,
    build_authorize_url,
    exchange_code_for_token,
    extract_identity,
    get_state_context,
    get_vehicle_data,
    refresh_access_token,
    list_vehicles,
)
from .supabase_repo import SupabaseRepo

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
def tesla_start(user_id: str = Query(...)):
    try:
        return build_authorize_url(user_id=user_id, purpose="connect")
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.get("/auth/tesla/redirect")
def tesla_redirect(user_id: str = Query(...)):
    try:
        data = build_authorize_url(user_id=user_id, purpose="connect")
        return RedirectResponse(data["url"])
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/auth/tesla/login/redirect")
def tesla_login_redirect(next: str = Query("/dashboard")):
    try:
        data = build_authorize_url(purpose="login", next_path=next)
        return RedirectResponse(data["url"])
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.get("/auth/tesla/callback")
def tesla_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    state_context = get_state_context(state) or {}
    purpose = state_context.get("purpose", "connect")
    error_redirect_base = (
        config.FRONTEND_TESLA_LOGIN_CALLBACK_URL
        if purpose == "login"
        else config.FRONTEND_CALLBACK_URL
    )

    try:
        token_payload = exchange_code_for_token(code=code, state=state)
        purpose = token_payload.get("purpose", purpose)
        repo = SupabaseRepo()

        if purpose == "login":
            identity = extract_identity(token_payload)
            login_session = repo.sign_in_from_tesla_identity(identity)
            user_id = login_session.get("user_id")
            if not user_id:
                raise TeslaOAuthError("Tesla login did not return a user id.")

            repo.upsert_tesla_connection(user_id=user_id, token_payload=token_payload)
            access_token = quote(login_session.get("access_token") or "", safe="")
            refresh_token = quote(login_session.get("refresh_token") or "", safe="")
            next_path = quote(token_payload.get("next_path", "/dashboard"), safe="/")
            return RedirectResponse(
                f"{config.FRONTEND_TESLA_LOGIN_CALLBACK_URL}?access_token={access_token}&refresh_token={refresh_token}&next={next_path}&connected=true"
            )

        user_id = token_payload.get("user_id")
        if not user_id:
            raise TeslaOAuthError("Missing user_id in OAuth callback payload.")
        repo.upsert_tesla_connection(user_id=user_id, token_payload=token_payload)
        return RedirectResponse(
            f"{config.FRONTEND_CALLBACK_URL}?connected=true&dry_run={str(token_payload.get('dry_run', False)).lower()}"
        )
    except TeslaOAuthError as exc:
        error_message = quote(str(exc), safe="")
        return RedirectResponse(
            f"{error_redirect_base}?connected=false&error={error_message}"
        )
    except Exception as exc:
        error_message = quote(f"Unexpected callback error: {exc}", safe="")
        return RedirectResponse(
            f"{error_redirect_base}?connected=false&error={error_message}"
        )

@app.post("/auth/tesla/refresh")
def tesla_refresh(refresh_token: str):
    try:
        return refresh_access_token(refresh_token)
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.get("/tesla/vehicles")
def tesla_vehicles(user_id: str = Query(...)):
    try:
        repo = SupabaseRepo()
        access_token = repo.get_access_token(user_id)
        vehicles_payload = list_vehicles(access_token=access_token)
        connection = repo.get_tesla_connection(user_id)
        upserted = repo.upsert_vehicles(
            user_id=user_id,
            tesla_connection_id=connection.get("id"),
            vehicles_payload=vehicles_payload,
        )
        return {
            "dry_run": config.DRY_RUN,
            "vehicle_count": len(upserted),
            "vehicles": upserted,
        }
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/tesla/poll-telemetry")
def tesla_poll_telemetry(user_id: str = Query(...)):
    try:
        repo = SupabaseRepo()
        access_token = repo.get_access_token(user_id)
        vehicles = repo.list_active_vehicles(user_id)
        snapshots = []
        for vehicle in vehicles:
            telemetry_payload = get_vehicle_data(
                tesla_vehicle_id=vehicle["tesla_vehicle_id"],
                access_token=access_token,
            )
            snapshots.append(
                repo.insert_vehicle_snapshot(
                    user_id=user_id,
                    vehicle_row=vehicle,
                    telemetry_payload=telemetry_payload,
                )
            )

        return {
            "dry_run": config.DRY_RUN,
            "vehicles_polled": len(vehicles),
            "snapshots_written": len(snapshots),
        }
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/dashboard/summary")
def dashboard_summary(user_id: str = Query(...)):
    try:
        repo = SupabaseRepo()
        summary = repo.get_dashboard_summary(user_id)
        return {"summary": summary}
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
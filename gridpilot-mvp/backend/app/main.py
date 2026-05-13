from fastapi import FastAPI, HTTPException, Query, Request
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

REQUIRED_TESLA_SCOPES = {"vehicle_charging_cmds"}

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


def _require_admin_auth(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    return auth_header.removeprefix("Bearer ").strip()

@app.get("/auth/tesla/start")
def tesla_start(user_id: str = Query(...)):
    try:
        return build_authorize_url(user_id=user_id, purpose="connect")
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

def _extract_scopes(token_payload: dict) -> set[str]:
    raw_scopes = token_payload.get("scope") or token_payload.get("scopes") or []
    if isinstance(raw_scopes, str):
        return {scope for scope in raw_scopes.split() if scope}
    if isinstance(raw_scopes, list):
        return {str(scope).strip() for scope in raw_scopes if str(scope).strip()}
    return set()


def _enforce_required_tesla_scopes(token_payload: dict):
    granted = _extract_scopes(token_payload)
    missing = REQUIRED_TESLA_SCOPES - granted
    if missing:
        raise TeslaOAuthError(
            "Tesla connection is missing required permissions: "
            + ", ".join(sorted(missing))
            + ". Please approve charging management in Tesla and try again."
        )


@app.get("/auth/tesla/redirect")
def tesla_redirect(
    user_id: str = Query(...),
    allow_charging_management: bool = Query(True),
):
    try:
        data = build_authorize_url(
            user_id=user_id,
            purpose="connect",
            allow_charging_management=allow_charging_management,
        )
        return RedirectResponse(data["url"])
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/auth/tesla/login/redirect")
def tesla_login_redirect(
    next: str = Query("/dashboard"),
    allow_charging_management: bool = Query(False),
):
    try:
        data = build_authorize_url(
            purpose="login",
            next_path=next,
            allow_charging_management=allow_charging_management,
        )
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
        allow_charging_management = bool(
            token_payload.get("allow_charging_management", True)
        )
        # Login can succeed without charging-management scope.
        # Enforce this scope only when charging control was requested.
        if allow_charging_management:
            _enforce_required_tesla_scopes(token_payload)
        repo = SupabaseRepo()

        if purpose == "login":
            identity = extract_identity(token_payload)
            login_session = repo.sign_in_from_tesla_identity(identity)
            user_id = login_session.get("user_id")
            if not user_id:
                raise TeslaOAuthError("Tesla login did not return a user id.")

            repo.upsert_tesla_connection(user_id=user_id, token_payload=token_payload)
            repo.upsert_participant_preferences(
                user_id=user_id,
                allow_charging_management=allow_charging_management,
            )
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
        repo.upsert_participant_preferences(
            user_id=user_id,
            allow_charging_management=allow_charging_management,
        )
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


@app.get("/admin/telemetry")
def admin_telemetry(request: Request):
    try:
        access_token = _require_admin_auth(request)
        repo = SupabaseRepo()
        repo.validate_admin_access_token(access_token)
        return repo.get_admin_telemetry()
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

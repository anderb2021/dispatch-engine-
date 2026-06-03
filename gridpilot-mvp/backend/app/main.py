from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from urllib.parse import quote

from . import config
from .tesla import (
    TeslaOAuthError,
    REQUIRED_TESLA_SCOPES,
    build_authorize_url,
    build_upgrade_link_url,
    exchange_code_for_token,
    extract_granted_scopes,
    extract_identity,
    get_state_context,
    get_vehicle_data,
    refresh_access_token,
    list_vehicles,
    verify_upgrade_link_token,
)
from .supabase_repo import SupabaseRepo
from .telemetry import poll_all_connected_vehicles, pull_location_for_user
from .telemetry_scheduler import start_telemetry_scheduler, stop_telemetry_scheduler

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


@app.on_event("startup")
def startup_telemetry_scheduler():
    start_telemetry_scheduler()


@app.on_event("shutdown")
def shutdown_telemetry_scheduler():
    stop_telemetry_scheduler()


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

def _enforce_required_tesla_scopes(token_payload: dict):
    granted = extract_granted_scopes(token_payload)
    missing = REQUIRED_TESLA_SCOPES - granted
    if missing:
        raise TeslaOAuthError(
            "Tesla connection is missing required permissions: "
            + ", ".join(sorted(missing))
            + ". On the Tesla authorization page, enable every GridPilot integration "
            + "(vehicle data, commands, charging, and location) and try again."
        )


def _is_expired_tesla_token_error(exc: TeslaOAuthError) -> bool:
    message = str(exc).lower()
    return "token expired" in message or "401" in message


def _refresh_tesla_tokens(repo: SupabaseRepo, user_id: str) -> str:
    existing_refresh_token = repo.get_refresh_token(user_id)
    refreshed_payload = refresh_access_token(existing_refresh_token)

    # Some providers omit refresh_token on refresh; keep the previous one.
    if not refreshed_payload.get("refresh_token"):
        refreshed_payload["refresh_token"] = existing_refresh_token

    repo.upsert_tesla_connection(user_id=user_id, token_payload=refreshed_payload)
    return repo.get_access_token(user_id)


@app.get("/auth/tesla/location-upgrade")
def tesla_location_upgrade(
    user_id: str = Query(...),
    next: str = Query("/dashboard"),
):
    """Soft re-authorization to add vehicle_location scope (logged-in users)."""
    try:
        data = build_authorize_url(
            user_id=user_id,
            purpose="location_upgrade",
            next_path=next if next.startswith("/") else "/dashboard",
            allow_charging_management=True,
            auto_login=False,
        )
        return RedirectResponse(data["url"])
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/auth/tesla/upgrade-link")
def tesla_upgrade_link(
    token: str = Query(...),
    next: str = Query("/dashboard"),
):
    """Email link entry: no GridPilot login; starts Tesla OAuth then signs user in."""
    try:
        payload = verify_upgrade_link_token(token)
        if not payload:
            raise TeslaOAuthError(
                "This upgrade link is invalid or expired. Request a new link from GridPilot."
            )
        user_id = payload.get("user_id")
        data = build_authorize_url(
            user_id=user_id,
            purpose="location_upgrade",
            next_path=next if next.startswith("/") else "/dashboard",
            allow_charging_management=True,
            auto_login=True,
        )
        return RedirectResponse(data["url"])
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


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
    allow_charging_management: bool = Query(True),
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
    auto_login = bool(state_context.get("auto_login"))
    error_redirect_base = (
        config.FRONTEND_TESLA_LOGIN_CALLBACK_URL
        if purpose == "login" or (purpose == "location_upgrade" and auto_login)
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
            repo.sync_marketplace_qualification_flags(user_id)
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
        repo.sync_marketplace_qualification_flags(user_id)
        location_upgraded = "true" if purpose == "location_upgrade" else "false"

        if purpose == "location_upgrade" and auto_login:
            identity = extract_identity(token_payload)
            login_session = repo.sign_in_from_tesla_identity(identity)
            session_user_id = login_session.get("user_id")
            if session_user_id != user_id:
                raise TeslaOAuthError(
                    "This Tesla account does not match your GridPilot profile. "
                    "Open the upgrade link from the same email we sent you."
                )
            access_token = quote(login_session.get("access_token") or "", safe="")
            refresh_token = quote(login_session.get("refresh_token") or "", safe="")
            next_path = quote(
                token_payload.get("next_path", "/dashboard"), safe="/"
            )
            return RedirectResponse(
                f"{config.FRONTEND_TESLA_LOGIN_CALLBACK_URL}?access_token={access_token}"
                f"&refresh_token={refresh_token}&next={next_path}"
                f"&connected=true&location_upgraded={location_upgraded}"
            )

        return RedirectResponse(
            f"{config.FRONTEND_CALLBACK_URL}?connected=true&dry_run={str(token_payload.get('dry_run', False)).lower()}&location_upgraded={location_upgraded}"
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
        try:
            vehicles_payload = list_vehicles(access_token=access_token)
        except TeslaOAuthError as exc:
            if not _is_expired_tesla_token_error(exc):
                raise
            access_token = _refresh_tesla_tokens(repo, user_id)
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
        retried_after_refresh = False
        for vehicle in vehicles:
            try:
                include_location = repo.user_has_vehicle_location_scope(user_id)
                telemetry_payload = get_vehicle_data(
                    tesla_vehicle_id=vehicle["tesla_vehicle_id"],
                    access_token=access_token,
                    include_location=include_location,
                )
            except TeslaOAuthError as exc:
                if retried_after_refresh or not _is_expired_tesla_token_error(exc):
                    raise
                access_token = _refresh_tesla_tokens(repo, user_id)
                retried_after_refresh = True
                include_location = repo.user_has_vehicle_location_scope(user_id)
                telemetry_payload = get_vehicle_data(
                    tesla_vehicle_id=vehicle["tesla_vehicle_id"],
                    access_token=access_token,
                    include_location=include_location,
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


@app.get("/admin/telemetry/summary")
def admin_telemetry_summary(request: Request):
    try:
        access_token = _require_admin_auth(request)
        repo = SupabaseRepo()
        repo.validate_admin_access_token(access_token)
        return repo.get_telemetry_summary()
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@app.get("/admin/telemetry/recent")
def admin_telemetry_recent(request: Request):
    try:
        access_token = _require_admin_auth(request)
        repo = SupabaseRepo()
        repo.validate_admin_access_token(access_token)
        return repo.get_recent_snapshots(limit=50)
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@app.get("/admin/flexibility/daily")
def admin_flexibility_daily(request: Request):
    try:
        access_token = _require_admin_auth(request)
        repo = SupabaseRepo()
        repo.validate_admin_access_token(access_token)
        return repo.get_daily_flexibility(days=7)
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@app.post("/admin/telemetry/poll")
def admin_telemetry_poll(request: Request):
    """Manual trigger for the same 15-minute polling job (admin only)."""
    try:
        access_token = _require_admin_auth(request)
        repo = SupabaseRepo()
        repo.validate_admin_access_token(access_token)
        return poll_all_connected_vehicles(repo)
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@app.post("/admin/tesla/pull-location")
def admin_tesla_pull_location(
    request: Request,
    user_id: str = Query(...),
    vehicle_id: str | None = Query(None),
    wake: bool = Query(True),
):
    """Manually wake (optional) and pull Tesla location into vehicle_snapshots."""
    try:
        access_token = _require_admin_auth(request)
        repo = SupabaseRepo()
        repo.validate_admin_access_token(access_token)
        return pull_location_for_user(
            repo,
            user_id,
            vehicle_id=vehicle_id,
            wake=wake,
        )
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


def _require_user_auth(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    token = auth_header.removeprefix("Bearer ").strip()
    repo = SupabaseRepo()
    return repo.validate_user_access_token(token)


@app.get("/me/marketplace-qualification")
def me_marketplace_qualification_get(request: Request):
    try:
        user_id = _require_user_auth(request)
        repo = SupabaseRepo()
        return repo.build_me_marketplace_response(user_id)
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@app.post("/me/marketplace-qualification")
def me_marketplace_qualification_post(
    request: Request,
    body: dict = Body(default={}),
):
    try:
        user_id = _require_user_auth(request)
        repo = SupabaseRepo()
        return repo.upsert_marketplace_qualification_user(user_id, body or {})
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@app.get("/admin/marketplace-qualification/summary")
def admin_marketplace_summary(request: Request):
    try:
        access_token = _require_admin_auth(request)
        repo = SupabaseRepo()
        repo.validate_admin_access_token(access_token)
        return repo.get_admin_marketplace_summary()
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@app.get("/admin/marketplace-qualification/users")
def admin_marketplace_users(request: Request):
    try:
        access_token = _require_admin_auth(request)
        repo = SupabaseRepo()
        repo.validate_admin_access_token(access_token)
        return repo.get_admin_marketplace_users()
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@app.get("/admin/tesla/upgrade-link")
def admin_tesla_upgrade_link(
    request: Request,
    user_id: str = Query(...),
    next: str = Query("/dashboard"),
):
    """Generate a signed email link for Tesla location / integration upgrade."""
    try:
        access_token = _require_admin_auth(request)
        repo = SupabaseRepo()
        repo.validate_admin_access_token(access_token)
        if not repo.user_exists(user_id):
            raise HTTPException(status_code=404, detail="User not found.")
        upgrade_url = build_upgrade_link_url(
            user_id, next_path=next if next.startswith("/") else "/dashboard"
        )
        return {
            "user_id": user_id,
            "upgrade_url": upgrade_url,
            "expires_in_days": max(1, config.TESLA_UPGRADE_LINK_TTL_SECONDS // 86400),
        }
    except TeslaOAuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

"""Background scheduler for Tesla telemetry polling.

Runs on a configurable interval (default every 6 hours) when
TELEMETRY_POLLING_ENABLED is true. Failures are logged but never crash the worker.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from . import config
from .telemetry import poll_all_connected_vehicles

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _run_poll_job() -> None:
    try:
        from .supabase_repo import SupabaseRepo

        repo = SupabaseRepo()
        result = poll_all_connected_vehicles(repo)
        logger.info(
            "Telemetry poll finished: users=%s vehicles=%s snapshots=%s offline=%s errors=%s",
            result.get("users_polled"),
            result.get("vehicles_polled"),
            result.get("snapshots_written"),
            result.get("offline_skipped"),
            len(result.get("errors") or []),
        )
        for err in (result.get("errors") or [])[:10]:
            logger.warning("Telemetry poll error: %s", err)
    except Exception:
        logger.exception("Telemetry poll job failed unexpectedly")


def start_telemetry_scheduler() -> None:
    global _scheduler
    if not config.TELEMETRY_POLLING_ENABLED:
        logger.info("Telemetry polling disabled (TELEMETRY_POLLING_ENABLED=false)")
        return
    if _scheduler is not None:
        return

    hours = max(0.25, float(config.TELEMETRY_POLL_INTERVAL_HOURS))

    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _run_poll_job,
        trigger="interval",
        hours=hours,
        id="tesla_telemetry_poll",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info("Telemetry scheduler started (every %s hour(s))", hours)


def stop_telemetry_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Telemetry scheduler stopped")

"""Placeholder for scheduled dispatch.

MVP recommendation: keep commands manual/dry-run until you have user consent,
virtual key setup, and production monitoring.
"""
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

def start_scheduler():
    if not scheduler.running:
        scheduler.start()

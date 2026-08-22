"""
app.py  -  Compounder Engine API + weekly scheduler
===================================================
A single Render Web Service that:
  - serves the computed screen as JSON to the frontend (GET /api/companies)
  - recomputes weekly in the background (APScheduler)
  - exposes a protected manual trigger (POST /api/refresh) so a Render Cron Job
    (or you) can also kick a refresh on demand

Data lives in DATA_DIR (mount a Render persistent disk there to survive
restarts; otherwise it's recomputed on boot).
"""

import os
import json
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from apscheduler.schedulers.background import BackgroundScheduler

import pipeline

app = FastAPI(title="Compounder Engine API", version="1.0")

# Frontend is a separate origin (static site) -> allow CORS.
ALLOWED = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware, allow_origins=ALLOWED, allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

REFRESH_TOKEN = os.environ.get("REFRESH_TOKEN", "")   # set this in Render env
_lock = threading.Lock()


def _refresh():
    """Run the pipeline under a lock so two triggers can't overlap."""
    if not _lock.acquire(blocking=False):
        return {"status": "already running"}
    try:
        payload = pipeline.run_pipeline()
        return {"status": "ok", "updated": payload["updated"], "count": payload["count"]}
    finally:
        _lock.release()


@app.on_event("startup")
def startup():
    # Compute once on boot if we have no data yet (e.g. fresh container).
    if not pipeline.DASHBOARD_JSON.exists():
        threading.Thread(target=_refresh, daemon=True).start()
    # Weekly refresh: Monday 09:00 UTC.
    sched = BackgroundScheduler(timezone="UTC")
    sched.add_job(_refresh, "cron", day_of_week="mon", hour=9, minute=0, id="weekly")
    sched.start()


@app.get("/api/health")
def health():
    return {"status": "up", "has_data": pipeline.DASHBOARD_JSON.exists()}


@app.get("/api/status")
def status():
    if pipeline.STATUS_JSON.exists():
        return json.loads(pipeline.STATUS_JSON.read_text(encoding="utf-8"))
    return {"updated": None, "count": 0}


@app.get("/api/companies")
def companies():
    if not pipeline.DASHBOARD_JSON.exists():
        raise HTTPException(503, "Data is still computing, try again shortly.")
    return FileResponse(pipeline.DASHBOARD_JSON, media_type="application/json")


@app.post("/api/refresh")
def refresh(x_refresh_token: str = Header(default="")):
    if REFRESH_TOKEN and x_refresh_token != REFRESH_TOKEN:
        raise HTTPException(401, "Invalid refresh token.")
    threading.Thread(target=_refresh, daemon=True).start()
    return JSONResponse({"status": "refresh started"})

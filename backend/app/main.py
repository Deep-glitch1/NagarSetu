from __future__ import annotations

import asyncio
from contextlib import suppress
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.connection import check_database_connection
from app.db.database import SessionLocal
from app.routers import auth
from app.routers import analytics_router
from app.routers import admin_management
from app.routers import citizen
from app.routers import citizen_complaint
from app.routers import employee_complaint
from app.routers import ml
from app.routers import sla_escalation
from app.routers import waste_collection
from app.services.sla_escalation_service import (
    SLA_ESCALATION_INTERVAL_SECONDS,
    run_sla_escalation_job,
)


logger = logging.getLogger("nagarseu.sla")

app = FastAPI(
    title="NagarSetu API",
    description="Civic Complaint Management System",
    version="1.0.0",
)

BASE_DIR = Path(__file__).resolve().parents[1]

UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOADS_DIR),
    name="uploads",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROUTERS
# ============================================================

app.include_router(auth.router)
app.include_router(citizen.router)
app.include_router(ml.router)
app.include_router(citizen_complaint.router)
app.include_router(employee_complaint.employee_router)
app.include_router(waste_collection.router)
app.include_router(waste_collection.employee_router)
app.include_router(waste_collection.admin_router)
app.include_router(sla_escalation.router)
app.include_router(analytics_router.router)
app.include_router(admin_management.router)

# ============================================================
# AUTOMATIC SLA ESCALATION WORKER
# ============================================================

sla_task: asyncio.Task | None = None


async def _sla_escalation_loop() -> None:
    """Run an idempotent SLA pass every five minutes."""

    while True:
        db = SessionLocal()
        try:
            result = run_sla_escalation_job(db)
            if result.new_escalations:
                logger.info(
                    "SLA escalation pass: %s complaints checked, %s new escalations.",
                    result.processed_complaints,
                    result.new_escalations,
                )
        except Exception:
            logger.exception("Automatic SLA escalation pass failed.")
        finally:
            db.close()

        await asyncio.sleep(SLA_ESCALATION_INTERVAL_SECONDS)


@app.on_event("startup")
async def start_sla_worker() -> None:
    global sla_task
    sla_task = asyncio.create_task(_sla_escalation_loop())


@app.on_event("shutdown")
async def stop_sla_worker() -> None:
    global sla_task
    if sla_task is None:
        return

    sla_task.cancel()
    with suppress(asyncio.CancelledError):
        await sla_task
    sla_task = None


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "message": "NagarSetu API is running",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health_check():
    database_status = check_database_connection()

    return {
        "status": "ok" if database_status else "error",
        "database": "connected" if database_status else "disconnected",
    }

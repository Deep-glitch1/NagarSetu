from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.connection import check_database_connection
from app.routers import employee_complaint
from app.routers import ml
from app.routers import auth
from app.routers import citizen
from app.routers import citizen_complaint
from app.routers import waste_collection
from app.routers import employee_complaint
from pathlib import Path
from fastapi.staticfiles import StaticFiles

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
# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "message": "NagarSetu API is running"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health_check():

    database_status = check_database_connection()

    return {
        "status": (
            "ok"
            if database_status
            else "error"
        ),
        "database": (
            "connected"
            if database_status
            else "disconnected"
        ),
    }

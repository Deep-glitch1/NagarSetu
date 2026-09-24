from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.connection import check_database_connection

from app.routers import auth
from app.routers import citizen

app = FastAPI(
    title="NagarSetu API",
    description="Civic Complaint Management System",
    version="1.0.0",
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
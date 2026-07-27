from fastapi import APIRouter
from app.api.v1.endpoints import health, tutor

# Main version 1 API Router hub
api_router = APIRouter()

# Register sub-routers (PDF uploads removed as indexing is automated on startup)
api_router.include_router(health.router, prefix="/health", tags=["System Health"])
api_router.include_router(tutor.router, prefix="/tutor", tags=["ANSI C Tutoring"])

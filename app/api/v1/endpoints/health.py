from fastapi import APIRouter, Response, status
from app.core.config import settings
from app.services.ai_service import ai_service
import time

router = APIRouter()

@router.get("", status_code=status.HTTP_200_OK)
def get_health():
    """
    Performs a system status check to verify the operational state of the ANSI C AI Tutor backend.
    """
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": {
            "local_inference_active": ai_service.ollama_enabled,
            "ollama_endpoint": settings.OLLAMA_URL,
            "active_model": settings.OLLAMA_MODEL,
            "vector_store_directory": settings.VECTOR_DB_DIR
        }
    }

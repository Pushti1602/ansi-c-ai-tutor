from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api.v1.api import api_router
from app.services.vector_service import vector_service
from app.services.ai_service import ai_service

# Define FastAPI Lifespan management for automatic indexing and warmups on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    # 1. Initialize FAISS index and warm up SentenceTransformer
    vector_service.initialize_index()
    
    # 2. Warm up local Ollama phi3 model into memory asynchronously
    await ai_service.warmup_model()
    
    yield
    # Shutdown actions
    # Clean up persistent connections on closure
    await ai_service.aclose()

# Initialize the FastAPI Application
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="An AI-powered tutoring backend designed to teach strict ANSI C (C89/C90) standards.",
    version=settings.VERSION,
    docs_url="/docs",       # Interactive Swagger UI API Documentation
    redoc_url="/redoc",     # Alternative ReDoc API Documentation
    lifespan=lifespan       # Setup lifespan events
)

# Configure Cross-Origin Resource Sharing (CORS)
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register the Version 1 Core API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Root"])
def read_root():
    """
    Exposes a welcoming root endpoint indicating backend operational health.
    """
    return {
        "message": f"Welcome to the {settings.PROJECT_NAME} API!",
        "documentation": "/docs",
        "health_check": f"{settings.API_V1_STR}/health",
        "status": "online"
    }

# Global Exception Handler to produce clean, readable error logs for students
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected server-side error occurred.",
            "error_type": exc.__class__.__name__,
            "message": str(exc)
        }
    )

if __name__ == "__main__":
    import uvicorn
    # Start the server locally when running this file directly
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

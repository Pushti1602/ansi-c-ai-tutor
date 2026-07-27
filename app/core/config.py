import os
from typing import List
from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "ANSI C AI Tutor Backend"
    API_V1_STR: str = "/api/v1"
    VERSION: str = "1.0.0"
    
    # CORS Origins (Comma-separated string of origins in .env, converted to List)
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Local Offline Inference Settings (Ollama)
    # Configured to use Phi-3 Mini locally for high-quality C completions
    OLLAMA_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "phi3:mini"
    
    # Performance Optimization Mode
    FAST_MODE: bool = True
    
    # Automated Startup Indexing Settings
    BOOKS_DIR: str = "books"
    BOOK_PATH: str = "books/ansi_c.pdf"
    VECTOR_DB_DIR: str = "vector_store"
    
    # Pydantic Settings configuration: allows loading from a .env file
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

# Instantiate the settings to be imported by other files
settings = Settings()

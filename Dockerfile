# ==========================================
# STAGE 1: Builder Stage
# ==========================================
FROM python:3.11-slim as builder

WORKDIR /build

# Install compilation dependencies for PyTorch/FAISS
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install dependencies to a local directory (wheels)
RUN pip install --no-cache-dir --user -r requirements.txt


# ==========================================
# STAGE 2: Final Runner Stage
# ==========================================
FROM python:3.11-slim as runner

WORKDIR /app

# Install runtime dependencies for FAISS / PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Add local bin to path (where pip installed libraries to)
ENV PATH=/root/.local/bin:$PATH

# Copy installed libraries from the builder stage
COPY --from=builder /root/.local /root/.local

# Copy application source code
COPY ./app ./app
COPY .env.example .env.example

# Create standard RAG folders
RUN mkdir -p books vector_store

# Expose port 8000
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PORT=8000

# Command to start the FastAPI application using uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

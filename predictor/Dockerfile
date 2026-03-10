FROM python:3.11-slim

WORKDIR /app

# CatBoost requires libgomp for OpenMP (Linux only, zero compilation needed)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgomp1 && \
    rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Install dependencies first (layer cache)
COPY pyproject.toml .
RUN uv sync --no-install-project

# Copy application code
COPY . .

# Model files land here at runtime (mounted or copied during build)
RUN mkdir -p /app/models

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

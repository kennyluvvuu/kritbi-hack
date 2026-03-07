FROM python:3.11-slim

WORKDIR /app

# System deps for CmdStan compilation
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        libgomp1 \
        curl && \
    rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Copy dependency spec and install (without project itself)
COPY pyproject.toml .
RUN uv sync --no-install-project

# Install CmdStan via cmdstanpy (required by Prophet's Stan backend)
RUN uv run python -c "import cmdstanpy; cmdstanpy.install_cmdstan(progress=False)"

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

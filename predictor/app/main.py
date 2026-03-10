"""CatBoost Water Level Predictor — FastAPI application.

Endpoints:
  GET  /health          — service status, model availability
  POST /predict         — hourly forecast for 6, 24, or 72 hours
  POST /retrain         — warm-start retrain on new IoT data (async)
  GET  /retrain/status  — status of last retrain job
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .features import build_features
from .model import predictor
from .schemas import (
    ForecastPoint,
    HealthResponse,
    PredictRequest,
    PredictResponse,
    RetrainRequest,
    RetrainResponse,
    RetrainStatusResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

VERSION = "1.0.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 CatBoost predictor v%s starting up", VERSION)
    logger.info("Models loaded: %s", predictor.models_loaded)
    yield
    logger.info("🛑 Predictor shutting down")


app = FastAPI(
    title="Kritbi — Water Level Predictor (CatBoost)",
    description="Flood prediction microservice for river Kacha. Forecasts water level at +6h, +24h, and +72h.",
    version=VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────── /health ───────────────────────────


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health():
    """Service liveness + model availability check."""
    return HealthResponse(
        status="ok",
        models_loaded=predictor.models_loaded,
        version=VERSION,
    )


# ─────────────────────────── /predict ───────────────────────────


@app.post("/predict", response_model=PredictResponse, tags=["prediction"])
async def predict(req: PredictRequest):
    """Generate an hourly water level forecast.

    Send the last **8+ days** of daily sensor readings (water level, temperature,
    soil moisture). Returns ``horizon`` hourly forecast points.

    The first call will fail with 503 if the model files have not been placed
    in ``predictor/models/`` yet. Run ``train_example.py`` to generate them.
    """
    horizons = [6, 24, 72] if req.horizon == "all" else [int(req.horizon)]
    for h in horizons:
        if not predictor.models_loaded.get(f"{h}h"):
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Model for {h}h not loaded. "
                    "Run train_example.py and place model_Xh.cbm in predictor/models/."
                ),
            )

    try:
        raw = pd.DataFrame([r.model_dump() for r in req.recent_data])
        features_df = build_features(raw)

        if features_df.empty:
            raise HTTPException(
                status_code=422,
                detail="Not enough data to build features after lag computation (need ≥ 8 rows).",
            )

        points = predictor.predict(features_df, horizon=req.horizon)

        return PredictResponse(
            forecast=[ForecastPoint(horizon=p["horizon"], yhat=p["yhat"]) for p in points],
            model_version=f"catboost-v1.0",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Prediction error")
        raise HTTPException(status_code=500, detail=f"Prediction error: {e}")


# ─────────────────────────── /retrain ───────────────────────────


@app.post("/retrain", response_model=RetrainResponse, status_code=202, tags=["training"])
async def retrain(req: RetrainRequest):
    """Trigger warm-start retraining on new IoT sensor data.

    Retraining runs in the background and returns **202 Accepted** immediately.
    Check progress via ``GET /retrain/status``.

    The existing model weights are preserved via CatBoost ``init_model`` —
    12 years of ERA5 knowledge is kept and adapted to the new readings.

    Minimum **30 data points** required for meaningful retraining.
    """
    if predictor.retrain_status.status == "running":
        raise HTTPException(status_code=409, detail="Retraining already in progress.")

    df = pd.DataFrame([r.model_dump() for r in req.data])

    predictor.retrain_async(df, horizon=req.horizon)

    return RetrainResponse(
        status="accepted",
        data_points=len(df),
        message=f"Warm-start retraining started for horizon={req.horizon} on {len(df)} samples.",
    )


@app.get("/retrain/status", response_model=RetrainStatusResponse, tags=["training"])
async def retrain_status():
    """Check the status of the last retrain job."""
    s = predictor.retrain_status
    return RetrainStatusResponse(
        status=s.status,
        last_run=s.last_run,
        message=s.message,
    )

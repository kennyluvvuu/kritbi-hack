"""Water Level Prediction Microservice.

FastAPI application wrapping Facebook Prophet to forecast river
water levels based on historical sensor readings.
"""

import logging
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .model import predictor
from .schemas import (
    HealthResponse,
    PredictRequest,
    PredictResponse,
    ForecastPoint,
    TrainRequest,
    TrainResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

VERSION = "1.0.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Predictor service v%s starting up", VERSION)
    yield
    logger.info("🛑 Predictor service shutting down")


app = FastAPI(
    title="Kritbi — Water Level Predictor",
    description="Prophet-based forecast microservice for river Kacha flood prediction system",
    version=VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ───────────────────────────── endpoints ─────────────────────────────


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check():
    """Service health check."""
    return HealthResponse(
        status="ok",
        model_loaded=predictor.is_trained,
        version=VERSION,
    )


@app.post("/predict", response_model=PredictResponse, tags=["prediction"])
async def predict(req: PredictRequest):
    """Generate a water level forecast.

    Accepts historical observations and returns a forecast for the
    requested number of hours with confidence intervals.

    If the model has not been trained via ``/train``, it will be
    auto-fitted on the incoming data.
    """
    try:
        df = pd.DataFrame([{"ds": p.ds, "y": p.y} for p in req.data])
        df["ds"] = pd.to_datetime(df["ds"], utc=True).dt.tz_localize(None)
        df = df.sort_values("ds").reset_index(drop=True)

        forecast_df = predictor.predict(
            df,
            periods=req.periods,
            interval_width=req.interval_width,
        )

        forecast_points = [
            ForecastPoint(
                ds=row["ds"],
                yhat=round(row["yhat"], 4),
                yhat_lower=round(row["yhat_lower"], 4),
                yhat_upper=round(row["yhat_upper"], 4),
                trend=round(row["trend"], 4) if pd.notna(row.get("trend")) else None,
            )
            for _, row in forecast_df.iterrows()
        ]

        return PredictResponse(
            forecast=forecast_points,
            periods=req.periods,
            interval_width=req.interval_width,
            model_info={"auto_trained": not predictor.is_trained or True},
        )

    except Exception as e:
        logger.exception("Prediction failed")
        raise HTTPException(status_code=500, detail=f"Prediction error: {e}")


@app.post("/train", response_model=TrainResponse, tags=["training"])
async def train(req: TrainRequest):
    """Train (or retrain) the Prophet model on fresh data.

    This replaces the current model entirely. Use when a significant
    amount of new data has been collected and you want to improve
    forecast accuracy.
    """
    try:
        df = pd.DataFrame([{"ds": p.ds, "y": p.y} for p in req.data])
        df["ds"] = pd.to_datetime(df["ds"], utc=True).dt.tz_localize(None)
        df = df.sort_values("ds").reset_index(drop=True)

        info = predictor.train(
            df,
            seasonality_mode=req.seasonality_mode,
            changepoint_prior_scale=req.changepoint_prior_scale,
        )

        return TrainResponse(
            status="trained",
            data_points=info["data_points"],
            message=f"Model trained on {info['data_points']} data points "
                    f"(seasonality={info['seasonality_mode']}, "
                    f"cp_scale={info['changepoint_prior_scale']})",
        )

    except Exception as e:
        logger.exception("Training failed")
        raise HTTPException(status_code=500, detail=f"Training error: {e}")

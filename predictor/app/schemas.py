"""Pydantic schemas for the CatBoost prediction microservice."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SensorReading(BaseModel):
    """One day of sensor data — only fields the IoT device will provide."""
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    lvl_sm: float = Field(..., description="Water level, cm")
    t_max: float = Field(..., description="Max daily air temperature, °C")
    t_min: float = Field(..., description="Min daily air temperature, °C")
    SMsurf: float = Field(..., ge=0.0, le=1.0, description="Surface soil moisture (0–1)")


class PredictRequest(BaseModel):
    recent_data: list[SensorReading] = Field(
        ...,
        min_length=8,
        description="Recent daily readings (minimum 8 to build 7 lag features)",
    )
    horizon: Literal[24, 48, "all"] = Field(
        default="all",
        description="Forecast horizon: 24 (next day), 48 (day after), or 'all'",
    )


class ForecastPoint(BaseModel):
    horizon: int = Field(..., description="Hours ahead (24 or 48)")
    yhat: float = Field(..., description="Predicted water level, cm")


class PredictResponse(BaseModel):
    forecast: list[ForecastPoint]
    model_version: str


class RetrainRequest(BaseModel):
    data: list[SensorReading] = Field(
        ...,
        min_length=30,
        description="New sensor readings for warm-start retraining (minimum 30 days)",
    )
    horizon: Literal[24, 48, "all"] = Field(
        default="all",
        description="Which model to retrain: 24, 48, or both (all)",
    )


class RetrainResponse(BaseModel):
    status: str
    data_points: int
    message: str


class RetrainStatusResponse(BaseModel):
    status: Literal["idle", "running", "done", "error"]
    last_run: Optional[datetime]
    message: Optional[str]


class HealthResponse(BaseModel):
    status: str
    models_loaded: dict[str, bool]
    version: str

"""Pydantic schemas for request/response validation."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DataPoint(BaseModel):
    """Single observation: timestamp + water level."""
    ds: datetime = Field(..., description="Timestamp of the observation")
    y: float = Field(..., description="Water level in meters")


class PredictRequest(BaseModel):
    """Request body for the /predict endpoint."""
    data: list[DataPoint] = Field(
        ...,
        min_length=10,
        description="Historical water level observations (minimum 10 points)",
    )
    periods: int = Field(
        default=72,
        ge=1,
        le=720,
        description="Number of hours to forecast into the future",
    )
    interval_width: float = Field(
        default=0.95,
        ge=0.5,
        le=0.99,
        description="Width of the uncertainty interval (0.5–0.99)",
    )


class ForecastPoint(BaseModel):
    """Single forecast point with confidence interval."""
    ds: datetime
    yhat: float = Field(..., description="Predicted water level")
    yhat_lower: float = Field(..., description="Lower bound of confidence interval")
    yhat_upper: float = Field(..., description="Upper bound of confidence interval")
    trend: Optional[float] = None


class PredictResponse(BaseModel):
    """Response body for the /predict endpoint."""
    forecast: list[ForecastPoint]
    periods: int
    interval_width: float
    model_info: dict = Field(default_factory=dict)


class TrainRequest(BaseModel):
    """Request body for the /train endpoint."""
    data: list[DataPoint] = Field(
        ...,
        min_length=10,
        description="Training data (minimum 10 points)",
    )
    seasonality_mode: str = Field(
        default="additive",
        description="'additive' or 'multiplicative'",
    )
    changepoint_prior_scale: float = Field(
        default=0.05,
        ge=0.001,
        le=0.5,
        description="Flexibility of trend changepoints",
    )


class TrainResponse(BaseModel):
    """Response body for the /train endpoint."""
    status: str
    data_points: int
    message: str


class HealthResponse(BaseModel):
    """Response body for the /health endpoint."""
    status: str
    model_loaded: bool
    version: str

"""Prophet model wrapper for water level forecasting."""

from __future__ import annotations

import logging
from typing import Optional
from threading import Lock

import pandas as pd
from prophet import Prophet

logger = logging.getLogger(__name__)


class WaterLevelPredictor:
    """Thread-safe wrapper around Facebook Prophet for water level prediction.

    The model can either be trained on demand via /train or will be
    auto-fitted on first /predict call using the incoming data.
    """

    def __init__(self) -> None:
        self._model: Prophet | None = None
        self._lock = Lock()
        self._is_trained = False

    # ──────────────────────────── public API ────────────────────────────

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    def train(
        self,
        df: pd.DataFrame,
        seasonality_mode: str = "additive",
        changepoint_prior_scale: float = 0.05,
    ) -> dict:
        """Fit a new Prophet model on the provided data.

        Args:
            df: DataFrame with columns ``ds`` (datetime) and ``y`` (float).
            seasonality_mode: ``'additive'`` or ``'multiplicative'``.
            changepoint_prior_scale: Flexibility of trend changepoints.

        Returns:
            dict with training metadata.
        """
        with self._lock:
            model = Prophet(
                seasonality_mode=seasonality_mode,
                changepoint_prior_scale=changepoint_prior_scale,
                daily_seasonality=True,
                weekly_seasonality=True,
                yearly_seasonality=True,
            )
            # Suppress verbose Prophet/Stan output
            model.fit(df)

            self._model = model
            self._is_trained = True

            logger.info(
                "Model trained on %d data points (seasonality=%s, cp_scale=%.4f)",
                len(df),
                seasonality_mode,
                changepoint_prior_scale,
            )

            return {
                "data_points": len(df),
                "seasonality_mode": seasonality_mode,
                "changepoint_prior_scale": changepoint_prior_scale,
            }

    def predict(
        self,
        df: pd.DataFrame,
        periods: int = 72,
        interval_width: float = 0.95,
    ) -> pd.DataFrame:
        """Generate a forecast.

        If the model has not been trained yet, it will be auto-fitted on
        the incoming data first.

        Args:
            df: Historical data with columns ``ds`` and ``y``.
            periods: Number of hours to forecast.
            interval_width: Width of the uncertainty interval.

        Returns:
            DataFrame with ``ds``, ``yhat``, ``yhat_lower``, ``yhat_upper``,
            ``trend`` columns — **only the future rows** (no in-sample).
        """
        with self._lock:
            # Auto-train if not already trained
            if not self._is_trained:
                logger.info("Auto-training model on incoming data (%d points)", len(df))
                model = Prophet(
                    interval_width=interval_width,
                    daily_seasonality=True,
                    weekly_seasonality=True,
                    yearly_seasonality=True,
                )
                model.fit(df)
                self._model = model
                self._is_trained = True
            else:
                # Override interval width on existing model
                self._model.interval_width = interval_width

            future = self._model.make_future_dataframe(periods=periods, freq="h")
            forecast = self._model.predict(future)

            # Return only the future part (beyond hist data)
            last_hist_ts = df["ds"].max()
            future_forecast = forecast[forecast["ds"] > last_hist_ts]

            return future_forecast[["ds", "yhat", "yhat_lower", "yhat_upper", "trend"]]


# Module-level singleton
predictor = WaterLevelPredictor()

"""Thread-safe CatBoost model wrapper with warm-start retraining support."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock, Thread
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

MODELS_DIR = Path(os.getenv("MODELS_DIR", "/app/models"))
MODEL_PATHS = {
    6: MODELS_DIR / "model_6h.cbm",
    24: MODELS_DIR / "model_24h.cbm",
    72: MODELS_DIR / "model_72h.cbm",
}

VERSION = "catboost-1.0"


class RetainStatus:
    def __init__(self) -> None:
        self.status: str = "idle"      # idle | running | done | error
        self.last_run: Optional[datetime] = None
        self.message: Optional[str] = None


class WaterLevelPredictor:
    """Loads and manages CatBoost models (6h, 24h and 72h horizons).

    Supports:
    - Lazy loading at startup
    - Thread-safe predict / warm-start retrain
    - Async retrain (runs in background, returns immediately)
    """

    def __init__(self) -> None:
        self._models: dict[int, object] = {}
        self._lock = Lock()
        self.retrain_status = RetainStatus()
        self._load_models()

    # ─────────────────────────── Loading ───────────────────────────

    def _load_models(self) -> None:
        """Try to load models from disk. Missing files are skipped (not fatal)."""
        try:
            from catboost import CatBoostRegressor  # noqa: PLC0415
        except ImportError:
            logger.error("catboost not installed")
            return

        for horizon, path in MODEL_PATHS.items():
            if path.exists():
                try:
                    model = CatBoostRegressor()
                    model.load_model(str(path))
                    self._models[horizon] = model
                    logger.info("Loaded model_%dh from %s", horizon, path)
                except Exception as e:
                    logger.warning("Could not load model_%dh: %s", horizon, e)
            else:
                logger.warning(
                    "Model file not found: %s (run train_example.py first)", path
                )

    @property
    def models_loaded(self) -> dict[str, bool]:
        return {f"{h}h": (h in self._models) for h in [6, 24, 72]}

    # ─────────────────────────── Predict ───────────────────────────

    def predict(self, df: pd.DataFrame, horizon: int | str) -> list[dict]:
        """Generate point forecasts for the given horizon.

        Args:
            df: DataFrame with ``FEATURE_COLS`` (output of build_features).
            horizon: 6, 24, 72, or "all".

        Returns:
            List of ``{horizon: int, yhat: float}`` dicts.
        """
        from .features import FEATURE_COLS  # noqa: PLC0415

        horizons = [6, 24, 72] if horizon == "all" else [int(horizon)]
        points = []

        with self._lock:
            X = df[FEATURE_COLS].tail(1)
            for h in horizons:
                if h not in self._models:
                    raise ValueError(f"Model for {h}h not loaded.")
                
                model = self._models[h]
                predicted_level = float(model.predict(X)[0])
                points.append({"horizon": h, "yhat": round(predicted_level, 2)})

        return points

    # ─────────────────────────── Retrain ───────────────────────────

    def retrain_async(self, df: pd.DataFrame, horizon: int | str) -> None:
        """Trigger warm-start retraining in a background thread."""
        horizons = [6, 24, 72] if horizon == "all" else [int(horizon)]
        thread = Thread(target=self._retrain_worker, args=(df, horizons), daemon=True)
        self.retrain_status.status = "running"
        self.retrain_status.message = f"Retraining model(s): {horizons}"
        thread.start()

    def _retrain_worker(self, df: pd.DataFrame, horizons: list[int]) -> None:
        from catboost import CatBoostRegressor  # noqa: PLC0415
        from .features import build_training_set  # noqa: PLC0415

        try:
            MODELS_DIR.mkdir(parents=True, exist_ok=True)
            for h in horizons:
                X, y = build_training_set(df, horizon_hours=h)
                if len(X) < 10:
                    raise ValueError(
                        f"Not enough samples after feature build: {len(X)}"
                    )

                init_model = self._models.get(h)  # None → train from scratch
                model = CatBoostRegressor(
                    iterations=500,
                    learning_rate=0.05,
                    depth=6,
                    loss_function="RMSE",
                    verbose=False,
                )
                model.fit(X, y, init_model=init_model)

                path = MODEL_PATHS[h]
                model.save_model(str(path))

                with self._lock:
                    self._models[h] = model

                logger.info("Retrained model_%dh on %d samples → %s", h, len(X), path)

            self.retrain_status.status = "done"
            self.retrain_status.last_run = datetime.now(tz=timezone.utc)
            self.retrain_status.message = (
                f"Retrained {horizons} on {len(df)} data points"
            )
        except Exception as e:
            logger.exception("Retraining failed")
            self.retrain_status.status = "error"
            self.retrain_status.message = str(e)


# Module-level singleton
predictor = WaterLevelPredictor()

#!/usr/bin/env python3
"""Training script for the Baseline water level prediction models.

Usage:
    python train_baseline.py --dataset path/to/data.csv --out-dir predictor/models/
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib

# Make sure we can import from the app package when run as a script
sys.path.insert(0, str(Path(__file__).parent))

from app.features import build_training_set
from train_example import load_and_normalize

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def train_model(X: pd.DataFrame, y: pd.Series, horizon: int) -> LinearRegression:
    logger.info("Training baseline_model_%dh on %d samples …", horizon, len(X))
    model = LinearRegression()
    model.fit(X, y)
    return model

def evaluate(model: LinearRegression, X_test: pd.DataFrame, y_test: pd.Series, horizon: int) -> None:
    preds = model.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
    mae = float(mean_absolute_error(y_test, preds))
    logger.info("baseline_model_%dh  → RMSE: %.2f cm  |  MAE: %.2f cm", horizon, rmse, mae)

def main() -> None:
    parser = argparse.ArgumentParser(description="Train Baseline water level models")
    parser.add_argument("--dataset", required=True, help="Path to input CSV file")
    parser.add_argument(
        "--out-dir",
        default="models",
        help="Directory to save model files (default: models/)",
    )
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = load_and_normalize(args.dataset)
    logger.info("Dataset range: %s → %s", df['date'].min().date(), df['date'].max().date())

    for horizon_hours in [6, 24, 72]:
        X, y = build_training_set(df, horizon_hours=horizon_hours)
        logger.info("Horizon %dh: %d training samples", horizon_hours, len(X))

        # Time-based train/test split — last 365 days as validation
        split_idx = max(1, len(X) - 365)

        X_train, y_train = X.iloc[:split_idx], y.iloc[:split_idx]
        X_test, y_test = X.iloc[split_idx:], y.iloc[split_idx:]

        model = train_model(X_train, y_train, horizon_hours)
        evaluate(model, X_test, y_test, horizon_hours)

        out_path = out_dir / f"baseline_model_{horizon_hours}h.joblib"
        joblib.dump(model, out_path)
        logger.info("✅ Saved Baseline → %s", out_path)

    logger.info("\n🎉 Done! Baseline models are ready.")


if __name__ == "__main__":
    main()

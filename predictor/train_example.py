#!/usr/bin/env python3
"""Training script for the CatBoost water level prediction models.

Usage:
    python train_example.py --dataset path/to/data.csv --out-dir predictor/models/

CSV format expected (ERA5 dataset):
    date,gauge_id,lvl_sm,q_cms_s,lvl_mbs,q_mm_day,t_max_e5l,t_max_e5,t_min_e5l,...

Column mapping from ERA5 dataset → model features:
    t_max_e5l → t_max
    t_min_e5l → t_min
    SMsurf    → SMsurf  (same name)
    lvl_sm    → lvl_sm  (same name)
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

# Make sure we can import from the app package when run as a script
sys.path.insert(0, str(Path(__file__).parent))

from app.features import FEATURE_COLS, build_training_set

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def load_and_normalize(csv_path: str) -> pd.DataFrame:
    """Load CSV and normalize column names to match model expectations."""
    df = pd.read_csv(csv_path, parse_dates=["date"])
    logger.info("Loaded %d rows from %s", len(df), csv_path)

    # Map ERA5 column names → model feature names
    col_map = {
        "t_max_e5l": "t_max",
        "t_min_e5l": "t_min",
        # SMsurf and lvl_sm already match
    }
    df = df.rename(columns=col_map)

    required = ["date", "lvl_sm", "t_max", "t_min", "SMsurf"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            f"Missing required columns: {missing}. "
            f"Available columns: {df.columns.tolist()}"
        )

    return df[required].dropna().sort_values("date").reset_index(drop=True)


def train_model(X: pd.DataFrame, y: pd.Series, horizon: int) -> CatBoostRegressor:
    logger.info("Training model_%dh on %d samples …", horizon, len(X))
    model = CatBoostRegressor(
        iterations=1000,
        learning_rate=0.05,
        depth=6,
        loss_function="RMSE",
        eval_metric="MAE",
        early_stopping_rounds=50,
        verbose=100,
        random_seed=42,
    )
    # Time-based train/test split — last 365 days as validation
    split_idx = max(1, len(X) - 365)
    X_train, X_val = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_val = y.iloc[:split_idx], y.iloc[split_idx:]

    model.fit(
        X_train, y_train,
        eval_set=(X_val, y_val),
    )
    return model


def evaluate(model: CatBoostRegressor, X_test: pd.DataFrame, y_test: pd.Series, horizon: int) -> None:
    preds = model.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
    mae = float(mean_absolute_error(y_test, preds))
    logger.info("model_%dh  → RMSE: %.2f cm  |  MAE: %.2f cm", horizon, rmse, mae)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train CatBoost water level models")
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

        split_idx = max(1, len(X) - 365)
        model = train_model(X.iloc[:split_idx], y.iloc[:split_idx], horizon_hours)
        evaluate(model, X.iloc[split_idx:], y.iloc[split_idx:], horizon_hours)

        out_path = out_dir / f"model_{horizon_hours}h.cbm"
        model.save_model(str(out_path))
        logger.info("✅ Saved → %s", out_path)

    logger.info("\n🎉 Done! Place the .cbm files in predictor/models/ and rebuild Docker.")
    logger.info("   docker compose up --build predictor")


if __name__ == "__main__":
    main()

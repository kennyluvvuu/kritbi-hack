#!/usr/bin/env python3
"""Script to generate submission.csv for the Hackathon.

Loads the provided dataset (e.g. 9326_1.csv), extracts the last available features,
runs predictions for 6h, 24h, 72h horizons using trained CatBoost models,
and saves the output to submission.csv.

Usage:
    python create_submission.py --dataset path/to/test_data.csv --models-dir predictor/models/ --out submission.csv
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
import datetime

import pandas as pd
from catboost import CatBoostRegressor

sys.path.insert(0, str(Path(__file__).parent))

from app.features import build_features
from train_example import load_and_normalize

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def main() -> None:
    parser = argparse.ArgumentParser(description="Create submission.csv")
    parser.add_argument("--dataset", required=True, help="Path to input test CSV file (e.g. 9326_1.csv)")
    parser.add_argument("--models-dir", default="models", help="Directory containing .cbm models")
    parser.add_argument("--out", default="submission.csv", help="Output CSV path")
    args = parser.parse_args()

    models_dir = Path(args.models_dir)

    # 1. Load and normalize data
    df = load_and_normalize(args.dataset)
    if df.empty:
        logger.error("Dataset is empty after loading and normalization!")
        return

    # 2. Extract features
    features_df = build_features(df)
    if features_df.empty:
        logger.error("Feature building resulted in an empty dataset!")
        return

    # Use the last available row for prediction
    last_features = features_df.iloc[[-1]]
    last_date = df['date'].max()
    logger.info("Making predictions from last available date: %s", last_date)

    predictions = []

    # 3. Load models and predict
    for horizon_hours in [6, 24, 72]:
        model_path = models_dir / f"model_{horizon_hours}h.cbm"
        if not model_path.exists():
            logger.error("Model file not found: %s", model_path)
            return

        model = CatBoostRegressor()
        model.load_model(str(model_path))

        pred_value = float(model.predict(last_features)[0])
        logger.info("Predicted %dh horizon: %.2f", horizon_hours, pred_value)

        target_date = last_date + pd.Timedelta(hours=horizon_hours)

        predictions.append({
            "date": target_date.strftime("%Y-%m-%d %H:%M:%S"),
            "horizon": f"{horizon_hours}h",
            "water_level_rel": pred_value
        })

    # 4. Save to CSV
    submission_df = pd.DataFrame(predictions)
    submission_df.to_csv(args.out, index=False)
    logger.info("✅ Saved submission to %s", args.out)

if __name__ == "__main__":
    main()

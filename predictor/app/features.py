"""Feature engineering for CatBoost water-level model.

All features are computed exclusively from IoT-available columns:
  lvl_sm, t_max, t_min, SMsurf, date

This ensures feature parity between the ERA5-trained base model
and the IoT warm-start retraining.
"""

from __future__ import annotations

import pandas as pd

# Ordered list — must match exactly between training and inference
FEATURE_COLS = [
    # Raw sensor values
    "lvl_sm",
    "t_max",
    "t_min",
    "SMsurf",
    # Lag features (water level)
    "lvl_lag_1",
    "lvl_lag_2",
    "lvl_lag_3",
    "lvl_lag_4",
    "lvl_lag_5",
    "lvl_lag_6",
    "lvl_lag_7",
    # Rolling statistics
    "lvl_roll_mean_7",
    "lvl_roll_std_3",
    # Rate of change
    "level_velocity",
    # Date / seasonality
    "day_of_year",
    "month",
    "day_of_week",
]

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build model features from a daily sensor DataFrame.

    Args:
        df: DataFrame with columns ``[date, lvl_sm, t_max, t_min, SMsurf]``.
            ``date`` must be parseable as datetime.

    Returns:
        DataFrame with all ``FEATURE_COLS`` columns, NaN rows dropped.
        The index is reset and aligned with the original date order.
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    # Lag features
    for lag in range(1, 8):
        df[f"lvl_lag_{lag}"] = df["lvl_sm"].shift(lag)

    # Rolling stats
    df["lvl_roll_mean_7"] = df["lvl_sm"].rolling(7, min_periods=4).mean()
    df["lvl_roll_std_3"] = df["lvl_sm"].rolling(3, min_periods=2).std().fillna(0)

    # Rate of change (speed of level rise/fall)
    df["level_velocity"] = df["lvl_sm"] - df["lvl_lag_1"]

    # Date / seasonality features
    df["day_of_year"] = df["date"].dt.dayofyear
    df["month"] = df["date"].dt.month
    df["day_of_week"] = df["date"].dt.dayofweek

    return df[FEATURE_COLS].dropna().reset_index(drop=True)


def build_training_set(
    df: pd.DataFrame,
    horizon_days: int,
) -> tuple[pd.DataFrame, pd.Series]:
    """Build (X, y) for Direct multi-step training.

    Args:
        df: Raw daily DataFrame with ``[date, lvl_sm, t_max, t_min, SMsurf]``.
        horizon_days: How many days ahead to predict (1 → 24h, 2 → 48h).

    Returns:
        X: Feature matrix aligned with y.
        y: Target series (``lvl_sm`` shifted by ``horizon_days``).
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    # Target: water level N days into the future
    df["target"] = df["lvl_sm"].shift(-horizon_days)

    features = build_features(df)
    aligned = df.loc[features.index, "target"]

    mask = aligned.notna()
    return features[mask].reset_index(drop=True), aligned[mask].reset_index(drop=True)

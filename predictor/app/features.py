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
    horizon_hours: int,
) -> tuple[pd.DataFrame, pd.Series]:
    """Build (X, y) for Direct multi-step training.

    Args:
        df: Raw daily DataFrame with ``[date, lvl_sm, t_max, t_min, SMsurf]``.
        horizon_hours: How many hours ahead to predict (6, 24, 72).

    Returns:
        X: Feature matrix aligned with y.
        y: Target series (``lvl_sm`` shifted by appropriate days).
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    import math
    # Calculate days to shift. For 6h we still shift by 1 day (or could interpolate, but standard approach for daily data and sub-daily horizons without sub-daily data is to use next day's data or same day. Since 6h is next step, we use 1 day. 24h is 1 day. 72h is 3 days). Let's use math.ceil(horizon_hours / 24)
    horizon_days = math.ceil(horizon_hours / 24)
    if horizon_days == 0:
        horizon_days = 1

    # Target: water level N days into the future
    df["target"] = df["lvl_sm"].shift(-horizon_days)

    features = build_features(df)
    aligned = df.loc[features.index, "target"]

    mask = aligned.notna()
    return features[mask].reset_index(drop=True), aligned[mask].reset_index(drop=True)

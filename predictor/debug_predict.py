
import pandas as pd
from catboost import CatBoostRegressor
from app.features import build_features, FEATURE_COLS
import os

def debug():
    # Extreme persistent flood: 10 days of 250cm
    data = []
    for i in range(14, 24):
        data.append({"date": f"2026-04-{i}", "lvl_sm": 250.0, "t_max": 25.0, "t_min": 20.0, "SMsurf": 1.0})

    df = pd.DataFrame(data)
    
    # We need 8 points for lags to not be NaN
    # Let's pad with dummy April values
    padding = []
    for i in range(12, 20):
        padding.append({"date": f"2026-04-{i}", "lvl_sm": 80.0, "t_max": 10.0, "t_min": 5.0, "SMsurf": 0.5})
    
    full_df = pd.DataFrame(padding + data)
    features = build_features(full_df)
    
    print("\n--- Features for Today ---")
    today_feat = features.tail(1)
    pd.set_option('display.max_columns', None)
    print(today_feat)
    
    print("\n--- Predictions ---")
    model_24 = CatBoostRegressor()
    model_24.load_model("models/model_24h.cbm")
    
    pred_24 = model_24.predict(today_feat[FEATURE_COLS])[0]
    print(f"Prediction for tomorrow (+24h): {pred_24:.2f} cm")
    
    model_48 = CatBoostRegressor()
    model_48.load_model("models/model_48h.cbm")
    pred_48 = model_48.predict(today_feat[FEATURE_COLS])[0]
    print(f"Prediction for after tomorrow (+48h): {pred_48:.2f} cm")

if __name__ == "__main__":
    debug()

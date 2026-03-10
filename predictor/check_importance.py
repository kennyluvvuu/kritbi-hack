
import pandas as pd
from catboost import CatBoostRegressor
from app.features import FEATURE_COLS

def check_importance():
    model = CatBoostRegressor()
    model.load_model("models/model_24h.cbm")
    
    importances = model.get_feature_importance()
    feat_imp = pd.Series(importances, index=FEATURE_COLS).sort_values(ascending=False)
    
    print("\n--- Feature Importances (model_24h) ---")
    print(feat_imp)

if __name__ == "__main__":
    check_importance()

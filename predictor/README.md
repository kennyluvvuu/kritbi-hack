# Predictor Pipeline

This directory contains the ML-pipeline for water level prediction. The models are built using `CatBoost` for advanced forecasting and a simple `LinearRegression` as a baseline. The prediction horizons are 6h, 24h, and 72h.

## Requirements

Ensure your environment is set up. You can install the required packages via:
```bash
pip install pandas scikit-learn catboost joblib
```

## Usage

### 1. Train the Baseline Model

The baseline model provides a simple linear regression over the available features for the 3 horizons.

```bash
python train_baseline.py --dataset path/to/dataset.csv --out-dir models/
```

### 2. Train the CatBoost Model

This trains the main predictive models for 6h, 24h, and 72h horizons using `CatBoost`. The `.cbm` model files will be saved to the specified output directory.

```bash
python train_example.py --dataset path/to/dataset.csv --out-dir models/
```

### 3. Generate `submission.csv`

To generate the final predictions required for the hackathon (using the trained CatBoost models), run the submission script:

```bash
python create_submission.py --dataset path/to/test_dataset.csv --models-dir models/ --out submission.csv
```
This script loads the most recent row of data from your dataset, applies the trained models, and outputs `submission.csv` with predictions for `6h`, `24h`, and `72h`.

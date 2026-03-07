"""Tests for the predictor microservice API."""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.model import WaterLevelPredictor, predictor


@pytest.fixture
def client():
    """Create a fresh test client."""
    return TestClient(app)


@pytest.fixture
def sample_data() -> list[dict]:
    """Generate realistic water level data (200 hourly points)."""
    import math
    import random

    base_time = datetime(2025, 3, 1)
    data = []
    for i in range(200):
        ts = base_time + timedelta(hours=i)
        # Base level ~2.5m with daily sinusoidal variation ±0.3m + noise
        level = 2.5 + 0.3 * math.sin(2 * math.pi * i / 24) + random.gauss(0, 0.05)
        data.append({"ds": ts.isoformat(), "y": round(level, 3)})
    return data


# ──────────────────────── Health ────────────────────────


class TestHealth:
    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "version" in body
        assert isinstance(body["model_loaded"], bool)


# ──────────────────────── Predict ────────────────────────


class TestPredict:
    def test_predict_returns_forecast(self, client, sample_data):
        resp = client.post("/predict", json={
            "data": sample_data,
            "periods": 24,
            "interval_width": 0.9,
        })
        assert resp.status_code == 200
        body = resp.json()

        assert body["periods"] == 24
        assert body["interval_width"] == 0.9
        assert len(body["forecast"]) > 0

        # Each point must have required fields
        point = body["forecast"][0]
        assert "ds" in point
        assert "yhat" in point
        assert "yhat_lower" in point
        assert "yhat_upper" in point

        # Confidence interval must make sense
        for p in body["forecast"]:
            assert p["yhat_lower"] <= p["yhat"] <= p["yhat_upper"]

    def test_predict_validates_minimum_data(self, client):
        """Should reject requests with fewer than 10 data points."""
        small_data = [
            {"ds": (datetime(2025, 1, 1) + timedelta(hours=i)).isoformat(), "y": 2.0}
            for i in range(5)
        ]
        resp = client.post("/predict", json={"data": small_data})
        assert resp.status_code == 422  # Validation error

    def test_predict_validates_periods_range(self, client, sample_data):
        """periods must be between 1 and 720."""
        resp = client.post("/predict", json={
            "data": sample_data,
            "periods": 0,
        })
        assert resp.status_code == 422

        resp = client.post("/predict", json={
            "data": sample_data,
            "periods": 1000,
        })
        assert resp.status_code == 422


# ──────────────────────── Train ────────────────────────


class TestTrain:
    def test_train_succeeds(self, client, sample_data):
        resp = client.post("/train", json={
            "data": sample_data,
            "seasonality_mode": "additive",
            "changepoint_prior_scale": 0.05,
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "trained"
        assert body["data_points"] == len(sample_data)

    def test_train_validates_minimum_data(self, client):
        small_data = [
            {"ds": (datetime(2025, 1, 1) + timedelta(hours=i)).isoformat(), "y": 2.0}
            for i in range(3)
        ]
        resp = client.post("/train", json={"data": small_data})
        assert resp.status_code == 422


# ──────────────────────── Model Unit Tests ────────────────────────


class TestModel:
    def test_predictor_starts_untrained(self):
        p = WaterLevelPredictor()
        assert p.is_trained is False

    def test_auto_train_on_predict(self):
        import pandas as pd
        import math

        p = WaterLevelPredictor()
        base = datetime(2025, 1, 1)
        data = []
        for i in range(100):
            data.append({
                "ds": base + timedelta(hours=i),
                "y": 2.5 + 0.2 * math.sin(2 * math.pi * i / 24),
            })
        df = pd.DataFrame(data)

        result = p.predict(df, periods=12)
        assert p.is_trained is True
        assert len(result) > 0
        assert "yhat" in result.columns

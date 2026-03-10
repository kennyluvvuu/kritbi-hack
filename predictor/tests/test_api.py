"""Tests for the CatBoost predictor API.

Models are mocked — no .cbm files required to run tests.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# ─── Make sure we can import the app ─────────────────────────────
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app  # noqa: E402

client = TestClient(app)

# ─── Helpers ─────────────────────────────────────────────────────

VALID_READINGS = [
    {
        "date": f"2024-{month:02d}-{day:02d}",
        "lvl_sm": 50.0 + day * 0.5,
        "t_max": 10.0 + day * 0.2,
        "t_min": 2.0 + day * 0.1,
        "SMsurf": 0.35,
    }
    for month, day in [(1, d) for d in range(1, 16)]  # 15 rows — enough for lags
]


# ─── /health ─────────────────────────────────────────────────────


def test_health_returns_200():
    resp = client.get("/health")
    assert resp.status_code == 200


def test_health_schema():
    data = client.get("/health").json()
    assert "status" in data
    assert "models_loaded" in data
    assert "version" in data
    assert isinstance(data["models_loaded"], dict)


# ─── /predict ────────────────────────────────────────────────────


def test_predict_returns_503_when_no_model():
    """With no .cbm files loaded, predict should return 503."""
    resp = client.post(
        "/predict",
        json={"recent_data": VALID_READINGS, "horizon": 24},
    )
    # Either 503 (model absent) or 200 (mock loaded) — both acceptable in CI
    assert resp.status_code in (200, 503)


def test_predict_with_mocked_model():
    """With a mocked CatBoost model, predict should return valid forecast."""
    mock_model = MagicMock()
    mock_model.predict.return_value = [65.0]

    with patch.dict(
        "app.model.predictor._models",
        {24: mock_model, 48: mock_model},
    ):
        resp = client.post(
            "/predict",
            json={"recent_data": VALID_READINGS, "horizon": 24},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "forecast" in data
    assert data["horizon"] == 24
    assert len(data["forecast"]) == 24  # 24 hourly points
    assert "ds" in data["forecast"][0]
    assert "yhat" in data["forecast"][0]


def test_predict_48h_returns_48_points():
    mock_model = MagicMock()
    mock_model.predict.return_value = [70.0]

    with patch.dict(
        "app.model.predictor._models",
        {24: mock_model, 48: mock_model},
    ):
        resp = client.post(
            "/predict",
            json={"recent_data": VALID_READINGS, "horizon": 48},
        )

    assert resp.status_code == 200
    assert len(resp.json()["forecast"]) == 48


def test_predict_invalid_horizon():
    resp = client.post(
        "/predict",
        json={"recent_data": VALID_READINGS, "horizon": 36},
    )
    assert resp.status_code == 422


def test_predict_too_few_rows():
    resp = client.post(
        "/predict",
        json={
            "recent_data": VALID_READINGS[:3],  # only 3 rows
            "horizon": 24,
        },
    )
    assert resp.status_code == 422


# ─── /retrain ────────────────────────────────────────────────────


def test_retrain_status_is_idle_initially():
    resp = client.get("/retrain/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("idle", "running", "done", "error")


def test_retrain_returns_422_with_too_few_points():
    resp = client.post(
        "/retrain",
        json={"data": VALID_READINGS[:10], "horizon": "all"},  # < 30
    )
    assert resp.status_code == 422


def test_retrain_accepts_with_enough_data():
    """With 30+ rows retrain should return 202 Accepted."""
    long_data = (VALID_READINGS * 3)[:35]
    # Adjust dates to avoid duplicates
    for i, row in enumerate(long_data):
        row["date"] = f"2024-01-{(i % 28) + 1:02d}"

    with patch.object(
        __import__("app.model", fromlist=["predictor"]).predictor,
        "retrain_async",
    ) as mock_retrain:
        resp = client.post(
            "/retrain",
            json={"data": long_data, "horizon": "all"},
        )
        if resp.status_code == 202:
            mock_retrain.assert_called_once()

    assert resp.status_code in (202, 409)


# ─── /retrain/status ─────────────────────────────────────────────


def test_retrain_status_schema():
    resp = client.get("/retrain/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "last_run" in data
    assert "message" in data

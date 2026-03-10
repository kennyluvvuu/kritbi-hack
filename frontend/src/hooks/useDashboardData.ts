import { useState, useRef, useCallback, useEffect } from "react";
import {
  fetchReadings,
  fetchLatestReading,
  fetchAlerts,
  fetchForecasts,
  requestForecast,
  acknowledgeAlert,
  createWebSocket,
} from "../api";
import type { Reading, Alert, Forecast } from "../types";

export function useDashboardData() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [latestReading, setLatestReading] = useState<Reading | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Initial data fetch
  const loadData = useCallback(async () => {
    try {
      const [readingsData, latestData, alertsData, forecastsData] =
        await Promise.all([
          fetchReadings(1, undefined, undefined, 300),
          fetchLatestReading(),
          fetchAlerts(),
          fetchForecasts(1),
        ]);
      setReadings(readingsData);
      setLatestReading(latestData);
      setAlerts(alertsData);
      if (forecastsData.length > 0) {
        setForecast(forecastsData[0]);
      }
    } catch (e) {
      console.error("Data load error:", e);
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    loadData();

    const ws = createWebSocket(
      (reading) => {
        setLatestReading(reading);
        setReadings((prev) => [reading, ...prev].slice(0, 500));
      },
      (alert) => {
        setAlerts((prev) => [alert, ...prev]);
      }
    );

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3s
      setTimeout(() => {
        loadData();
      }, 3000);
    };

    wsRef.current = ws;

    // Periodic refresh every 30s as fallback
    const interval = setInterval(loadData, 30000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [loadData]);

  const handleRequestForecast = async () => {
    setForecastLoading(true);
    try {
      const result = await requestForecast(1, 72);
      setForecast(result);
    } catch (e) {
      console.error("Forecast error:", e);
    } finally {
      setForecastLoading(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    await acknowledgeAlert(id);
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  };

  return {
    readings,
    latestReading,
    alerts,
    forecast,
    forecastLoading,
    connected,
    loadData,
    handleRequestForecast,
    handleAcknowledge,
  };
}

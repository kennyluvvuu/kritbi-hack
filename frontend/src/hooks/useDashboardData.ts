import { useState, useRef, useCallback, useEffect } from "react";
import {
  fetchReadings,
  fetchLatestReading,
  fetchForecasts,
  requestForecast,
  createWebSocket,
} from "../api";
import type { Reading, Forecast } from "../types";

export function useDashboardData() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [latestReading, setLatestReading] = useState<Reading | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Initial data fetch
  const loadData = useCallback(async () => {
    try {
      const [readingsData, latestData, forecastsData] =
        await Promise.all([
          fetchReadings(1, undefined, undefined, 300),
          fetchLatestReading(),
          fetchForecasts(1),
        ]);
      setReadings(readingsData);
      setLatestReading(latestData);
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

  return {
    readings,
    latestReading,
    forecast,
    forecastLoading,
    connected,
    loadData,
    handleRequestForecast,
  };
}

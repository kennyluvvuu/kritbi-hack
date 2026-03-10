import { API_BASE } from "./config";
import type { Reading, Alert, Forecast, Sensor } from "../types";

export async function fetchReadings(
  sensorId?: number,
  from?: string,
  to?: string,
  limit = 500
): Promise<Reading[]> {
  const params = new URLSearchParams();
  if (sensorId) params.set("sensorId", String(sensorId));
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("limit", String(limit));

  const resp = await fetch(`${API_BASE}/api/readings?${params}`);
  const json = await resp.json();
  return json.data;
}

export async function fetchLatestReading(): Promise<Reading | null> {
  const resp = await fetch(`${API_BASE}/api/readings/latest`);
  const json = await resp.json();
  return json.data;
}

export async function fetchAlerts(acknowledged?: boolean): Promise<Alert[]> {
  const params = new URLSearchParams();
  if (acknowledged !== undefined) params.set("acknowledged", String(acknowledged));
  const resp = await fetch(`${API_BASE}/api/alerts?${params}`);
  const json = await resp.json();
  return json.data;
}

export async function acknowledgeAlert(id: number): Promise<void> {
  await fetch(`${API_BASE}/api/alerts/${id}/acknowledge`, { method: "PATCH" });
}

export async function requestForecast(sensorId: number, horizonHours = 72): Promise<Forecast> {
  const resp = await fetch(`${API_BASE}/api/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sensorId, horizonHours }),
  });
  const json = await resp.json();
  return json.forecast;
}

export async function fetchForecasts(sensorId?: number): Promise<Forecast[]> {
  const params = new URLSearchParams();
  if (sensorId) params.set("sensorId", String(sensorId));
  const resp = await fetch(`${API_BASE}/api/forecast?${params}`);
  const json = await resp.json();
  return json.data;
}

export async function fetchSensors(): Promise<Sensor[]> {
  const resp = await fetch(`${API_BASE}/api/sensors`);
  const json = await resp.json();
  return json.data;
}

export async function fetchSensor(id: number): Promise<Sensor> {
  const resp = await fetch(`${API_BASE}/api/sensors/${id}`);
  const json = await resp.json();
  return json.data;
}

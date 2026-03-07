// Use VITE_API_URL if set (production), otherwise use relative paths (dev proxy)
const API_BASE = import.meta.env.VITE_API_URL || "";

export interface Reading {
  id: number;
  sensorId: number;
  waterLevel: number;
  temperature: number | null;
  timestamp: string;
}

export interface ForecastPoint {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
  trend?: number;
}

export interface Forecast {
  id: number;
  sensorId: number;
  forecastData: ForecastPoint[];
  horizonHours: number;
  createdAt: string;
}

export interface Alert {
  id: number;
  sensorId: number;
  waterLevel: number;
  type: "warning" | "danger" | "critical";
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface Sensor {
  id: number;
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  thresholds?: {
    warningLevel: number;
    dangerLevel: number;
    criticalLevel: number;
  };
}

// ─── API Functions ──────────────────────────────────────────

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

export async function requestForecast(sensorId: number, horizonHours = 48): Promise<Forecast> {
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

// ─── WebSocket ──────────────────────────────────────────────

export function createWebSocket(
  onReading?: (r: Reading) => void,
  onAlert?: (a: Alert) => void
): WebSocket {
  // When API_BASE is empty (dev proxy), derive WS URL from current page origin
  let wsUrl: string;
  if (API_BASE) {
    wsUrl = API_BASE.replace(/^http/, "ws") + "/ws";
  } else {
    const { protocol, host } = window.location;
    wsUrl = `${protocol === "https:" ? "wss" : "ws"}://${host}/ws`;
  }
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "new_reading" && onReading) {
        onReading(msg.payload);
      } else if (msg.type === "new_alert" && onAlert) {
        onAlert(msg.payload);
      }
    } catch {
      // ignore
    }
  };

  // Keepalive ping
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 30000);

  ws.onclose = () => clearInterval(interval);

  return ws;
}

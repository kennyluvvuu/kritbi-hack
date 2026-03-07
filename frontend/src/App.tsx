import { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity,
  BarChart3,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  Bell,
  Thermometer,
  Clock,
  Droplets,
} from "lucide-react";
import {
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  ComposedChart,
} from "recharts";
import {
  fetchReadings,
  fetchLatestReading,
  fetchAlerts,
  acknowledgeAlert,
  requestForecast,
  fetchForecasts,
  createWebSocket,
  type Reading,
  type Alert,
  type Forecast,
  type ForecastPoint,
} from "./api";
import "./App.css";

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(ts: string): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  return `${Math.floor(hrs / 24)} дн назад`;
}

function getLevelStatus(level: number): "safe" | "warning" | "danger" | "critical" {
  if (level >= 5.0) return "critical";
  if (level >= 4.0) return "danger";
  if (level >= 3.0) return "warning";
  return "safe";
}

// ─── Water Level Gauge ──────────────────────────────────

function WaterLevelGauge({ reading }: { reading: Reading | null }) {
  const level = reading?.waterLevel ?? 0;
  const status = getLevelStatus(level);
  const fillPercent = Math.min((level / 6) * 100, 100);

  const statusLabels = {
    safe: "Норма",
    warning: "Предупреждение",
    danger: "Опасность",
    critical: "Критический",
  };

  return (
    <div className="card card-gauge">
      <div className="card-header">
        <div className="card-title">
          <Droplets size={16} /> Уровень воды
        </div>
        {reading && (
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            {formatTime(reading.timestamp)}
          </span>
        )}
      </div>
      <div className="gauge-container">
        <div className={`gauge-value ${status}`}>
          {level.toFixed(2)}
          <span style={{ fontSize: "1.5rem", marginLeft: "4px", opacity: 0.6 }}>м</span>
        </div>
        <div
          className="gauge-label"
          style={{
            color:
              status === "safe"
                ? "var(--cyan-400)"
                : status === "warning"
                ? "var(--yellow-400)"
                : "var(--red-400)",
          }}
        >
          {statusLabels[status]}
        </div>
        <div className="gauge-bar">
          <div
            className={`gauge-bar-fill ${status}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <div className="gauge-thresholds">
          <span>0м</span>
          <span style={{ color: "var(--yellow-400)" }}>3м</span>
          <span style={{ color: "var(--orange-400)" }}>4м</span>
          <span style={{ color: "var(--red-400)" }}>5м</span>
          <span>6м</span>
        </div>
        {reading?.temperature != null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--text-muted)",
              fontSize: "0.85rem",
              marginTop: "8px",
            }}
          >
            <Thermometer size={14} />
            {reading.temperature.toFixed(1)}°C
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stats Card ─────────────────────────────────────────

function StatsCard({ readings }: { readings: Reading[] }) {
  if (readings.length === 0) {
    return (
      <div className="card card-stats">
        <div className="card-header">
          <div className="card-title">
            <BarChart3 size={16} /> Статистика
          </div>
        </div>
        <div className="empty-state">
          <Activity size={32} />
          <span>Нет данных</span>
        </div>
      </div>
    );
  }

  const levels = readings.map((r) => r.waterLevel);
  const max = Math.max(...levels);
  const min = Math.min(...levels);
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
  const latest = readings[0];
  const prev = readings[1];
  const trend =
    latest && prev
      ? ((latest.waterLevel - prev.waterLevel) / prev.waterLevel) * 100
      : 0;

  return (
    <div className="card card-stats">
      <div className="card-header">
        <div className="card-title">
          <BarChart3 size={16} /> Статистика
        </div>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          {readings.length} записей
        </span>
      </div>
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value" style={{ color: "var(--red-400)" }}>
            {max.toFixed(2)}м
          </div>
          <div className="stat-label">Максимум</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: "var(--green-400)" }}>
            {min.toFixed(2)}м
          </div>
          <div className="stat-label">Минимум</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: "var(--blue-400)" }}>
            {avg.toFixed(2)}м
          </div>
          <div className="stat-label">Среднее</div>
        </div>
        <div className="stat-item">
          <div
            className="stat-value"
            style={{
              color: trend > 0 ? "var(--red-400)" : "var(--green-400)",
            }}
          >
            {trend > 0 ? "+" : ""}
            {trend.toFixed(1)}%
          </div>
          <div className="stat-label">Тренд</div>
        </div>
      </div>
    </div>
  );
}

// ─── History Chart ──────────────────────────────────────

function HistoryChart({ readings }: { readings: Reading[] }) {
  const chartData = [...readings]
    .reverse()
    .map((r) => ({
      time: formatTime(r.timestamp),
      fullTime: formatDateTime(r.timestamp),
      level: r.waterLevel,
      temperature: r.temperature,
    }));

  return (
    <div className="card card-history">
      <div className="card-header">
        <div className="card-title">
          <Activity size={16} /> История уровня воды
        </div>
      </div>
      {chartData.length === 0 ? (
        <div className="empty-state">
          <Activity size={40} />
          <span>Ожидание данных от датчика...</span>
        </div>
      ) : (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <defs>
                <linearGradient id="levelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 6]}
                tick={{ fontSize: 11 }}
                label={{
                  value: "м",
                  position: "insideTopLeft",
                  style: { fill: "#64748b", fontSize: 11 },
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(17, 24, 39, 0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px",
                  color: "#f1f5f9",
                  fontSize: "0.8rem",
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullTime ?? ""
                }
              />
              <ReferenceLine
                y={3}
                stroke="#eab308"
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                label={{
                  value: "Предупр.",
                  fill: "#eab308",
                  fontSize: 10,
                  position: "right",
                }}
              />
              <ReferenceLine
                y={4}
                stroke="#f97316"
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                label={{
                  value: "Опасность",
                  fill: "#f97316",
                  fontSize: 10,
                  position: "right",
                }}
              />
              <ReferenceLine
                y={5}
                stroke="#ef4444"
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                label={{
                  value: "Критич.",
                  fill: "#ef4444",
                  fontSize: 10,
                  position: "right",
                }}
              />
              <Area
                type="monotone"
                dataKey="level"
                fill="url(#levelGrad)"
                stroke="none"
              />
              <Line
                type="monotone"
                dataKey="level"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Уровень (м)"
                activeDot={{
                  r: 5,
                  fill: "#3b82f6",
                  stroke: "#1e3a5f",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Forecast Chart ─────────────────────────────────────

function ForecastChart({
  forecast,
  readings,
  onRequest,
  loading,
}: {
  forecast: Forecast | null;
  readings: Reading[];
  onRequest: () => void;
  loading: boolean;
}) {
  const chartData: Array<{
    time: string;
    actual?: number;
    yhat?: number;
    yhat_lower?: number;
    yhat_upper?: number;
    interval?: [number, number];
  }> = [];

  // Historical data (last 48 points)
  const recentReadings = [...readings].reverse().slice(-48);
  for (const r of recentReadings) {
    chartData.push({
      time: formatDateTime(r.timestamp),
      actual: r.waterLevel,
    });
  }

  // Forecast data
  if (forecast?.forecastData) {
    const points = forecast.forecastData as ForecastPoint[];
    for (const p of points) {
      chartData.push({
        time: formatDateTime(p.ds),
        yhat: p.yhat,
        yhat_lower: p.yhat_lower,
        yhat_upper: p.yhat_upper,
        interval: [p.yhat_lower, p.yhat_upper],
      });
    }
  }

  return (
    <div className="card card-forecast">
      <div className="card-header">
        <div className="card-title">
          <TrendingUp size={16} /> Прогноз (Prophet)
        </div>
        <button
          className="btn btn-primary"
          onClick={onRequest}
          disabled={loading}
        >
          {loading ? (
            <RefreshCw size={14} className="spin" />
          ) : (
            <TrendingUp size={14} />
          )}
          {loading ? "Расчёт..." : "Рассчитать прогноз"}
        </button>
      </div>
      {chartData.length === 0 ? (
        <div className="empty-state">
          <TrendingUp size={40} />
          <span>Нажмите «Рассчитать прогноз» для получения предсказания</span>
          <span style={{ fontSize: "0.75rem" }}>
            Необходимо минимум 10 записей уровня воды
          </span>
        </div>
      ) : (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <defs>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c084fc" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, "auto"]}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(17, 24, 39, 0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px",
                  color: "#f1f5f9",
                  fontSize: "0.8rem",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "0.75rem", color: "#94a3b8" }}
              />
              <ReferenceLine y={3} stroke="#eab308" strokeDasharray="6 4" strokeOpacity={0.4} />
              <ReferenceLine y={4} stroke="#f97316" strokeDasharray="6 4" strokeOpacity={0.4} />
              <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.4} />
              {forecast && (
                <Area
                  type="monotone"
                  dataKey="interval"
                  fill="url(#forecastGrad)"
                  stroke="none"
                  name="Довер. интервал"
                  legendType="none"
                />
              )}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Факт"
                connectNulls={false}
              />
              {forecast && (
                <Line
                  type="monotone"
                  dataKey="yhat"
                  stroke="#c084fc"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name="Прогноз"
                  connectNulls={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Alert Panel ────────────────────────────────────────

function AlertPanel({
  alerts,
  onAcknowledge,
  compact,
}: {
  alerts: Alert[];
  onAcknowledge: (id: number) => void;
  compact?: boolean;
}) {
  const icons = {
    warning: "🟡",
    danger: "🔴",
    critical: "⛔",
  };

  const displayAlerts = compact ? alerts.slice(0, 5) : alerts;

  return (
    <div className={`card ${compact ? "card-alerts-mini" : "card-alerts-full"}`}>
      <div className="card-header">
        <div className="card-title">
          <Bell size={16} /> Алерты
          {alerts.filter((a) => !a.acknowledged).length > 0 && (
            <span
              style={{
                background: "var(--red-500)",
                color: "white",
                padding: "2px 8px",
                borderRadius: "10px",
                fontSize: "0.7rem",
                fontWeight: 700,
              }}
            >
              {alerts.filter((a) => !a.acknowledged).length}
            </span>
          )}
        </div>
      </div>
      {displayAlerts.length === 0 ? (
        <div className="empty-state" style={{ padding: compact ? "20px" : "40px" }}>
          <CheckCircle size={compact ? 24 : 32} color="var(--green-400)" />
          <span>Нет активных алертов</span>
        </div>
      ) : (
        <div className="alert-list">
          {displayAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`alert-item ${alert.type} ${
                alert.acknowledged ? "acknowledged" : ""
              }`}
            >
              <span className="alert-icon">
                {icons[alert.type] ?? "⚠️"}
              </span>
              <div className="alert-content">
                <div className="alert-message">{alert.message}</div>
                <div className="alert-time">
                  <Clock size={10} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                  {timeAgo(alert.createdAt)}
                </div>
              </div>
              {!alert.acknowledged && (
                <button
                  className="alert-ack-btn"
                  onClick={() => onAcknowledge(alert.id)}
                  title="Подтвердить"
                >
                  ✓
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────

export default function App() {
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
      const result = await requestForecast(1, 48);
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

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="header-icon">🌊</div>
          <h1>
            Кача <span>/ мониторинг уровня</span>
          </h1>
        </div>
        <div className="header-right">
          <div className={`status-badge ${connected ? "" : "disconnected"}`}>
            <div className="status-dot" />
            {connected ? "Онлайн" : "Оффлайн"}
          </div>
          <button className="btn btn-ghost" onClick={loadData}>
            <RefreshCw size={14} /> Обновить
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        <WaterLevelGauge reading={latestReading} />
        <StatsCard readings={readings} />
        <AlertPanel
          alerts={alerts}
          onAcknowledge={handleAcknowledge}
          compact
        />
        <HistoryChart readings={readings} />
        <ForecastChart
          forecast={forecast}
          readings={readings}
          onRequest={handleRequestForecast}
          loading={forecastLoading}
        />
        <AlertPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
      </div>
    </div>
  );
}

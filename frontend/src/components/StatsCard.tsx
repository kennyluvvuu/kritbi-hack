import { useState, useMemo } from "react";
import { Activity, BarChart3 } from "lucide-react";
import type { Reading } from "../types";

export type TimeInterval = "1h" | "24h" | "7d" | "30d" | "all";

export function StatsCard({ readings }: { readings: Reading[] }) {
  const [interval, setInterval] = useState<TimeInterval>("all");

  const filteredReadings = useMemo(() => {
    if (interval === "all" || readings.length === 0) return readings;
    const latestTime = new Date(readings[0].timestamp).getTime();
    const msPerHour = 60 * 60 * 1000;
    const intervalMap = {
      "1h": msPerHour,
      "24h": 24 * msPerHour,
      "7d": 7 * 24 * msPerHour,
      "30d": 30 * 24 * msPerHour,
    };
    const limit = latestTime - intervalMap[interval];
    return readings.filter((r) => new Date(r.timestamp).getTime() >= limit);
  }, [readings, interval]);

  if (filteredReadings.length === 0) {
    return (
      <div className="card card-stats">
        <div className="card-header">
          <div className="card-title">
            <BarChart3 size={16} /> Статистика
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              0 записей
            </span>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value as TimeInterval)}
              style={{
                fontSize: "0.75rem",
                padding: "2px 4px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                color: "inherit",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="1h">За час</option>
              <option value="24h">За 24ч</option>
              <option value="7d">За 7д</option>
              <option value="30d">За 30д</option>
              <option value="all">Всё время</option>
            </select>
          </div>
        </div>
        <div className="empty-state">
          <Activity size={32} />
          <span>Нет данных за выбранный период</span>
        </div>
      </div>
    );
  }

  const levels = filteredReadings.map((r) => r.waterLevel);
  const max = Math.max(...levels);
  const min = Math.min(...levels);
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
  const latest = filteredReadings[0];
  const prev = filteredReadings[1];
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            {filteredReadings.length} записей
          </span>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value as TimeInterval)}
            style={{
              fontSize: "0.75rem",
              padding: "2px 4px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              color: "inherit",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="1h">За час</option>
            <option value="24h">За 24ч</option>
            <option value="7d">За 7д</option>
            <option value="30d">За 30д</option>
            <option value="all">Всё время</option>
          </select>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value" style={{ color: "var(--red-400)" }}>
            {max.toFixed(1)}см
          </div>
          <div className="stat-label">Максимум</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: "var(--green-400)" }}>
            {min.toFixed(1)}см
          </div>
          <div className="stat-label">Минимум</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: "var(--blue-400)" }}>
            {avg.toFixed(1)}см
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

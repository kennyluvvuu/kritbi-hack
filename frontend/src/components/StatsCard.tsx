import { Activity, BarChart3 } from "lucide-react";
import type { Reading } from "../types";

export function StatsCard({ readings }: { readings: Reading[] }) {
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

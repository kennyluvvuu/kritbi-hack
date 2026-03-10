import { Droplets, Thermometer } from "lucide-react";
import type { Reading } from "../types";
import { formatTime, getLevelStatus } from "../utils/format";

export function WaterLevelGauge({ reading }: { reading: Reading | null }) {
  const level = reading?.waterLevel ?? 0;
  const status = getLevelStatus(level);
  const fillPercent = Math.min((level / 300) * 100, 100);

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
          {level.toFixed(1)}
          <span style={{ fontSize: "1.5rem", marginLeft: "4px", opacity: 0.6 }}>см</span>
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
          <span>0см</span>
          <span style={{ color: "var(--yellow-400)" }}>150см</span>
          <span style={{ color: "var(--orange-400)" }}>200см</span>
          <span style={{ color: "var(--red-400)" }}>250см</span>
          <span>300см</span>
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

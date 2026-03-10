import { Bell, CheckCircle, Clock } from "lucide-react";
import type { Alert } from "../types";
import { timeAgo } from "../utils/format";

export function AlertPanel({
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

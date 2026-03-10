import { TrendingUp, RefreshCw } from "lucide-react";
import type { Forecast, ForecastPoint } from "../types";
import { formatDateTime } from "../utils/format";

export function ForecastWidget({
  forecast,
  onRequest,
  loading,
}: {
  forecast: Forecast | null;
  onRequest: () => void;
  loading: boolean;
}) {
  const points = (forecast?.forecastData as ForecastPoint[]) || [];
  
  const pt6 = points.find((p) => p.horizon === 6);
  const pt24 = points.find((p) => p.horizon === 24);
  const pt72 = points.find((p) => p.horizon === 72);

  return (
    <div className="card card-forecast" style={{ gridColumn: "span 2" }}>
      <div className="card-header">
        <div className="card-title">
          <TrendingUp size={16} /> Прогноз уровня воды (CatBoost)
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
          {loading ? "Расчёт..." : "Обновить прогноз"}
        </button>
      </div>
      
      {!forecast ? (
        <div className="empty-state">
          <TrendingUp size={40} />
          <span>Свежего прогноза нет. Нажмите «Обновить прогноз»</span>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "20px", marginTop: "10px", flexWrap: "wrap" }}>
          <div className="forecast-card" style={{ flex: 1, background: "var(--card-bg-alt)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "8px" }}>Скоро (+6 часов)</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--teal-400)" }}>
              {pt6 ? pt6.yhat.toFixed(1) : "—"} <span style={{ fontSize: "1.2rem", opacity: 0.6 }}>см</span>
            </div>
            {pt6 && (
              <div style={{ marginTop: "10px", fontSize: "0.85rem", color: pt6.yhat >= 200 ? "var(--red-400)" : "var(--green-400)" }}>
                {pt6.yhat >= 200 ? "⚠️ Высокий уровень" : "✅ В норме"}
              </div>
            )}
          </div>

          <div className="forecast-card" style={{ flex: 1, background: "var(--card-bg-alt)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "8px" }}>Завтра (+24 часа)</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--cyan-400)" }}>
              {pt24 ? pt24.yhat.toFixed(1) : "—"} <span style={{ fontSize: "1.2rem", opacity: 0.6 }}>см</span>
            </div>
            {pt24 && (
              <div style={{ marginTop: "10px", fontSize: "0.85rem", color: pt24.yhat >= 200 ? "var(--red-400)" : "var(--green-400)" }}>
                {pt24.yhat >= 200 ? "⚠️ Риск выхода из русла" : "✅ В пределах нормы"}
              </div>
            )}
          </div>

          <div className="forecast-card" style={{ flex: 1, background: "var(--card-bg-alt)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "8px" }}>Через 3 дня (+72 часа)</div>
            <div style={{ fontSize: "2.2rem", fontWeight: 700, color: "var(--blue-400)" }}>
              {pt72 ? pt72.yhat.toFixed(1) : "—"} <span style={{ fontSize: "1.2rem", opacity: 0.6 }}>см</span>
            </div>
            {pt72 && (
               <div style={{ marginTop: "10px", fontSize: "0.85rem", color: pt72.yhat >= 200 ? "var(--red-400)" : "var(--green-400)" }}>
                 {pt72.yhat >= 200 ? "⚠️ Возможен паводок" : "✅ Стабильная обстановка"}
               </div>
            )}
          </div>
        </div>
      )}
      {forecast && (
        <div style={{ marginTop: "16px", fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
          Последний расчёт: {formatDateTime(forecast.createdAt)}
        </div>
      )}
    </div>
  );
}

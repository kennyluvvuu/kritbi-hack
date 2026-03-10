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
    <div className="card card-forecast" style={{ gridColumn: "span 2", minHeight: "550px", display: "flex", flexDirection: "column" }}>
      <div className="card-header" style={{ borderBottom: "1px solid var(--glass-border)", paddingBottom: "16px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="card-title" style={{ fontSize: "1.2rem", color: "#fff", fontWeight: "800", textTransform: "none", letterSpacing: "normal" }}>
           🔮 ПРОГНОЗ ОТ КАЧИНАТОРА <span style={{ fontSize: "0.8rem", fontWeight: "400", opacity: 0.7, marginLeft: "8px" }}>(никогда не ошибается)</span>
        </div>
        <button
          className="btn btn-primary"
          onClick={onRequest}
          disabled={loading}
          style={{ background: "var(--gradient-blue)", border: "none", borderRadius: "8px" }}
        >
          {loading ? (
            <RefreshCw size={14} className="spin" />
          ) : (
            <TrendingUp size={14} />
          )}
          {loading ? "Думает..." : "Спросить Качинатора"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "32px", flex: 1, minHeight: "440px", flexWrap: "nowrap" }}>
        {/* Акинатор */}
        <div style={{ flex: "0 0 350px", display: "flex", justifyContent: "center", alignItems: "flex-end", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "16px" }}>
          <img 
            src="/kacinator.png" 
            alt="Качинатор" 
            style={{ width: "100%", height: "auto", maxHeight: "440px", objectFit: "contain", filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.5))" }} 
          />
        </div>

        {/* Прогноз контент */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {!forecast ? (
            <div className="empty-state" style={{ padding: "0" }}>
              <TrendingUp size={40} style={{ opacity: 0.3, marginBottom: "16px" }} />
              <div style={{ fontSize: "1.1rem", color: "var(--text-secondary)" }}>
                Качинатор еще не предсказал будущее. 
              </div>
              <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "8px" }}>
                Нажмите «Спросить Качинатора», чтобы он заглянул в завтрашний день.
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", width: "100%" }}>
                <div className="forecast-card" style={{ flex: 1, minWidth: "140px", background: "var(--bg-secondary, #111827)", padding: "20px", borderRadius: "12px", border: "1px solid var(--glass-border)" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>Через 6 ч</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--teal-400)" }}>
                    {pt6 ? pt6.yhat.toFixed(1) : "—"} <span style={{ fontSize: "1rem", opacity: 0.5 }}>см</span>
                  </div>
                  {pt6 && (
                    <div style={{ marginTop: "8px", fontSize: "0.75rem", color: pt6.yhat >= 200 ? "var(--red-400)" : "var(--green-400)" }}>
                      {pt6.yhat >= 200 ? "⚠️ Опасно" : "✅ Норма"}
                    </div>
                  )}
                </div>

                <div className="forecast-card" style={{ flex: 1, minWidth: "140px", background: "var(--bg-secondary, #111827)", padding: "20px", borderRadius: "12px", border: "1px solid var(--glass-border)" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>Завтра (24 ч)</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--cyan-400)" }}>
                    {pt24 ? pt24.yhat.toFixed(1) : "—"} <span style={{ fontSize: "1rem", opacity: 0.5 }}>см</span>
                  </div>
                  {pt24 && (
                    <div style={{ marginTop: "8px", fontSize: "0.75rem", color: pt24.yhat >= 200 ? "var(--red-400)" : "var(--green-400)" }}>
                      {pt24.yhat >= 200 ? "⚠️ Риск" : "✅ Норма"}
                    </div>
                  )}
                </div>

                <div className="forecast-card" style={{ flex: 1, minWidth: "140px", background: "var(--bg-secondary, #111827)", padding: "20px", borderRadius: "12px", border: "1px solid var(--glass-border)" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>3 дня (72 ч)</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--blue-400)" }}>
                    {pt72 ? pt72.yhat.toFixed(1) : "—"} <span style={{ fontSize: "1rem", opacity: 0.5 }}>см</span>
                  </div>
                  {pt72 && (
                    <div style={{ marginTop: "8px", fontSize: "0.75rem", color: pt72.yhat >= 200 ? "var(--red-400)" : "var(--green-400)" }}>
                      {pt72.yhat >= 200 ? "⚠️ Паводок" : "✅ Ок"}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: "24px", fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", fontStyle: "italic" }}>
                Последний сеанс связи с космосом: {formatDateTime(forecast.createdAt)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

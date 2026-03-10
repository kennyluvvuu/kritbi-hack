import { RefreshCw } from "lucide-react";
import "./App.css";

import { useDashboardData } from "./hooks/useDashboardData";
import { WaterLevelGauge } from "./components/WaterLevelGauge";
import { StatsCard } from "./components/StatsCard";
import { AlertPanel } from "./components/AlertPanel";
import { HistoryChart } from "./components/HistoryChart";
import { ForecastWidget } from "./components/ForecastWidget";

export default function App() {
  const {
    readings,
    latestReading,
    alerts,
    forecast,
    forecastLoading,
    connected,
    loadData,
    handleRequestForecast,
    handleAcknowledge,
  } = useDashboardData();

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
        <ForecastWidget
          forecast={forecast}
          onRequest={handleRequestForecast}
          loading={forecastLoading}
        />
        <AlertPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
      </div>
    </div>
  );
}

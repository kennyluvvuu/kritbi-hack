import { RefreshCw } from "lucide-react";
import "./App.css";

import { useDashboardData } from "./hooks/useDashboardData";
import { WaterLevelGauge } from "./components/WaterLevelGauge";
import { StatsCard } from "./components/StatsCard";
import { HistoryChart } from "./components/HistoryChart";
import { ForecastWidget } from "./components/ForecastWidget";
import { Footer } from "./components/Footer";

export default function App() {
  const {
    readings,
    latestReading,
    forecast,
    forecastLoading,
    connected,
    loadData,
    handleRequestForecast,
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
          <a 
            href="https://t.me/KachaAlertBot" 
            target="_blank" 
            rel="noopener noreferrer"
            className="telegram-badge"
            title="Получать оповещения в Telegram"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
            <span>Оповещения</span>
          </a>
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
        <HistoryChart readings={readings} />
        <ForecastWidget
          forecast={forecast}
          onRequest={handleRequestForecast}
          loading={forecastLoading}
        />
      </div>
      <Footer />
    </div>
  );
}

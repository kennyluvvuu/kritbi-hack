export interface Reading {
  id: number;
  sensorId: number;
  waterLevel: number;
  temperature: number | null;
  timestamp: string;
}

export interface ForecastPoint {
  horizon: number;
  yhat: number;
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

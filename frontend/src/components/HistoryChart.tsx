import { Activity } from "lucide-react";
import {
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts";
import type { Reading } from "../types";
import { formatTime, formatDateTime } from "../utils/format";

export function HistoryChart({ readings }: { readings: Reading[] }) {
  const isMultiDay = readings.length > 1 &&
    Math.abs(new Date(readings[0].timestamp).getTime() - new Date(readings[readings.length - 1].timestamp).getTime()) > 24 * 60 * 60 * 1000;

  const chartData = [...readings]
    .reverse()
    .map((r) => ({
      time: isMultiDay
        ? new Date(r.timestamp).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
        : formatTime(r.timestamp),
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
                domain={[0, 300]}
                tick={{ fontSize: 11 }}
                label={{
                  value: "см",
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
                y={150}
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
                y={200}
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
                y={250}
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
                name="Уровень (см)"
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

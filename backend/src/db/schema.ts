import { pgTable, serial, varchar, doublePrecision, timestamp, boolean, text, jsonb, integer } from "drizzle-orm/pg-core";

// ─── Sensors ────────────────────────────────────────────────
export const sensors = pgTable("sensors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Readings (time-series water level data) ────────────────
export const readings = pgTable("readings", {
  id: serial("id").primaryKey(),
  sensorId: integer("sensor_id")
    .references(() => sensors.id)
    .notNull(),
  waterLevel: doublePrecision("water_level").notNull(),
  temperature: doublePrecision("temperature"),
  soilMoisture: doublePrecision("soil_moisture"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// ─── Forecasts ──────────────────────────────────────────────
export const forecasts = pgTable("forecasts", {
  id: serial("id").primaryKey(),
  sensorId: integer("sensor_id")
    .references(() => sensors.id)
    .notNull(),
  forecastData: jsonb("forecast_data").notNull(), // { ds, yhat, yhat_lower, yhat_upper }[]
  horizonHours: integer("horizon_hours").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


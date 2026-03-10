/**
 * Retrain proxy route — triggers warm-start retraining on the CatBoost predictor
 * using recent IoT sensor readings from the database.
 *
 * Also starts a weekly auto-retrain cron job on startup.
 */

import { Elysia, t } from "elysia";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";

const PREDICTOR_URL = process.env.PREDICTOR_URL || "http://predictor:8000";
const AUTO_RETRAIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const MIN_RETRAIN_ROWS = 30;

// ─── Auto-retrain cron ────────────────────────────────────────────

async function triggerAutoRetrain(): Promise<void> {
  console.log("[retrain] Weekly auto-retrain triggered");
  try {
    // Collect recent readings (up to 2000) to find enough daily snapshots
    const rawReadings = await db
      .select({
        timestamp: schema.readings.timestamp,
        waterLevel: schema.readings.waterLevel,
        temperature: schema.readings.temperature,
        soilMoisture: schema.readings.soilMoisture,
      })
      .from(schema.readings)
      .orderBy(desc(schema.readings.timestamp))
      .limit(2000);

    const dailyReadings: typeof rawReadings = [];
    const seenDays = new Set<string>();

    for (const r of rawReadings) {
      const dayKey = r.timestamp.toISOString().split("T")[0];
      if (dayKey && !seenDays.has(dayKey)) {
        dailyReadings.push(r);
        seenDays.add(dayKey);
      }
      if (dailyReadings.length >= 60) break;
    }

    const readings = dailyReadings;

    if (readings.length < MIN_RETRAIN_ROWS) {
      console.log(`[retrain] Skipped — only ${readings.length} rows (need ≥ ${MIN_RETRAIN_ROWS})`);
      return;
    }

    const data = readings.reverse().map((r) => ({
      date: r.timestamp.toISOString().split("T")[0],
      lvl_sm: r.waterLevel,
      t_max: r.temperature ?? 10,
      t_min: r.temperature ? r.temperature - 5 : 5,
      SMsurf: r.soilMoisture ?? 0.2,
    }));

    const resp = await fetch(`${PREDICTOR_URL}/retrain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, horizon: "all" }),
    });

    if (resp.ok) {
      console.log("[retrain] ✅ Auto-retrain accepted by predictor");
    } else {
      console.error("[retrain] ❌ Predictor error:", await resp.text());
    }
  } catch (err) {
    console.error("[retrain] ❌ Auto-retrain failed:", err);
  }
}

// Start weekly cron after a 60s grace period (let backend fully boot first)
setTimeout(() => {
  setInterval(triggerAutoRetrain, AUTO_RETRAIN_INTERVAL_MS);
}, 60_000);

// ─── Routes ──────────────────────────────────────────────────────

export const retrainRoutes = new Elysia({ prefix: "/api/retrain" })
  // POST — manually trigger retrain
  .post(
    "/",
    async ({ body }) => {
      const sensorId = body.sensorId;

      const rawReadings = await db
        .select({
          timestamp: schema.readings.timestamp,
          waterLevel: schema.readings.waterLevel,
          temperature: schema.readings.temperature,
          soilMoisture: schema.readings.soilMoisture,
        })
        .from(schema.readings)
        .where(eq(schema.readings.sensorId, sensorId))
        .orderBy(desc(schema.readings.timestamp))
        .limit(2000);

      const dailyReadings: typeof rawReadings = [];
      const seenDays = new Set<string>();

      for (const r of rawReadings) {
        const dayKey = r.timestamp.toISOString().split("T")[0];
        if (dayKey && !seenDays.has(dayKey)) {
          dailyReadings.push(r);
          seenDays.add(dayKey);
        }
        if (dailyReadings.length >= (body.limit ?? 60)) break;
      }

      const readings = dailyReadings;

      if (readings.length < MIN_RETRAIN_ROWS) {
        return {
          success: false,
          error: `Недостаточно данных для дообучения (${readings.length} записей, нужно ≥ ${MIN_RETRAIN_ROWS})`,
        };
      }

      const data = readings.reverse().map((r) => ({
        date: r.timestamp.toISOString().split("T")[0],
        lvl_sm: r.waterLevel,
        t_max: r.temperature ?? 10,
        t_min: r.temperature ? r.temperature - 5 : 5,
        SMsurf: r.soilMoisture ?? 0.2,
      }));

      const response = await fetch(`${PREDICTOR_URL}/retrain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, horizon: body.horizon ?? "all" }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { success: false, error: `Predictor error: ${err}` };
      }

      const result = (await response.json()) as {
        status: string;
        data_points: number;
        message: string;
      };
      return { success: true, ...result };
    },
    {
      body: t.Object({
        sensorId: t.Number(),
        horizon: t.Optional(
          t.Union([t.Literal(24), t.Literal(48), t.Literal("all")])
        ),
        limit: t.Optional(t.Number()),
      }),
    }
  )
  // GET — retrain status from predictor
  .get("/status", async () => {
    try {
      const resp = await fetch(`${PREDICTOR_URL}/retrain/status`);
      if (!resp.ok) return { error: "Could not reach predictor" };
      return await resp.json();
    } catch {
      return { error: "Predictor unavailable" };
    }
  });

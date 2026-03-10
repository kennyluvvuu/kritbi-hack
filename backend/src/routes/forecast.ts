import { Elysia, t } from "elysia";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";

const PREDICTOR_URL = process.env.PREDICTOR_URL || "http://predictor:8000";

export const forecastRoutes = new Elysia({ prefix: "/api/forecast" })
  // POST — request a new forecast
  .post(
    "/",
    async ({ body }) => {
      // Fetch last 1000 readings to have enough for 30 daily snapshots
      const rawHistory = await db
        .select({
          timestamp: schema.readings.timestamp,
          waterLevel: schema.readings.waterLevel,
          temperature: schema.readings.temperature,
          soilMoisture: schema.readings.soilMoisture,
        })
        .from(schema.readings)
        .where(eq(schema.readings.sensorId, body.sensorId))
        .orderBy(desc(schema.readings.timestamp))
        .limit(1000);

      // Filter to get the MOST RECENT reading for each of the last 30 distinct days
      const dailyPoints: typeof rawHistory = [];
      const seenDays = new Set<string>();

      for (const r of rawHistory) {
        const dayKey = r.timestamp.toISOString().split("T")[0];
        if (dayKey && !seenDays.has(dayKey)) {
          dailyPoints.push(r);
          seenDays.add(dayKey);
        }
        if (dailyPoints.length >= 30) break;
      }

      const historicalData = dailyPoints;

      if (historicalData.length < 8) {
        return {
          success: false,
          error:
            "Недостаточно данных для прогноза (минимум 8 дневных записей)",
        };
      }

      // Sort ascending for feature building (oldest first)
      const sorted = [...historicalData].reverse();

      // Format for CatBoost predictor
      const recentData = sorted.map((r) => ({
        date: r.timestamp.toISOString().split("T")[0],
        lvl_sm: r.waterLevel,
        t_max: r.temperature ?? 10,
        t_min: r.temperature ? r.temperature - 5 : 5,
        SMsurf: r.soilMoisture ?? 0.2,
      }));



      // Call CatBoost microservice to get point forecasts
      const response = await fetch(`${PREDICTOR_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recent_data: recentData, horizon: "all" }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { success: false, error: `Predictor error: ${err}` };
      }

      const forecastResult = (await response.json()) as {
        forecast: Array<{ horizon: number; yhat: number }>;
        model_version: string;
      };

      // Save forecast to DB
      const [forecast] = await db
        .insert(schema.forecasts)
        .values({
          sensorId: body.sensorId,
          forecastData: forecastResult.forecast,
          horizonHours: 48, // Stores max horizon for compatibility
        })
        .returning();

      return { success: true, forecast };
    },
    {
      body: t.Object({
        sensorId: t.Number(),
      }),
    }
  )
  // GET — list forecasts
  .get("/", async ({ query }) => {
    const conditions = [];
    if (query.sensorId) {
      conditions.push(eq(schema.forecasts.sensorId, Number(query.sensorId)));
    }

    const data = await db
      .select()
      .from(schema.forecasts)
      .where(conditions.length ? conditions[0] : undefined)
      .orderBy(desc(schema.forecasts.createdAt))
      .limit(10);

    return { data };
  })
  // GET — single forecast
  .get("/:id", async ({ params }) => {
    const [forecast] = await db
      .select()
      .from(schema.forecasts)
      .where(eq(schema.forecasts.id, Number(params.id)))
      .limit(1);

    if (!forecast) return { error: "Forecast not found" };
    return { data: forecast };
  });

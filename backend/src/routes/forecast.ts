import { Elysia, t } from "elysia";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";

const PREDICTOR_URL = process.env.PREDICTOR_URL || "http://localhost:8000";

export const forecastRoutes = new Elysia({ prefix: "/api/forecast" })
  // POST — request a new forecast
  .post(
    "/",
    async ({ body }) => {
      // Fetch historical data for this sensor
      const historicalData = await db
        .select({
          timestamp: schema.readings.timestamp,
          waterLevel: schema.readings.waterLevel,
        })
        .from(schema.readings)
        .where(eq(schema.readings.sensorId, body.sensorId))
        .orderBy(schema.readings.timestamp)
        .limit(2000);

      if (historicalData.length < 10) {
        return {
          success: false,
          error: "Недостаточно данных для прогноза (минимум 10 записей)",
        };
      }

      // Format for Prophet: { ds: "YYYY-MM-DD HH:mm:ss", y: number }
      const prophetData = historicalData.map((r) => ({
        ds: r.timestamp.toISOString(),
        y: r.waterLevel,
      }));

      const periods = body.horizonHours || 48;

      // Call Prophet microservice — aligned with predictor's PredictRequest schema
      const response = await fetch(`${PREDICTOR_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: prophetData,
          periods,
          interval_width: 0.95,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { success: false, error: `Prophet error: ${err}` };
      }

      const forecastResult = (await response.json()) as {
        forecast: Array<{
          ds: string;
          yhat: number;
          yhat_lower: number;
          yhat_upper: number;
          trend?: number;
        }>;
        periods: number;
        interval_width: number;
      };

      // Save forecast to DB
      const [forecast] = await db
        .insert(schema.forecasts)
        .values({
          sensorId: body.sensorId,
          forecastData: forecastResult.forecast,
          horizonHours: periods,
        })
        .returning();

      return { success: true, forecast };
    },
    {
      body: t.Object({
        sensorId: t.Number(),
        horizonHours: t.Optional(t.Number()),
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

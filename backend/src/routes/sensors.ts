import { Elysia, t } from "elysia";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

export const sensorsRoutes = new Elysia({ prefix: "/api/sensors" })
  // GET all sensors
  .get("/", async () => {
    const data = await db.select().from(schema.sensors);
    return { data };
  })
  // POST create sensor
  .post(
    "/",
    async ({ body }) => {
      const [sensor] = await db
        .insert(schema.sensors)
        .values({
          name: body.name,
          location: body.location,
          latitude: body.latitude,
          longitude: body.longitude,
        })
        .returning();

      if (!sensor) return { success: false, error: "Failed to create sensor" };

      // Create default thresholds
      await db.insert(schema.alertThresholds).values({
        sensorId: sensor.id,
        warningLevel: Number(process.env.WARNING_LEVEL) || 3.0,
        dangerLevel: Number(process.env.DANGER_LEVEL) || 4.0,
        criticalLevel: Number(process.env.CRITICAL_LEVEL) || 5.0,
      });

      return { success: true, sensor };
    },
    {
      body: t.Object({
        name: t.String(),
        location: t.String(),
        latitude: t.Optional(t.Number()),
        longitude: t.Optional(t.Number()),
      }),
    }
  )
  // GET single sensor with thresholds
  .get("/:id", async ({ params }) => {
    const [sensor] = await db
      .select()
      .from(schema.sensors)
      .where(eq(schema.sensors.id, Number(params.id)))
      .limit(1);

    if (!sensor) return { error: "Sensor not found" };

    const [thresholds] = await db
      .select()
      .from(schema.alertThresholds)
      .where(eq(schema.alertThresholds.sensorId, sensor.id))
      .limit(1);

    return { data: { ...sensor, thresholds } };
  })
  // PUT update thresholds
  .put(
    "/:id/thresholds",
    async ({ params, body }) => {
      const [updated] = await db
        .update(schema.alertThresholds)
        .set({
          warningLevel: body.warningLevel,
          dangerLevel: body.dangerLevel,
          criticalLevel: body.criticalLevel,
        })
        .where(eq(schema.alertThresholds.sensorId, Number(params.id)))
        .returning();

      if (!updated) return { error: "Thresholds not found for this sensor" };
      return { success: true, thresholds: updated };
    },
    {
      body: t.Object({
        warningLevel: t.Number(),
        dangerLevel: t.Number(),
        criticalLevel: t.Number(),
      }),
    }
  );

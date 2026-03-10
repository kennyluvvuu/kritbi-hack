import { Elysia, t } from "elysia";
import { db, schema } from "../db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { broadcastReading, broadcastAlert } from "../ws/realtime.ts";

export const readingsRoutes = new Elysia({ prefix: "/api/readings" })
    // POST — receive a reading from IoT sensor
    .post(
        "/",
        async ({ body }) => {
            const [reading] = await db
                .insert(schema.readings)
                .values({
                    sensorId: body.sensorId,
                    waterLevel: body.waterLevel,
                    temperature: body.temperature ?? null,
                    soilMoisture: body.soilMoisture ?? null,
                    timestamp: body.timestamp
                        ? new Date(body.timestamp)
                        : new Date(),
                })
                .returning();

            // Broadcast to WebSocket clients
            broadcastReading(reading);

            // Check alert thresholds
            const [thresholds] = await db
                .select()
                .from(schema.alertThresholds)
                .where(eq(schema.alertThresholds.sensorId, body.sensorId))
                .limit(1);

            if (thresholds) {
                let alertType: string | null = null;
                let message = "";

                if (body.waterLevel >= thresholds.criticalLevel) {
                    alertType = "critical";
                    message = `⛔ КРИТИЧЕСКИЙ уровень воды: ${body.waterLevel.toFixed(1)}см (порог: ${thresholds.criticalLevel}см)`;
                } else if (body.waterLevel >= thresholds.dangerLevel) {
                    alertType = "danger";
                    message = `🔴 ОПАСНЫЙ уровень воды: ${body.waterLevel.toFixed(1)}см (порог: ${thresholds.dangerLevel}см)`;
                } else if (body.waterLevel >= thresholds.warningLevel) {
                    alertType = "warning";
                    message = `🟡 Предупреждение: уровень воды ${body.waterLevel.toFixed(1)}см (порог: ${thresholds.warningLevel}см)`;
                }

                if (alertType) {
                    const [alert] = await db
                        .insert(schema.alerts)
                        .values({
                            sensorId: body.sensorId,
                            waterLevel: body.waterLevel,
                            type: alertType,
                            message,
                        })
                        .returning();
                    broadcastAlert(alert);
                }
            }

            return { success: true, reading };
        },
        {
            body: t.Object({
                sensorId: t.Number(),
                waterLevel: t.Number(),
                temperature: t.Optional(t.Number()),
                soilMoisture: t.Optional(t.Number()),
                timestamp: t.Optional(t.String()),
            }),
        },
    )
    // GET — historical readings with filtering
    .get(
        "/",
        async ({ query }) => {
            const conditions = [];

            if (query.sensorId) {
                conditions.push(
                    eq(schema.readings.sensorId, Number(query.sensorId)),
                );
            }
            if (query.from) {
                conditions.push(
                    gte(schema.readings.timestamp, new Date(query.from)),
                );
            }
            if (query.to) {
                conditions.push(
                    lte(schema.readings.timestamp, new Date(query.to)),
                );
            }

            const data = await db
                .select()
                .from(schema.readings)
                .where(conditions.length ? and(...conditions) : undefined)
                .orderBy(desc(schema.readings.timestamp))
                .limit(Number(query.limit) || 500);

            return { data, count: data.length };
        },
        {
            query: t.Object({
                sensorId: t.Optional(t.String()),
                from: t.Optional(t.String()),
                to: t.Optional(t.String()),
                limit: t.Optional(t.String()),
            }),
        },
    )
    // GET latest reading per sensor
    .get("/latest", async () => {
        const data = await db
            .select()
            .from(schema.readings)
            .orderBy(desc(schema.readings.timestamp))
            .limit(1);
        return { data: data[0] ?? null };
    });

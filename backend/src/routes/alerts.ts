import { Elysia, t } from "elysia";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";

export const alertsRoutes = new Elysia({ prefix: "/api/alerts" })
  // GET — list alerts
  .get(
    "/",
    async ({ query }) => {
      const conditions = [];
      if (query.sensorId) {
        conditions.push(eq(schema.alerts.sensorId, Number(query.sensorId)));
      }
      if (query.acknowledged === "false") {
        conditions.push(eq(schema.alerts.acknowledged, false));
      }

      const data = await db
        .select()
        .from(schema.alerts)
        .where(conditions.length > 0 ? conditions[0] : undefined)
        .orderBy(desc(schema.alerts.createdAt))
        .limit(Number(query.limit) || 50);

      return { data };
    },
    {
      query: t.Object({
        sensorId: t.Optional(t.String()),
        acknowledged: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )
  // PATCH — acknowledge an alert
  .patch("/:id/acknowledge", async ({ params }) => {
    const [updated] = await db
      .update(schema.alerts)
      .set({ acknowledged: true })
      .where(eq(schema.alerts.id, Number(params.id)))
      .returning();

    if (!updated) return { error: "Alert not found" };
    return { success: true, alert: updated };
  });

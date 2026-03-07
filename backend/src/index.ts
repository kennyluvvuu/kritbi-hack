import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { readingsRoutes } from "./routes/readings";
import { forecastRoutes } from "./routes/forecast";
import { alertsRoutes } from "./routes/alerts";
import { sensorsRoutes } from "./routes/sensors";
import { addClient, removeClient, getClientCount } from "./ws/realtime";

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "Кача — API мониторинга уровня воды",
          version: "1.0.0",
          description: "Система прогнозирования паводков на реке Кача",
        },
      },
    })
  )
  // Health check
  .get("/api/health", () => ({
    status: "ok",
    wsClients: getClientCount(),
    timestamp: new Date().toISOString(),
  }))
  // WebSocket
  .ws("/ws", {
    open(ws) {
      addClient(ws);
      console.log(`[WS] Client connected (total: ${getClientCount()})`);
    },
    close(ws) {
      removeClient(ws);
      console.log(`[WS] Client disconnected (total: ${getClientCount()})`);
    },
    message(ws, message) {
      // ping/pong keepalive
      ws.send(JSON.stringify({ type: "pong" }));
    },
  })
  // Routes
  .use(readingsRoutes)
  .use(forecastRoutes)
  .use(alertsRoutes)
  .use(sensorsRoutes)
  .listen(3000);

console.log(`🌊 Кача API running at http://localhost:${app.server?.port}`);
console.log(`📖 Swagger docs at http://localhost:${app.server?.port}/swagger`);

import { API_BASE } from "./config";
import type { Reading } from "../types";

export function createWebSocket(
  onReading?: (r: Reading) => void
): WebSocket {
  let wsUrl: string;
  if (API_BASE) {
    wsUrl = API_BASE.replace(/^http/, "ws") + "/ws";
  } else {
    const { protocol, host } = window.location;
    wsUrl = `${protocol === "https:" ? "wss" : "ws"}://${host}/ws`;
  }
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "new_reading" && onReading) {
        onReading(msg.payload);
      }
    } catch {
      // ignore
    }
  };

  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 30000);

  ws.onclose = () => clearInterval(interval);

  return ws;
}

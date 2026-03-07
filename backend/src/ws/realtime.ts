// Simple WebSocket broadcast manager

type WSClient = {
  send: (data: string) => void;
};

const clients = new Set<WSClient>();

export function addClient(ws: WSClient) {
  clients.add(ws);
}

export function removeClient(ws: WSClient) {
  clients.delete(ws);
}

function broadcast(type: string, payload: any) {
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  for (const client of clients) {
    try {
      client.send(message);
    } catch {
      clients.delete(client);
    }
  }
}

export function broadcastReading(reading: any) {
  broadcast("new_reading", reading);
}

export function broadcastAlert(alert: any) {
  broadcast("new_alert", alert);
}

export function getClientCount() {
  return clients.size;
}

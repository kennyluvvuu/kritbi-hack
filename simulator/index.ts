/**
 * IoT Water Level Sensor Simulator for Kacha River
 *
 * Generates realistic water level readings with:
 * - Seasonal variation (spring flood peaking in April)
 * - Daily tidal/flow cycle
 * - Random noise
 * - Occasional flood spikes
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const SENSOR_ID = Number(process.env.SENSOR_ID) || 1;
const INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS) || 5000;

// Simulation parameters
const BASE_LEVEL = 2.0; // meters
const SEASONAL_AMPLITUDE = 1.5; // spring flood +1.5m
const DAILY_AMPLITUDE = 0.2; // daily variation ±0.2m
const NOISE_STD = 0.08; // noise std deviation
const FLOOD_SPIKE_CHANCE = 0.02; // 2% chance per reading
const FLOOD_SPIKE_MAGNITUDE = 1.5; // additional meters during spike

function gaussianRandom(): number {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function simulateWaterLevel(): number {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  const hourOfDay = now.getHours() + now.getMinutes() / 60;

  // Seasonal component: peaks around day 105 (mid-April)
  const seasonalPhase = ((dayOfYear - 105) / 365) * 2 * Math.PI;
  const seasonal = SEASONAL_AMPLITUDE * Math.exp(-0.5 * Math.pow(seasonalPhase, 2));

  // Daily cycle
  const daily = DAILY_AMPLITUDE * Math.sin((2 * Math.PI * hourOfDay) / 24);

  // Noise
  const noise = NOISE_STD * gaussianRandom();

  // Occasional flood spike
  const spike = Math.random() < FLOOD_SPIKE_CHANCE ? FLOOD_SPIKE_MAGNITUDE * Math.random() : 0;

  const level = Math.max(0.5, BASE_LEVEL + seasonal + daily + noise + spike);

  return Math.round(level * 100) / 100;
}

function simulateTemperature(): number {
  const now = new Date();
  const hourOfDay = now.getHours();
  // Simple daily temperature cycle
  const base = 5 + 10 * Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI);
  return Math.round((base + gaussianRandom() * 2) * 10) / 10;
}

async function waitForBackend(maxAttempts = 30): Promise<void> {
  console.log("⏳ Waiting for backend to be ready...");
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/health`);
      if (resp.ok) {
        console.log("✅ Backend is ready\n");
        return;
      }
    } catch {
      // not ready yet
    }
    console.log(`  attempt ${i + 1}/${maxAttempts}...`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Backend did not become ready in time");
}

async function ensureSensorExists(): Promise<void> {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/sensors`);
    const { data } = (await resp.json()) as { data: Array<{ id: number }> };

    if (data.length === 0) {
      console.log("📡 Creating sensor...");
      const createResp = await fetch(`${BACKEND_URL}/api/sensors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Кача — станция №1",
          location: "Красноярск, мост ул. Качинская",
          latitude: 56.0153,
          longitude: 92.8932,
        }),
      });
      if (createResp.ok) {
        console.log("✅ Sensor created");
      } else {
        console.error("❌ Failed to create sensor:", await createResp.text());
      }
    } else {
      console.log(`✅ Sensor already exists (id=${data[0]?.id})`);
    }
  } catch (e) {
    console.error("❌ ensureSensorExists error:", (e as Error).message);
    throw e;
  }
}


async function sendReading(): Promise<void> {
  const waterLevel = simulateWaterLevel();
  const temperature = simulateTemperature();

  const payload = {
    sensorId: SENSOR_ID,
    waterLevel,
    temperature,
  };

  try {
    const resp = await fetch(`${BACKEND_URL}/api/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      const levelBar = "█".repeat(Math.round(waterLevel * 3));
      const color =
        waterLevel >= 5 ? "\x1b[31m" : waterLevel >= 3 ? "\x1b[33m" : "\x1b[36m";
      console.log(
        `${color}🌊 ${waterLevel.toFixed(2)}m ${levelBar}\x1b[0m  🌡️ ${temperature}°C  [${new Date().toLocaleTimeString()}]`
      );
    } else {
      console.error(`❌ API error: ${resp.status} ${await resp.text()}`);
    }
  } catch (e) {
    console.error(`❌ Connection error: ${(e as Error).message}`);
  }
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  🌊 Kacha River Water Level Simulator       ║");
  console.log(`║  Sensor ID: ${SENSOR_ID}, Interval: ${INTERVAL_MS}ms       ║`);
  console.log(`║  Backend: ${BACKEND_URL}              ║`);
  console.log("╚══════════════════════════════════════════════╝");

  await waitForBackend();
  await ensureSensorExists();

  // Send initial batch of historical data (200 hourly readings)
  console.log("\n📊 Generating initial historical data (200 readings)...");
  const now = new Date();
  for (let i = 200; i > 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    const waterLevel = simulateWaterLevel();
    const temperature = simulateTemperature();

    try {
      await fetch(`${BACKEND_URL}/api/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sensorId: SENSOR_ID,
          waterLevel,
          temperature,
          timestamp: timestamp.toISOString(),
        }),
      });
    } catch {
      // silently continue
    }
  }
  console.log("✅ Historical data generated\n");

  // Start real-time simulation
  console.log("📡 Starting real-time simulation...\n");
  setInterval(sendReading, INTERVAL_MS);
  sendReading();
}

main();

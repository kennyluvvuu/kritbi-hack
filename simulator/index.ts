/**
 * IoT Water Level Sensor Simulator for Kacha River
 *
 * Generates realistic daily readings with:
 * - Seasonal variation (spring flood peaking in April)
 * - Daily tidal/flow cycle
 * - Random noise
 * - Occasional flood spikes
 * - Soil moisture simulation (SMsurf)
 *
 * Sends 30 daily historical readings on startup, then continuous real-time data.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const SENSOR_ID = Number(process.env.SENSOR_ID) || 1;
const INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS) || 5000;
const FORCE_FLOOD = process.env.FORCE_FLOOD === "true";

let floodOffset = 0; // Accumulated flood rise in FORCE_FLOOD mode

// Simulation parameters
const BASE_LEVEL = 40.0; // Base summer level ~ 40cm
const SEASONAL_AMPLITUDE = 120.0; // spring flood max ~ +120cm (peaks ~160cm)
const DAILY_AMPLITUDE = 5.0; // daily variation ±5cm
const NOISE_STD = 4.0; // noise std deviation, cm
const FLOOD_SPIKE_CHANCE = 0.05; // 5% chance per reading
const FLOOD_SPIKE_MAGNITUDE = 50.0; // additional cm during spike

function gaussianRandom(): number {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function getDayOfYear(date: Date): number {
  return Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
}

function simulateWaterLevel(date: Date): number {
  const dayOfYear = getDayOfYear(date);
  const hourOfDay = date.getHours() + date.getMinutes() / 60;

  // Seasonal: peaks around day 105 (mid-April)
  const seasonalPhase = ((dayOfYear - 105) / 365) * 2 * Math.PI;
  const seasonal = SEASONAL_AMPLITUDE * Math.exp(-0.5 * Math.pow(seasonalPhase, 2));

  // Daily cycle
  const daily = DAILY_AMPLITUDE * Math.sin((2 * Math.PI * hourOfDay) / 24);

  // Noise
  const noise = NOISE_STD * gaussianRandom();

  // Occasional flood spike
  const spike =
    Math.random() < FLOOD_SPIKE_CHANCE ? FLOOD_SPIKE_MAGNITUDE * Math.random() : 0;

  // Hackathon Demo: Force Flood Mode
  if (FORCE_FLOOD) {
    floodOffset += 4.0; // Rapidly rise 4cm per reading
  }

  const level = Math.max(10, BASE_LEVEL + seasonal + daily + noise + spike + floodOffset);
  return Math.round(level * 10) / 10;
}

function simulateTemperature(date: Date): number {
  const dayOfYear = getDayOfYear(date);
  // Seasonal temperature: cold in winter, warm in summer
  const seasonal = 10 * Math.sin(((dayOfYear - 80) / 365) * 2 * Math.PI);
  // Daily cycle: warm at 14:00, cold at 04:00
  const hourOfDay = date.getHours();
  const daily = 6 * Math.sin(((hourOfDay - 4) / 24) * 2 * Math.PI);
  const temp = 5 + seasonal + daily + gaussianRandom() * 1.5;
  return Math.round(temp * 10) / 10;
}

function simulateSoilMoisture(date: Date): number {
  const dayOfYear = getDayOfYear(date);
  // Wet in spring (snowmelt + rain), drier in summer, slightly wet in autumn
  const seasonal = 0.35 + 0.20 * Math.cos(((dayOfYear - 120) / 365) * 2 * Math.PI);
  const noise = gaussianRandom() * 0.03;
  return Math.min(1.0, Math.max(0.0, Math.round((seasonal + noise) * 1000) / 1000));
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

async function sendReading(date?: Date): Promise<number> {
  const now = date ?? new Date();
  const waterLevel = simulateWaterLevel(now);
  const temperature = simulateTemperature(now);
  const soilMoisture = simulateSoilMoisture(now);

  const payload: Record<string, unknown> = {
    sensorId: SENSOR_ID,
    waterLevel,
    temperature,
    soilMoisture,
  };
  if (date) {
    payload.timestamp = date.toISOString();
  }

  try {
    const resp = await fetch(`${BACKEND_URL}/api/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (resp.ok && !date) {
      // Only log real-time readings (not historical preload)
      const levelBar = "█".repeat(Math.min(20, Math.round(waterLevel / 10)));
      const color =
        waterLevel >= 150 ? "\x1b[31m" : waterLevel >= 100 ? "\x1b[33m" : "\x1b[36m";
      console.log(
        `${color}🌊 ${waterLevel.toFixed(1)}cm ${levelBar}\x1b[0m  🌡️ ${temperature}°C  💧 SM:${soilMoisture.toFixed(3)}  [${now.toLocaleTimeString()}]`
      );
    } else if (!resp.ok) {
      console.error(`❌ API error: ${resp.status} ${await resp.text()}`);
    }
  } catch (e) {
    console.error(`❌ Connection error: ${(e as Error).message}`);
  }
  return waterLevel;
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  🌊 Kacha River Water Level Simulator       ║");
  console.log(`║  Sensor ID: ${SENSOR_ID}, Interval: ${INTERVAL_MS}ms       ║`);
  console.log(`║  Backend: ${BACKEND_URL}              ║`);
  console.log("╚══════════════════════════════════════════════╝");

  await waitForBackend();
  await ensureSensorExists();

  // Send 30 days of daily historical data (CatBoost needs daily granularity)
  console.log("\n📊 Generating 30 days of daily historical data...");
  const now = new Date();
  for (let i = 30; i > 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    await sendReading(date);
  }
  console.log("✅ Historical data generated (30 daily readings)\n");

  // Start real-time simulation with adaptive sampling
  console.log("📡 Starting adaptive real-time simulation...\n");
  
  let lastWaterLevel = 0;
  
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const waterLevel = await sendReading();
    const velocity = Math.abs(waterLevel - lastWaterLevel);
    lastWaterLevel = waterLevel;

    // Adaptive Strategy:
    // Normal mode: INTERVAL_MS (e.g. 5000ms ≈ 1 hour real-time)
    // Flood threat mode (level > 300cm OR rising > 5cm): 1000ms (≈ 15 mins real-time)
    let currentDelay = INTERVAL_MS;
    
    if (waterLevel >= 300 || velocity >= 5.0) {
      currentDelay = 1000;
      console.log("\x1b[35m⚠️ ТРЕВОЖНЫЙ РЕЖИМ:\x1b[0m Адаптивное увеличение частоты замеров (15 мин)");
    } else {
      console.log("\x1b[32m✅ ОБЫЧНЫЙ РЕЖИМ:\x1b[0m Стандартная частота замеров (1 час)");
    }

    await new Promise((r) => setTimeout(r, currentDelay));
  }
}

main();

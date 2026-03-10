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

// Global cache for historic data by day of year
const historicalDataByDay = new Map<number, { waterLevel: number, temperature: number, soilMoisture: number }[]>();

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
  let waterLevel = simulateWaterLevel(now);
  let temperature = simulateTemperature(now);
  let soilMoisture = simulateSoilMoisture(now);

  const dayOfYear = getDayOfYear(now);
  const dayData = historicalDataByDay.get(dayOfYear);
  
  if (dayData && dayData.length > 0) {
    // Pick a random historical record for this day of the year
    const randIdx = Math.floor(Math.random() * dayData.length);
    const baseData = dayData[randIdx];
    
    // Add random variation 5-10 cm, either positive or negative
    const sign = Math.random() < 0.5 ? -1 : 1;
    const variance = (Math.random() * 5 + 5) * sign;
    
    if (baseData.waterLevel) {
        waterLevel = Math.max(10, baseData.waterLevel + variance + floodOffset);
    }
    if (baseData.temperature) {
        temperature = baseData.temperature + (Math.random() * 2 - 1);
    }
    if (baseData.soilMoisture) {
        soilMoisture = baseData.soilMoisture;
    }
    
    waterLevel = Math.round(waterLevel * 10) / 10;
    temperature = Math.round(temperature * 10) / 10;
  }

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
  console.log("\n📊 Generating 30 days of daily historical data from CSV...");
  
  try {
    const csvContent = await Bun.file("/data/9326_1.csv").text();
    const rows = csvContent.split("\n").filter((r: string) => r.trim() !== "");
    const header = rows[0].split(",");
    
    // Parse all rows into historicalDataByDay
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i].split(",");
        if (row.length < 19) continue;
        const dateParts = row[0].split("-");
        if (dateParts.length === 3) {
            const dateObj = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
            const dayOfYear = getDayOfYear(dateObj);
            
            const data = {
                waterLevel: Number(row[2]),
                temperature: Number(row[7]),
                soilMoisture: Number(row[18])
            };
            
            if (!historicalDataByDay.has(dayOfYear)) {
                historicalDataByDay.set(dayOfYear, []);
            }
            historicalDataByDay.get(dayOfYear)!.push(data);
        }
    }
    
    // date,gauge_id,lvl_sm,q_cms_s,lvl_mbs,q_mm_day,t_max_e5l,t_max_e5,t_min_e5l,t_min_e5,prcp_e5l,prcp_e5,prcp_gpcp,prcp_imerg,prcp_mswep,Eb,Es,Et,SMsurf,SMroot,Ew,Ei,S,E,Ep
    
    // We want the last 30 rows
    const last30Rows = rows.slice(-30);
    
    const now = new Date();
    // Send oldest first
    for (let i = 0; i < last30Rows.length; i++) {
      const row = last30Rows[i].split(",");
      if (row.length < 19) continue;
      
      const waterLevel = Number(row[2]) || simulateWaterLevel(now); // lvl_sm
      const temperature = Number(row[7]) || simulateTemperature(now); // t_max_e5
      const soilMoisture = Number(row[18]) || simulateSoilMoisture(now); // SMsurf
      
      const daysAgo = 30 - i;
      const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      const payload: Record<string, unknown> = {
        sensorId: SENSOR_ID,
        waterLevel,
        temperature,
        soilMoisture,
        timestamp: date.toISOString(),
      };
      
      try {
        const resp = await fetch(`${BACKEND_URL}/api/readings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          console.error(`❌ API error preload: ${resp.status} ${await resp.text()}`);
        }
      } catch (e) {
          console.error(`❌ Connection error preload: ${(e as Error).message}`);
      }
    }
    console.log("✅ Historical data generated from CSV (30 daily readings)\n");
  } catch (err) {
    console.error(`❌ Could not load CSV data, falling back to synthesis: ${(err as Error).message}`);
    // fallback
    const now = new Date();
    for (let i = 30; i > 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      await sendReading(date);
    }
    console.log("✅ Historical data generated (30 daily readings)\n");
  }

  // Start real-time simulation with adaptive sampling
  console.log("📡 Starting adaptive real-time simulation...\n");
  
  let lastWaterLevel = 0;
  
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await sendReading();
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main();

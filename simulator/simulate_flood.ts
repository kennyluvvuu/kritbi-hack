import { file } from "bun";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const SENSOR_ID = Number(process.env.SENSOR_ID) || 1;

async function runFloodSimulation() {
  console.log("🌊 Starting Flood Simulation...");
  console.log(`📡 Backend URL: ${BACKEND_URL}`);
  
  // 1. Read the CSV file
  const csvPath = process.argv[2] || "../predictor/9326_1.csv";
  console.log(`📊 Reading historical data from: ${csvPath}`);
  
  let csvContent;
  try {
    csvContent = await file(csvPath).text();
  } catch (e) {
    console.error(`❌ Could not read CSV file at ${csvPath}.`);
    console.error("Please run this script from the `simulator` directory or provide the path to 9326_1.csv as an argument.");
    process.exit(1);
  }

  const rows = csvContent.split("\n").filter((r: string) => r.trim() !== "");
  
  // Find the maximum water level (lvl_sm is index 2)
  let maxLevel = -1;
  let maxIdx = -1;
  const header = rows[0].split(",");
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].split(",");
    if (row.length < 19) continue;
    
    const lvl_sm = Number(row[2]);
    if (!isNaN(lvl_sm) && lvl_sm > maxLevel) {
      maxLevel = lvl_sm;
      maxIdx = i;
    }
  }

  console.log(`🚨 Found historical peak flood: ${maxLevel} cm on ${rows[maxIdx].split(",")[0]}`);
  
  // Get the 30 days leading up to the flood, BUT stop 3 days before the peak
  // so that the ML model can actually forecast the peak at +72 hours!
  const numDays = 30;
  const daysBeforePeak = 3;
  const endIdx = maxIdx - daysBeforePeak;
  const startIdx = Math.max(1, endIdx - numDays + 1);
  const floodSequence = rows.slice(startIdx, endIdx + 1);
  
  console.log("🧹 Clearing old data for a clean presentation...");
  try {
    const clearResp = await fetch(`${BACKEND_URL}/api/readings/clear`, { method: "DELETE" });
    if (!clearResp.ok) {
      console.warn(`⚠️ Could not clear old data (status ${clearResp.status}). Continuing anyway...`);
    } else {
      console.log("✅ Old data cleared.");
    }
  } catch (e) {
    console.warn(`⚠️ Could not clear old data: ${(e as Error).message}. Continuing anyway...`);
  }
  
  console.log(`📈 Injecting ${floodSequence.length} days of data leading up to the flood into the system...`);
  
  const now = new Date();
  
  for (let i = 0; i < floodSequence.length; i++) {
    const row = floodSequence[i].split(",");
    if (row.length < 19) continue;
    
    const waterLevel = Number(row[2]);
    const temperature = Number(row[7]);
    const soilMoisture = Number(row[18]);
    
    const daysAgo = floodSequence.length - 1 - i;
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    const payload = {
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
      
      if (resp.ok) {
        process.stdout.write("█");
      } else {
        console.error(`\n❌ Error pushing data: ${resp.status} ${await resp.text()}`);
      }
    } catch (e) {
      console.error(`\n❌ Connection error: ${(e as Error).message}`);
    }
    
    // Tiny delay to not hammer the backend instantly
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log("\n✅ Flood simulation data successfully injected!");
  
  console.log("🔮 Triggering a new AI forecast...");
  try {
    const forecastResp = await fetch(`${BACKEND_URL}/api/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensorId: SENSOR_ID }),
    });
    if (forecastResp.ok) {
      console.log("✅ Forecast successfully generated!");
    } else {
      console.warn(`⚠️ Could not trigger forecast: ${forecastResp.status} ${await forecastResp.text()}`);
    }
  } catch (e) {
    console.warn(`⚠️ Could not trigger forecast: ${(e as Error).message}`);
  }

  console.log("🚀 The predictor should now forecast a major flood based on this recent trend.");
  console.log("Refresh the UI to see the updated graph and prediction.");
}

runFloodSimulation().catch(console.error);

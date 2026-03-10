import { db, schema } from "./src/db";
import { desc } from "drizzle-orm";

async function check() {
  const forecasts = await db
    .select()
    .from(schema.forecasts)
    .orderBy(desc(schema.forecasts.createdAt))
    .limit(1);
    
  console.log("Latest forecast:");
  console.dir(forecasts[0], { depth: null });
  
  process.exit(0);
}

check().catch(console.error);

import cron from "cron";
import https from "https";
import http from "http";
import dotenv from "dotenv";
dotenv.config();

// Use API_URL for public server URL (e.g., https://your-app.onrender.com)
// Optionally, API_HEALTH_PATH and API_WARMUP_PATH to customize endpoints.
const API_URL = process.env.API_URL || ""; // e.g., https://your-app.onrender.com
const HEALTH_PATH = process.env.API_HEALTH_PATH || "/api/health";
const WARMUP_PATH = process.env.API_WARMUP_PATH || "/api/warmup";

function pingUrl(urlString) {
  if (!urlString) return;
  try {
    const isHttps = urlString.startsWith("https://");
    const client = isHttps ? https : http;
    client
      .get(urlString, (res) => {
        if (res.statusCode === 200) console.log("[cron] Ping success:", urlString);
        else console.log("[cron] Ping failed:", urlString, res.statusCode);
        res.resume(); // drain
      })
      .on("error", (e) => console.error("[cron] Error while pinging", urlString, e.message));
  } catch (e) {
    console.error("[cron] Ping exception", urlString, e?.message);
  }
}

const job = new cron.CronJob("*/14 * * * *", function () {
  if (!API_URL) {
    console.warn("[cron] API_URL not set; skipping pings");
    return;
  }
  // Ping server health to keep the host awake
  pingUrl(`${API_URL}${HEALTH_PATH}`);
});

const dbjob = new cron.CronJob("0 7 * * *", function () {
  if (!API_URL) {
    console.warn("[cron] API_URL not set; skipping pings");
    return;
  }
  // Ping warmup to issue a tiny Supabase read to keep DB connection hot
  pingUrl(`${API_URL}${WARMUP_PATH}`);
});

export { job, dbjob };


import { supabase } from "../config/db.js";

// GET /api/health
export async function health(req, res) {
  // Simple liveness probe
  return res.status(200).json({ status: "ok", time: new Date().toISOString() });
}

// GET /api/warmup
export async function warmup(req, res) {
  try {
    // Perform a very lightweight Supabase read to keep the connection warm.
    // We'll try to read at most one row from admin_users; if empty, it's fine.
    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .limit(1);

    if (error) {
      // Return 500 but still indicate this was a warmup attempt
      return res.status(500).json({ ok: false, target: "supabase", error: error.message });
    }
    return res.status(200).json({ ok: true, target: "supabase", rows: Array.isArray(data) ? data.length : 0 });
  } catch (e) {
    return res.status(500).json({ ok: false, target: "supabase", error: e?.message || "unknown" });
  }
}

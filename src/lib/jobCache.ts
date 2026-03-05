import fs from "fs";
import path from "path";
import { Job } from "@/types";

export interface JobsSnapshot {
  fetchedAt: string;        // ISO timestamp of when cron ran
  totalFetched: number;     // Jobs fetched before filters
  totalUSA: number;         // After USA filter
  totalRecent: number;      // After 24-hour filter
  jobs: Job[];              // Final filtered list
}

// On Vercel, /tmp is writable (but ephemeral).
// On VPS/local, write to <project>/data/jobs-snapshot.json.
function getCachePath(): string {
  if (process.env.JOBS_CACHE_PATH) return process.env.JOBS_CACHE_PATH;
  // Vercel: VERCEL env var is set to "1"
  if (process.env.VERCEL === "1") return "/tmp/jobs-snapshot.json";
  return path.join(process.cwd(), "data", "jobs-snapshot.json");
}

export function readSnapshot(): JobsSnapshot | null {
  try {
    const p = getCachePath();
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw) as JobsSnapshot;
  } catch {
    return null;
  }
}

export function writeSnapshot(snapshot: JobsSnapshot): void {
  const p = getCachePath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, JSON.stringify(snapshot, null, 2), "utf-8");
}

/** Returns true if the snapshot was written within the last `maxAgeHours` hours. */
export function isSnapshotFresh(snapshot: JobsSnapshot, maxAgeHours = 25): boolean {
  try {
    const age = Date.now() - new Date(snapshot.fetchedAt).getTime();
    return age < maxAgeHours * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

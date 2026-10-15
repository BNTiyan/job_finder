import fs from "fs";
import path from "path";
import { Job } from "@/types";

export interface JobsSnapshot {
  fetchedAt: string;        // ISO timestamp of when cron ran
  totalFetched: number;     // Jobs fetched before filters
  totalUSA: number;         // After USA filter
  totalRecent: number;      // After 48-hour filter
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
    const bundled = path.join(process.cwd(), "data", "jobs-snapshot.json");
    const source = fs.existsSync(p) ? p : bundled;
    if (!fs.existsSync(source)) return null;
    const raw = fs.readFileSync(source, "utf-8");
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
  const temporary = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(snapshot, null, 2), "utf-8");
  fs.renameSync(temporary, p);
}

/** Returns true if the snapshot was written within the last `maxAgeHours` hours. */
export function isSnapshotFresh(snapshot: JobsSnapshot, maxAgeHours = 25): boolean {
  try {
    const age = Date.now() - new Date(snapshot.fetchedAt).getTime();
    return age >= 0 && age < maxAgeHours * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

#!/usr/bin/env node
/**
 * Daily cron script — fetches USA jobs posted in the last 24 hours
 * from all 100 listed companies and saves them to data/jobs-snapshot.json.
 *
 * Usage (run once manually):
 *   node scripts/fetch-jobs.mjs
 *
 * System crontab (runs daily at 4:00 AM EST, handles DST automatically):
 *   0 4 * * * TZ=America/New_York cd /path/to/job_finder && /opt/homebrew/bin/node scripts/fetch-jobs.mjs >> logs/cron.log 2>&1
 *
 * Environment variables:
 *   APP_URL      Base URL of the running Next.js app (default: http://localhost:3000)
 *   CRON_SECRET  Must match CRON_SECRET in the app's env (optional)
 */

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

const ENDPOINT = `${APP_URL}/api/cron/fetch-jobs`;

function log(msg) {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

async function run() {
  log(`Calling ${ENDPOINT} ...`);

  const headers = { "Content-Type": "application/json" };
  if (CRON_SECRET) headers["Authorization"] = `Bearer ${CRON_SECRET}`;

  let res;
  try {
    res = await fetch(ENDPOINT, { headers });
  } catch (err) {
    log(`ERROR: Could not reach ${ENDPOINT} — is the app running?`);
    log(`Details: ${err.message}`);
    process.exit(1);
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    log(`ERROR: HTTP ${res.status} — ${JSON.stringify(body)}`);
    process.exit(1);
  }

  const { stats, durationMs } = body;
  log(`SUCCESS in ${durationMs}ms`);
  log(
    `  Fetched: ${stats.totalFetched} | USA: ${stats.totalUSA} | Recent (24h): ${stats.totalRecent} | No-ATS companies: ${stats.companiesWithNoJobs}`
  );
}

run();

import { NextRequest, NextResponse } from "next/server";
import { fetchJobsForCompanies } from "@/lib/jobFetcher";
import { isUSALocation, isRecentJob } from "@/lib/usaFilter";
import { upsertJobs, logFetchRun } from "@/db";
import { COMPANY_MAP } from "@/data/companies";

// Always fetch fresh — never use Next.js fetch cache
export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";

// Vercel Cron and the standalone script both call this endpoint.
// Protect with CRON_SECRET env var (optional but recommended in production).
export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  console.log(`[cron] Daily job fetch started at ${startedAt}`);

  // ── Fetch all companies in batches of 10 ──────────────────────────────────
  const allIds = Array.from(COMPANY_MAP.keys());
  const BATCH_SIZE = 10;
  const allJobs = [];
  const allNoJobsFor: string[] = [];

  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const batch = allIds.slice(i, i + BATCH_SIZE);
    const { jobs, noJobsFor } = await fetchJobsForCompanies(batch);
    allJobs.push(...jobs);
    allNoJobsFor.push(...noJobsFor);
    console.log(
      `[cron] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allIds.length / BATCH_SIZE)}: +${jobs.length} jobs`
    );
  }

  const totalFetched = allJobs.length;

  // ── Filter: USA only ──────────────────────────────────────────────────────
  const usaJobs = allJobs.filter((j) => isUSALocation(j.location));
  const totalUSA = usaJobs.length;

  // ── Filter: last 24 hours (for stats only — we store ALL USA jobs in DB) ──
  const recentCount = usaJobs.filter((j) => isRecentJob(j.postedAt, 24)).length;

  // ── Upsert all USA jobs into SQLite ───────────────────────────────────────
  upsertJobs(usaJobs, startedAt);

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  // ── Log run metadata ──────────────────────────────────────────────────────
  logFetchRun(startedAt, finishedAt, durationMs, totalFetched, totalUSA, recentCount);

  console.log(
    `[cron] Done in ${durationMs}ms — fetched: ${totalFetched}, USA saved to DB: ${totalUSA}, recent 24h: ${recentCount}`
  );

  return NextResponse.json({
    success: true,
    fetchedAt: startedAt,
    durationMs,
    stats: {
      totalFetched,
      totalUSA,
      totalRecent24h: recentCount,
      companiesWithNoJobs: allNoJobsFor.length,
    },
  });
}

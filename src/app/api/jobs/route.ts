import { NextRequest, NextResponse } from "next/server";
import { fetchJobsForCompanies } from "@/lib/jobFetcher";
import { isUSALocation } from "@/lib/usaFilter";
import { queryJobs, getJobCount, upsertJobs } from "@/db";
import { COMPANY_MAP } from "@/data/companies";
import { Job, JobsApiResponse } from "@/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const companiesParam = searchParams.get("companies") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  // Parse and validate company ids
  const requestedIds = companiesParam
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((id) => id.length > 0 && COMPANY_MAP.has(id));

  const companyIds =
    requestedIds.length > 0 ? requestedIds : Array.from(COMPANY_MAP.keys());

  // ── Serve from SQLite, with live-fetch fallback for companies not in DB ───
  let jobs: Job[];
  const dbCount = getJobCount();

  if (dbCount === 0) {
    // DB is completely empty (first run before cron) — live fetch everything
    const { jobs: rawJobs } = await fetchJobsForCompanies(companyIds);
    jobs = rawJobs.filter((j) => isUSALocation(j.location));
  } else if (requestedIds.length > 0) {
    // Specific companies requested: serve DB results, live-fetch any missing ones
    jobs = queryJobs(requestedIds);

    // Find which requested companies have no DB data
    const inDb = new Set(jobs.map((j) => j.companyId));
    const missingFromDb = requestedIds.filter((id) => !inDb.has(id));

    if (missingFromDb.length > 0) {
      // Live-fetch the missing companies (capped at 20 to avoid timeout)
      const toFetch = missingFromDb.slice(0, 20);
      const { jobs: liveJobs } = await fetchJobsForCompanies(toFetch);
      const usaLive = liveJobs.filter((j) => isUSALocation(j.location));
      if (usaLive.length > 0) {
        // Cache fresh results so subsequent requests are fast
        upsertJobs(usaLive, new Date().toISOString());
        jobs = [...jobs, ...usaLive];
      }
    }
  } else {
    // No filter — return everything from DB
    jobs = queryJobs([]);
  }

  // Sort newest first
  jobs.sort((a, b) => {
    if (!a.postedAt) return 1;
    if (!b.postedAt) return -1;
    return b.postedAt.localeCompare(a.postedAt);
  });

  // ── Paginate ──────────────────────────────────────────────────────────────
  const total = jobs.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safeP = Math.min(page, totalPages);
  const paginatedJobs = jobs.slice((safeP - 1) * PAGE_SIZE, safeP * PAGE_SIZE);

  const response: JobsApiResponse = {
    jobs: paginatedJobs,
    total,
    page: safeP,
    totalPages,
    companiesWithNoJobs: [],
  };

  return NextResponse.json(response);
}

import { NextRequest, NextResponse } from "next/server";
import { fetchJobsForCompanies } from "@/lib/jobFetcher";
import { isUSALocation } from "@/lib/usaFilter";
import { queryJobs, getJobCount } from "@/db";
import { COMPANY_MAP } from "@/data/companies";
import { JobsApiResponse } from "@/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

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

  // ── Serve from SQLite when the cron has populated it ─────────────────────
  // Falls back to live Greenhouse/Lever fetch if the DB is empty (first run).
  let jobs;
  const dbCount = getJobCount();

  if (dbCount > 0) {
    // DB already contains USA-filtered data from the cron
    jobs = queryJobs(requestedIds.length > 0 ? requestedIds : []);
  } else {
    // DB empty → live fetch (triggers on very first run before cron runs)
    const { jobs: rawJobs, noJobsFor: _noJobsFor } =
      await fetchJobsForCompanies(companyIds);
    jobs = rawJobs.filter((j) => isUSALocation(j.location));
  }

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

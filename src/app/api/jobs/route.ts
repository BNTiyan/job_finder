import { NextRequest, NextResponse } from "next/server";
import { readSnapshot, isSnapshotFresh } from "@/lib/jobCache";
import { refreshJobs } from "@/lib/refreshJobs";
import { isRecentJob, isUSALocation } from "@/lib/usaFilter";
import { COMPANY_MAP } from "@/data/companies";
import { JobsApiResponse } from "@/types";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 100;
let refreshInFlight: ReturnType<typeof refreshJobs> | null = null;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const requestedIds = (searchParams.get("companies") ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => COMPANY_MAP.has(id));

  let snapshot = readSnapshot();
  if (process.env.VERCEL !== "1" && (!snapshot || !isSnapshotFresh(snapshot))) {
    try {
      // Coalesce simultaneous requests when a local snapshot needs refreshing.
      if (!refreshInFlight) {
        refreshInFlight = refreshJobs().finally(() => { refreshInFlight = null; });
      }
      await refreshInFlight;
      snapshot = readSnapshot();
    } catch (error) {
      console.error("Job snapshot refresh failed:", error);
      if (!snapshot) {
        return NextResponse.json({ error: "Unable to fetch jobs. Please retry." }, { status: 502 });
      }
    }
  }

  const now = Date.now();
  // Reapply the window at read time so jobs expire between daily refreshes.
  const jobs = (snapshot?.jobs ?? [])
    .filter((job) => isUSALocation(job.location) && isRecentJob(job.postedAt, 48, now))
    .filter((job) => requestedIds.length === 0 || requestedIds.includes(job.companyId))
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
  const total = jobs.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const response: JobsApiResponse = {
    jobs: jobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    total,
    page: safePage,
    totalPages,
    companiesWithNoJobs: [],
  };
  return NextResponse.json(response);
}

import { NextRequest, NextResponse } from "next/server";
import { readSnapshot, isSnapshotFresh } from "@/lib/jobCache";
import { refreshJobs } from "@/lib/refreshJobs";
import { isRecentJob, isUSALocation } from "@/lib/usaFilter";
import { COMPANY_MAP } from "@/data/companies";
import { sponsorshipStatus } from "@/lib/sponsorship";
import { createResumeMatcher, JobFilters } from "@/lib/jobMatching";
import { ResumeData, JobsApiResponse } from "@/types";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 100;
let refreshInFlight: ReturnType<typeof refreshJobs> | null = null;

export async function GET(request: NextRequest) {
  return serveJobs(request);
}

export async function POST(request: NextRequest) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Expected JSON filters and resume." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid search request." }, { status: 400 });
  }
  const resume = body.resume ?? null;
  if (resume && (typeof resume.rawText !== "string" || resume.rawText.length > 50000 ||
    !Array.isArray(resume.skills) || resume.skills.length > 300 ||
    !resume.skills.every((s: unknown) => typeof s === "string" && s.length <= 100))) {
    return NextResponse.json({ error: "Invalid resume data." }, { status: 400 });
  }
  const filters = body.filters;
  if (filters !== undefined && (!filters || typeof filters !== "object" ||
    !["industries", "sources", "jobTypes"].every(key => filters[key] === undefined ||
      (Array.isArray(filters[key]) && filters[key].length <= 30 && filters[key].every((s: unknown) => typeof s === "string"))) ||
    (filters.searchTitle !== undefined && (typeof filters.searchTitle !== "string" || filters.searchTitle.length > 200)) ||
    (filters.visaSponsorship !== undefined && filters.visaSponsorship !== null && typeof filters.visaSponsorship !== "boolean"))) {
    return NextResponse.json({ error: "Invalid job filters." }, { status: 400 });
  }
  return serveJobs(request, resume, { industries: [], sources: [], searchTitle: "", visaSponsorship: null, ...filters });
}

async function serveJobs(request: NextRequest, resume: ResumeData | null = null, filters?: JobFilters) {
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
  let jobs = (snapshot?.jobs ?? [])
    .filter((job) => isUSALocation(job.location) && isRecentJob(job.postedAt, 48, now))
    .map(job => {
      const status = job.sponsorshipStatus ?? sponsorshipStatus(job.description);
      return { ...job, sponsorshipStatus: status, visaSponsorship: status === "unknown" ? undefined : status === "offered" };
    })
    .filter((job) => requestedIds.length === 0 || requestedIds.includes(job.companyId))
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
  if (filters) {
    jobs = jobs.filter(job =>
      (!filters.searchTitle || job.title.toLowerCase().includes(filters.searchTitle.toLowerCase())) &&
      (!filters.jobTypes?.length || filters.jobTypes.includes(job.jobType)) &&
      (!filters.sources.length || filters.sources.includes(job.source)) &&
      (!filters.industries.length || filters.industries.includes(COMPANY_MAP.get(job.companyId)?.industry ?? "")) &&
      (filters.visaSponsorship === null || job.sponsorshipStatus === (filters.visaSponsorship ? "offered" : "not-offered")));
  }
  if (resume) {
    const score = createResumeMatcher(resume, filters?.jobTypes?.includes("Intern"));
    jobs = jobs.map(job => ({ ...job, matchScore: score(job) }))
      .filter(job => (job.matchScore ?? 0) >= 25)
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0) || Date.parse(b.postedAt) - Date.parse(a.postedAt));
  }
  const total = jobs.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const response: JobsApiResponse = {
    jobs: jobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    total,
    page: safePage,
    totalPages,
    companiesWithNoJobs: requestedIds.filter(id => COMPANY_MAP.get(id)?.feedMode === "careers-only"),
  };
  return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
}

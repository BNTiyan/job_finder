import { COMPANY_MAP } from "@/data/companies";
import { fetchJobsForCompanies } from "./jobFetcher";
import { isUSALocation, isRecentJob } from "./usaFilter";
import { carrySummaries } from "./jobEnrichment";
import { readSnapshot, writeSnapshot } from "./jobCache";

/** Shared daily refresh. Only dated USA jobs in the rolling 48-hour window. */
export async function refreshJobs() {
  const startMs = Date.now();
  const fetchedAt = new Date(startMs).toISOString();
  const { jobs: allJobs, noJobsFor } = await fetchJobsForCompanies(Array.from(COMPANY_MAP.keys()));
  if (allJobs.length === 0) {
    throw new Error("No jobs returned by any source; keeping the previous snapshot.");
  }
  const usaJobs = allJobs.filter((job) => isUSALocation(job.location));
  const jobs = carrySummaries(usaJobs.filter((job) => isRecentJob(job.postedAt, 48, startMs)), readSnapshot()?.jobs ?? []);
  writeSnapshot({
    fetchedAt,
    totalFetched: allJobs.length,
    totalUSA: usaJobs.length,
    totalRecent: jobs.length,
    jobs,
  });
  return {
    success: true,
    fetchedAt,
    durationMs: Date.now() - startMs,
    stats: {
      totalFetched: allJobs.length,
      totalUSA: usaJobs.length,
      totalRecent48h: jobs.length,
      companiesWithNoJobs: noJobsFor.length,
    },
  };
}

import { COMPANY_MAP } from "@/data/companies";
import { Job } from "@/types";

const requestOptions = () => ({ cache: "no-store" as const, signal: AbortSignal.timeout(20_000) });
const plain = (text: string) => text.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function jobType(title: string, type = ""): Job["jobType"] {
  if (/\b(intern|internship|co-op)\b/i.test(`${title} ${type}`)) return "Intern";
  if (/part[ _-]?time/i.test(type)) return "Part-time";
  if (/contract|temporary/i.test(type)) return "Contract";
  return "Full-time";
}

/** Rivian's public career-search feed provides full descriptions and source dates. */
export async function fetchRivianJobs(): Promise<Job[]> {
  const jobs: Job[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await fetch(`https://careers.rivian.com/api/jobs?page=${page}&sortBy=posted_date&descending=true&limit=100`, requestOptions());
    if (!response.ok) throw new Error(`Rivian careers returned HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.jobs)) throw new Error("Unexpected Rivian careers response");
    for (const { data: j } of data.jobs) {
      if (!j?.title || !j.req_id || j.searchable === false) continue;
      jobs.push({
        id: `icims-rivian-${j.req_id}`, title: j.title, company: "Rivian", companyId: "rivian",
        location: [j.city, j.state, j.country].filter(Boolean).join(", "),
        description: plain([j.description, j.responsibilities, j.qualifications].filter(Boolean).join(" ")).slice(0, 12000),
        applyUrl: j.apply_url || `https://careers.rivian.com/careers-home/jobs/${j.slug || j.req_id}`,
        postedAt: j.posted_date || "", source: "icims", jobType: jobType(j.title, j.employment_type),
      });
    }
    if (!data.jobs.length || page * 100 >= data.totalCount) break;
  }
  return jobs;
}

/** Workday's public search + posting details; no fabricated collection timestamps. */
export async function fetchPublicWorkdayJobs(companyId: string): Promise<Job[]> {
  const company = COMPANY_MAP.get(companyId);
  if (!company?.scrapedUrl) return [];
  const url = new URL(company.scrapedUrl);
  const tenant = url.hostname.split(".")[0];
  const site = url.pathname.split("/").filter(p => p && !/^[a-z]{2}-[a-z]{2}$/i.test(p))[0];
  const api = `${url.origin}/wday/cxs/${tenant}/${site}`;
  const listings: { title: string; externalPath: string; postedOn?: string }[] = [];
  for (let offset = 0; offset < 20000; offset += 20) {
    const response = await fetch(`${api}/jobs`, {
      ...requestOptions(), method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: "" }),
    });
    if (!response.ok) throw new Error(`Workday ${companyId} returned HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.jobPostings)) throw new Error("Unexpected Workday careers response");
    // Older dated listings cannot enter the 48-hour feed; unknown dates need details.
    listings.push(...data.jobPostings.filter((j: { postedOn?: string }) => {
      const days = j.postedOn?.match(/(\d+)\+? days? ago/i)?.[1];
      return !days || Number(days) <= 2;
    }));
    if (!data.jobPostings.length || offset + data.jobPostings.length >= data.total) break;
  }
  const jobs: Job[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < listings.length) {
      const posting = listings[cursor++];
      try {
        const response = await fetch(`${api}${posting.externalPath}`, requestOptions());
        if (!response.ok) throw new Error(`Posting HTTP ${response.status}`);
        const { jobPostingInfo: j } = await response.json();
        if (!j?.title || j.canApply === false) continue;
        jobs.push({
          id: `wd-${companyId}-${j.jobReqId || j.id}`, title: j.title, company: company.name, companyId,
          location: [j.location, j.country?.descriptor].filter(Boolean).join(", "),
          description: plain(j.jobDescription || "").slice(0, 12000),
          applyUrl: j.externalUrl || `${url.origin}/${site}${posting.externalPath}`,
          postedAt: j.startDate || "", source: "workday", jobType: jobType(j.title, j.timeType),
        });
      } catch { console.warn(`Could not retrieve ${companyId} posting ${posting.externalPath}`); }
    }
  }));
  return jobs;
}

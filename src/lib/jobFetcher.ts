import { fetchPublicWorkdayJobs, fetchRivianJobs } from "./enterpriseJobs";
import { sponsorshipStatus } from "./sponsorship";
import { Job } from "@/types";
import { COMPANY_MAP } from "@/data/companies";

// ─── Greenhouse ─────────────────────────────────────────────────────────────

interface GHJob {
  id: number;
  title: string;
  updated_at: string;
  location: { name: string };
  absolute_url: string;
  content?: string;
}

function parseGreenhouse(data: { jobs: GHJob[] }, companyId: string): Job[] {
  const company = COMPANY_MAP.get(companyId);
  return (data.jobs ?? []).map((j) => {
    const title = j.title;
    const desc = j.content ? stripHtml(j.content) : "";
    return {
      id: `gh-${companyId}-${j.id}`,
      title,
      company: company?.name ?? companyId,
      companyId,
      location: j.location?.name ?? "USA",
      description: desc.slice(0, 12000),
      applyUrl: j.absolute_url,
      postedAt: j.updated_at ?? "",
      source: "greenhouse",
      sponsorshipStatus: sponsorshipStatus(desc),
      visaSponsorship: desc ? detectVisaSponsorship(desc) : undefined,
      jobType: detectJobType(title, desc),
    };
  });
}

// ─── Lever ──────────────────────────────────────────────────────────────────

interface LvPosting {
  id: string;
  text: string;
  createdAt: number;
  categories: { location?: string; team?: string };
  descriptionPlain?: string;
  hostedUrl: string;
  applyUrl: string;
}

function parseLever(data: LvPosting[], companyId: string): Job[] {
  const company = COMPANY_MAP.get(companyId);
  return (data ?? []).map((p) => {
    const title = p.text;
    const desc = p.descriptionPlain ?? "";
    return {
      id: `lv-${companyId}-${p.id}`,
      title,
      company: company?.name ?? companyId,
      companyId,
      location: p.categories?.location ?? "USA",
      description: desc.slice(0, 12000),
      applyUrl: p.applyUrl ?? p.hostedUrl,
      postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : "",
      source: "lever",
      sponsorshipStatus: sponsorshipStatus(desc),
      visaSponsorship: desc ? detectVisaSponsorship(desc) : undefined,
      jobType: detectJobType(title, desc),
    };
  });
}

// ─── Ashby HQ ────────────────────────────────────────────────────────────────

interface AshbyPosting {
  id?: string;
  title: string;
  location?: string;
  address?: { postalAddress?: { addressCountry?: string } };
  secondaryLocations?: { location: string; address?: { addressCountry?: string } }[];
  descriptionPlain?: string;
  descriptionHtml?: string;
  publishedAt?: string;
  employmentType?: string;
  jobUrl?: string;
  applyUrl?: string;
  isListed?: boolean;
}

async function fetchAshbyJobs(companyId: string, slug: string): Promise<Job[]> {
  const company = COMPANY_MAP.get(companyId);
  try {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, {
      headers: { Accept: "application/json" },
      cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.jobs)) return [];
    return (data.jobs as AshbyPosting[]).flatMap((p): Job[] => {
      if (p.isListed === false || !p.title || !(p.applyUrl || p.jobUrl)) return [];
      const locations = [
        { location: p.location ?? "", country: p.address?.postalAddress?.addressCountry },
        ...(p.secondaryLocations ?? []).map(l => ({ location: l.location, country: l.address?.addressCountry })),
      ];
      const us = locations.find(l => /^(US|USA|United States(?: of America)?)$/i.test(l.country ?? ""));
      // Prefer an explicitly US secondary location over a foreign primary office.
      const unknown = locations.find(l => !l.country);
      if (!us && !unknown) return [];
      const desc = p.descriptionPlain || stripHtml(p.descriptionHtml ?? "");
      const employment: Record<string, Job["jobType"]> = {
        FullTime: "Full-time", PartTime: "Part-time", Intern: "Intern", Contract: "Contract", Temporary: "Contract",
      };
      return [{
        id: `ashby-${companyId}-${p.id || p.jobUrl || p.applyUrl}`,
        title: p.title, company: company?.name ?? companyId, companyId,
        location: us ? `${us.location}, USA` : unknown?.location ?? "",
        description: desc.slice(0, 12000),
        applyUrl: (p.applyUrl || p.jobUrl)!,
        postedAt: p.publishedAt ?? "",
        source: "ashby",
        sponsorshipStatus: sponsorshipStatus(desc),
        visaSponsorship: detectVisaSponsorship(desc),
        jobType: employment[p.employmentType ?? ""] ?? detectJobType(p.title, ""),
      }];
    });
  } catch (error) {
    console.error(`Ashby fetch failed for ${companyId}:`, error);
    return [];
  }
}

// ─── SmartRecruiters ─────────────────────────────────────────────────────────

async function fetchSmartRecruitersJobs(companyId: string, srSlug: string): Promise<Job[]> {
  const company = COMPANY_MAP.get(companyId);
  try {
    const res = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${srSlug}/postings?status=PUBLIC&limit=100`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        cache: "no-store", signal: AbortSignal.timeout(20_000),
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    const postings: any[] = data.content ?? [];

    return postings.map((p) => {
      const loc = p.location?.city
        ? `${p.location.city}, ${p.location.country ?? "USA"}`
        : (p.location?.country ?? "USA");
      const rawDesc: string = p.jobAd?.sections?.jobDescription?.text ?? "";
      const desc = stripHtml(rawDesc).slice(0, 500) || `View details on ${company?.name ?? companyId} careers site.`;
      return {
        id: `sr-${companyId}-${p.id}`,
        title: p.name,
        company: company?.name ?? companyId,
        companyId,
        location: loc,
        description: desc,
        applyUrl: `https://jobs.smartrecruiters.com/${srSlug}/${p.id}`,
        postedAt: p.releasedDate ?? new Date().toISOString(),
        source: "scraped",
        sponsorshipStatus: sponsorshipStatus(desc),
      visaSponsorship: desc ? detectVisaSponsorship(desc) : undefined,
        jobType: detectJobType(p.name, desc),
      };
    });
  } catch (err) {
    console.error(`SmartRecruiters fetch failed for ${companyId} (${srSlug}):`, err);
    return [];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function detectVisaSponsorship(text: string): boolean | undefined {
  const status = sponsorshipStatus(text);
  return status === "unknown" ? undefined : status === "offered";
}

function detectJobType(title: string, description: string): Job["jobType"] {
  const full = (title + " " + description).toLowerCase();
  if (full.includes("intern") || full.includes("university grad") || full.includes("internship") || full.includes("co-op")) {
    return "Intern";
  }
  if (full.includes("contract") || full.includes("contractor") || full.includes("temp") || full.includes("seasonal")) {
    return "Contract";
  }
  if (full.includes("part-time") || full.includes("parttime")) {
    return "Part-time";
  }
  return "Full-time";
}

// ─── HTML Scraper ─────────────────────────────────────────────────────────────

async function scraperFetch(url: string, companyId: string): Promise<Job[]> {
  const company = COMPANY_MAP.get(companyId);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const { load } = await import("cheerio");
    const $ = load(html);
    const jobs: Job[] = [];

    // Pattern 1: Specialized company selectors
    if (company?.listSelector) {
      $(company.listSelector).each((_, el) => {
        const title = company.titleSelector
          ? $(el).find(company.titleSelector).first().text().trim()
          : $(el).text().trim();

        let link = company.linkSelector
          ? $(el).find(company.linkSelector).attr("href")
          : $(el).attr("href") || $(el).find("a").attr("href");

        if (title && link && title.length > 3) {
          jobs.push({
            id: `scraped-spec-${companyId}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            company: company.name,
            companyId,
            location: "USA",
            description: "View details on careers site.",
            applyUrl: link.startsWith("http") ? link : new URL(link, url).href,
            postedAt: new Date().toISOString(),
            source: "scraped",
            jobType: detectJobType(title, ""),
          });
        }
      });
    }

    // Pattern 2: Generic fallback selectors
    if (jobs.length === 0) {
      $(".job-result, .posting, .job-item, .job-listing, .direct_joblisting, .job-title-link, [data-job-id]").each((_, el) => {
        const title = $(el).find("h2, h3, .title, .job-title, a").first().text().trim();
        const link = $(el).find("a").attr("href");
        if (title && link && title.length > 3) {
          jobs.push({
            id: `scraped-gen-${companyId}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            company: company?.name ?? companyId,
            companyId,
            location: "USA",
            description: "Found via automated site search.",
            applyUrl: link.startsWith("http") ? link : new URL(link, url).href,
            postedAt: new Date().toISOString(),
            source: "scraped",
            jobType: detectJobType(title, ""),
          });
        }
      });
    }

    return jobs;
  } catch (err) {
    console.error(`Scraping failed for ${companyId}:`, err);
    return [];
  }
}

// ─── Oracle HCM ──────────────────────────────────────────────────────────────

async function fetchOracleCloudJobs(companyId: string): Promise<Job[]> {
  const company = COMPANY_MAP.get(companyId);
  if (!company?.scrapedUrl) return [];

  try {
    const url = new URL(company.scrapedUrl);
    const siteMatch = url.pathname.match(/sites\/(CX_\d+)/);
    const siteNumber = siteMatch ? siteMatch[1] : "CX_1";

    const apiUrl = `https://${url.hostname}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?finder=findReqs;siteNumber=${siteNumber};onlyData=true;limit=100;sortBy=POSTING_DATES_DESC`;

    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: company.scrapedUrl,
        Origin: `https://${url.hostname}`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      cache: "no-store", signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const basePath = url.pathname.split("/requisitions")[0];

    return (data.items ?? []).map((j: any) => ({
      id: `oracle-${companyId}-${j.Id ?? j.RequisitionId}`,
      title: j.Title,
      company: company.name,
      companyId,
      location: j.PrimaryLocation || "USA",
      description: `Requisition: ${j.RequisitionNumber ?? ""}. View details on ${company.name} careers site.`,
      applyUrl: `https://${url.hostname}${basePath}/requisitions/job/${j.Id ?? j.RequisitionId}`,
      postedAt: j.PostedDate || new Date().toISOString(),
      source: "scraped",
      visaSponsorship: detectVisaSponsorship(j.Title ?? ""),
      jobType: detectJobType(j.Title ?? "", ""),
    }));
  } catch (err) {
    console.error(`Oracle Cloud fetch failed for ${companyId}:`, err);
    return [];
  }
}

// ─── Phenom People ────────────────────────────────────────────────────────────

async function fetchPhenomJobs(companyId: string, host: string): Promise<Job[]> {
  const company = COMPANY_MAP.get(companyId);
  const baseUrl = `https://${host}`;

  // Try multiple Phenom People API patterns
  const patterns: Array<() => Promise<any[] | null>> = [
    // Pattern 1: Phenom CX Cloud REST search API
    async () => {
      const res = await fetch(
        `${baseUrl}/api/jobs?country=United+States+of+America&pagesize=100&pagenumber=1`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Referer: baseUrl,
          },
          cache: "no-store", signal: AbortSignal.timeout(20_000),
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.jobs ?? data.results ?? data.data ?? null;
    },
    // Pattern 2: Phenom internal search endpoint
    async () => {
      const res = await fetch(
        `${baseUrl}/phx/api/jobs/search?pageSize=100&pageNumber=1`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          cache: "no-store", signal: AbortSignal.timeout(20_000),
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.jobs ?? data.results ?? data.data ?? null;
    },
    // Pattern 3: Phenom POST search
    async () => {
      const res = await fetch(`${baseUrl}/api/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({ keywords: "", country: "United States of America", pageSize: 100, pageNumber: 1 }),
        cache: "no-store", signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.jobs ?? data.results ?? data.data ?? null;
    },
  ];

  for (const pattern of patterns) {
    try {
      const results = await pattern();
      if (results && Array.isArray(results) && results.length > 0) {
        return results.map((j: any) => ({
          id: `phenom-${companyId}-${j.id ?? j.Id ?? j.jobId ?? Math.random().toString(36).slice(2, 7)}`,
          title: j.title ?? j.Title ?? j.jobTitle ?? "Unknown Position",
          company: company?.name ?? companyId,
          companyId,
          location: j.location ?? j.Location ?? j.city ?? j.primaryLocation ?? "USA",
          description: stripHtml(j.description ?? j.Description ?? j.summary ?? "").slice(0, 500) || `View on ${company?.name} careers site.`,
          applyUrl: j.applyUrl ?? j.url ?? j.jobUrl ?? j.applyLink ?? `${baseUrl}/en/jobs/`,
          postedAt: j.postedDate ?? j.datePosted ?? j.publishedDate ?? new Date().toISOString(),
          source: "scraped" as const,
          visaSponsorship: j.description ? detectVisaSponsorship(j.description) : undefined,
          jobType: detectJobType(j.title ?? j.Title ?? "", j.description ?? ""),
        }));
      }
    } catch {
      continue;
    }
  }

  return [];
}

// ─── GM (Phenom People + Umbraco fallback) ────────────────────────────────────

async function fetchGMJobs(): Promise<Job[]> {
  // 1. Try Phenom People API (primary platform for search-careers.gm.com)
  const phenomJobs = await fetchPhenomJobs("gm", "search-careers.gm.com");
  if (phenomJobs.length > 0) return phenomJobs;

  // 2. Try legacy Umbraco CMS API (POST)
  const commonHeaders = {
    Accept: "application/json",
    "x-ph": "internal",
    Referer: "https://search-careers.gm.com/jobs",
    Origin: "https://search-careers.gm.com",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  try {
    const res = await fetch(
      "https://search-careers.gm.com/umbraco/jobboard/CandidateJobs/GetJobs?culture=en",
      {
        method: "POST",
        headers: { ...commonHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ PageNumber: 1, PageSize: 100, SearchText: "", Filters: [] }),
        cache: "no-store", signal: AbortSignal.timeout(20_000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.Jobs?.length > 0) return mapGMJobs(data.Jobs);
    }
  } catch { /* fall through */ }

  // 3. Try legacy Umbraco API (GET)
  try {
    const res = await fetch(
      "https://search-careers.gm.com/umbraco/jobboard/CandidateJobs/GetJobs?culture=en&pagesize=100&page=1",
      { headers: commonHeaders, cache: "no-store", signal: AbortSignal.timeout(20_000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.Jobs?.length > 0) return mapGMJobs(data.Jobs);
    }
  } catch { /* fall through */ }

  // 4. HTML scrape fallback
  const company = COMPANY_MAP.get("gm");
  if (company?.scrapedUrl) {
    return scraperFetch(company.scrapedUrl, "gm");
  }

  return [];
}

function mapGMJobs(jobsList: any[]): Job[] {
  return jobsList.map((j: any) => ({
    id: `gm-${j.Id ?? Math.random().toString(36).slice(2, 7)}`,
    title: j.Title ?? "Software Engineer",
    company: "General Motors",
    companyId: "gm",
    location: j.Location ?? "USA",
    description: `Team: ${j.Team ?? "Various"}. View details on GM careers site.`,
    applyUrl: j.Url ? `https://search-careers.gm.com${j.Url}` : "https://search-careers.gm.com/jobs",
    postedAt: new Date().toISOString(),
    source: "scraped",
    visaSponsorship: detectVisaSponsorship(j.Title ?? ""),
    jobType: detectJobType(j.Title ?? "", ""),
  }));
}

// ─── Main fetcher ────────────────────────────────────────────────────────────

export async function fetchJobsForCompany(companyId: string): Promise<Job[]> {
  const company = COMPANY_MAP.get(companyId);

  if (company?.feedMode === "careers-only") return [];

  // If the company has an explicit ATS type, route directly (skip GH/Lever attempts)
  if (company?.atsType) {
    const slug = company.atsSlug ?? companyId;
    switch (company.atsType) {
      case "workday": return fetchPublicWorkdayJobs(companyId);
      case "icims": return companyId === "rivian" ? fetchRivianJobs() : [];
      case "ashby": return fetchAshbyJobs(companyId, slug);
      case "greenhouse": {
        try {
          const ghUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
          const res = await fetch(ghUrl, { cache: "no-store", signal: AbortSignal.timeout(20_000), headers: { Accept: "application/json" } });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.jobs) && data.jobs.length > 0) return parseGreenhouse(data, companyId);
          }
        } catch { /* fall through */ }
        break;
      }
      case "lever": {
        try {
          const lvUrl = `https://api.lever.co/v0/postings/${slug}?mode=json`;
          const res = await fetch(lvUrl, { cache: "no-store", signal: AbortSignal.timeout(20_000), headers: { Accept: "application/json" } });
          if (res.ok) {
            const data: LvPosting[] = await res.json();
            if (Array.isArray(data) && data.length > 0) return parseLever(data, companyId);
          }
        } catch { /* fall through */ }
        break;
      }
    }
    return [];
  }

  // ── Generic cascade: Greenhouse → Lever → specialized → scrape ───────────

  // 1. Try Greenhouse
  try {
    const ghUrl = `https://boards-api.greenhouse.io/v1/boards/${companyId}/jobs?content=true`;
    const ghRes = await fetch(ghUrl, {
      cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { Accept: "application/json" },
    });
    if (ghRes.ok) {
      const data = await ghRes.json();
      if (Array.isArray(data.jobs) && data.jobs.length > 0) {
        return parseGreenhouse(data, companyId);
      }
    }
  } catch { /* fall through */ }

  // 2. Try Lever
  try {
    const lvUrl = `https://api.lever.co/v0/postings/${companyId}?mode=json`;
    const lvRes = await fetch(lvUrl, {
      cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { Accept: "application/json" },
    });
    if (lvRes.ok) {
      const data: LvPosting[] = await lvRes.json();
      if (Array.isArray(data) && data.length > 0) {
        return parseLever(data, companyId);
      }
    }
  } catch { /* fall through */ }

  // 3. Specialized handlers removed (no scraping allowed)

  return [];
}

export async function fetchJobsForCompanies(
  companyIds: string[]
): Promise<{ jobs: Job[]; noJobsFor: string[] }> {
  const results = await Promise.allSettled(
    companyIds.map((id) => fetchJobsForCompany(id))
  );

  const jobs: Job[] = [];
  const noJobsFor: string[] = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.length > 0) {
      jobs.push(...r.value);
    } else {
      noJobsFor.push(companyIds[i]);
    }
  });

  // Sort newest first
  jobs.sort((a, b) => {
    if (!a.postedAt) return 1;
    if (!b.postedAt) return -1;
    return b.postedAt.localeCompare(a.postedAt);
  });

  return { jobs, noJobsFor };
}

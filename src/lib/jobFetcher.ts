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
  return (data.jobs ?? []).map((j) => ({
    id: `gh-${companyId}-${j.id}`,
    title: j.title,
    company: company?.name ?? companyId,
    companyId,
    location: j.location?.name ?? "USA",
    description: j.content ? stripHtml(j.content).slice(0, 500) : "",
    applyUrl: j.absolute_url,
    postedAt: j.updated_at ?? "",
    source: "greenhouse",
    visaSponsorship: j.content ? detectVisaSponsorship(j.content) : undefined,
  }));
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
  return (data ?? []).map((p) => ({
    id: `lv-${companyId}-${p.id}`,
    title: p.text,
    company: company?.name ?? companyId,
    companyId,
    location: p.categories?.location ?? "USA",
    description: (p.descriptionPlain ?? "").slice(0, 500),
    applyUrl: p.applyUrl ?? p.hostedUrl,
    postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : "",
    source: "lever",
    visaSponsorship: p.descriptionPlain ? detectVisaSponsorship(p.descriptionPlain) : undefined,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function detectVisaSponsorship(text: string): boolean {
  const lower = text.toLowerCase();
  // Common positive patterns
  const positive = [
    "h1-b", "h1b", "visa sponsorship", "sponsor visa", "sponsorship is available",
    "opt/cpt", "opt-cpt", "stem opt", "sponsorship may be provided"
  ];
  // Common negative patterns
  const negative = [
    "no visa sponsorship", "will not sponsor", "unable to sponsor",
    "must be authorized to work in the us without sponsorship",
    "not provide sponsorship"
  ];

  if (negative.some(p => lower.includes(p))) return false;
  if (positive.some(p => lower.includes(p))) return true;

  return false; // Default to false if nothing mentioned
}

// ─── Scraper ─────────────────────────────────────────────────────────────────

async function scraperFetch(url: string, companyId: string): Promise<Job[]> {
  const company = COMPANY_MAP.get(companyId);
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];

    const html = await res.text();
    const { load } = await import("cheerio");
    const $ = load(html);
    const jobs: Job[] = [];

    // Pattern 1: Specialized company selectors (if provided in companies.ts)
    if (company?.listSelector) {
      $(company.listSelector).each((_, el) => {
        const title = company.titleSelector
          ? $(el).find(company.titleSelector).first().text().trim()
          : $(el).text().trim();

        let link = company.linkSelector
          ? $(el).find(company.linkSelector).attr('href')
          : $(el).attr('href') || $(el).find('a').attr('href');

        if (title && link && title.length > 3) {
          jobs.push({
            id: `scraped-spec-${companyId}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            company: company.name,
            companyId,
            location: "USA",
            description: "View details on careers site.",
            applyUrl: link.startsWith('http') ? link : new URL(link, url).href,
            postedAt: new Date().toISOString(),
            source: "scraped"
          });
        }
      });
    }

    // Pattern 2: List items (Generic fallbacks if specialized failed)
    if (jobs.length === 0) {
      $('.job-result, .posting, .job-item, .job-listing, .direct_joblisting, .job-title-link').each((_, el) => {
        const title = $(el).find('h2, h3, .title, .job-title, a').first().text().trim();
        const link = $(el).find('a').attr('href');
        if (title && link && title.length > 3) {
          jobs.push({
            id: `scraped-gen-${companyId}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            company: company?.name ?? companyId,
            companyId,
            location: "USA",
            description: "Found via automated site search.",
            applyUrl: link.startsWith('http') ? link : new URL(link, url).href,
            postedAt: new Date().toISOString(),
            source: "scraped"
          });
        }
      });
    }

    // Pattern 3: Workday-like JSON in script tags (Simplified)
    if (jobs.length === 0 && html.includes('wd-browser-settings')) {
      // Workday usually requires a full browser or a very specific API call.
      // For now, we'll mark it as needing a manual check if generic fails.
    }

    return jobs;
  } catch (err) {
    console.error(`Scraping failed for ${companyId}:`, err);
    return [];
  }
}

// ─── Company Specific Fetchers ───────────────────────────────────────────────

async function fetchWorkdayJobs(companyId: string): Promise<Job[]> {
  const company = COMPANY_MAP.get(companyId);
  if (!company?.scrapedUrl) return [];

  try {
    // Workday API pattern: https://tenant.wd5.myworkdayjobs.com/wday/cxs/tenant/Site/jobs
    const url = new URL(company.scrapedUrl);
    const tenant = url.hostname.split('.')[0];
    const pathParts = url.pathname.split('/').filter(Boolean);
    const site = pathParts[0] || 'External';

    const apiUrl = `https://${url.hostname}/wday/cxs/${tenant}/${site}/jobs`;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 100,
        offset: 0,
        searchText: ""
      }),
      next: { revalidate: 3600 }
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.jobPostings ?? []).map((j: any) => {
      // Construct full URL with en-US and site prefix
      // Example: https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced/job/...
      const fullPath = `/en-US/${site}${j.externalPath}`;
      return {
        id: `wd-${companyId}-${j.bulletFields?.[0] || j.externalPath}`,
        title: j.title,
        company: company.name,
        companyId,
        location: j.locationsText || "USA",
        description: `Posted: ${j.postedOn || 'Recently'}. View details on ${company.name} careers site.`,
        applyUrl: `https://${url.hostname}${fullPath}`,
        postedAt: new Date().toISOString(),
        source: "scraped",
        visaSponsorship: detectVisaSponsorship(j.title)
      };
    });
  } catch (err) {
    console.error(`Workday fetch failed for ${companyId}:`, err);
    return [];
  }
}

async function fetchGoogleJobs(): Promise<Job[]> {
  try {
    const res = await fetch('https://www.google.com/about/careers/applications/_/HiringCportalFrontendUi/data/batchexecute?rpcids=tDsND', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        'X-Same-Domain': '1',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: `f.req=%5B%5B%5B%22tDsND%22%2C%22%5Bnull%2Cnull%2C%5B%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5D%5D%2C1%5D%22%2Cnull%2C%22generic%22%5D%5D%5D`,
      next: { revalidate: 3600 }
    });

    if (!res.ok) return [];
    const text = await res.text();
    // Google Batchexecute returns a weird nested JSON inside a string
    const match = text.match(/\["w77Byb","(.*?)",/);
    if (!match) return [];

    // This part is complex due to Google's obfuscated JSON structure,
    // but we can extract titles and links with regex for a robust fallback.
    const jobs: Job[] = [];
    const titles = text.matchAll(/"([^"]+?)"/g);
    // ... simplified parsing for brevity ...
    return []; // Placeholder until full parser is verified
  } catch (err) {
    console.error("Google Fetch failed:", err);
    return [];
  }
}

async function fetchOracleCloudJobs(companyId: string): Promise<Job[]> {
  const company = COMPANY_MAP.get(companyId);
  if (!company?.scrapedUrl) return [];

  try {
    const url = new URL(company.scrapedUrl);
    // Extract site from the URL (e.g., CX_1)
    const siteMatch = url.pathname.match(/sites\/(CX_\d+)/);
    const siteNumber = siteMatch ? siteMatch[1] : 'CX_1';

    // API endpoint for Oracle Cloud HCM
    const apiUrl = `https://${url.hostname}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?finder=findReqs;siteNumber=${siteNumber};onlyData=true;limit=100;sortBy=POSTING_DATES_DESC`;

    const res = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': company.scrapedUrl,
        'Origin': `https://${url.hostname}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      next: { revalidate: 3600 }
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.items ?? []).map((j: any) => ({
      id: `oracle-${companyId}-${j.Id || j.RequisitionId}`,
      title: j.Title,
      company: company.name,
      companyId,
      location: j.PrimaryLocation || "USA",
      description: `Requisition: ${j.RequisitionNumber}. View details on ${company.name} careers site.`,
      applyUrl: `https://${url.hostname}${url.pathname.split('/requisitions')[0]}/requisitions/job/${j.Id || j.RequisitionId}`,
      postedAt: j.PostedDate || new Date().toISOString(),
      source: "scraped",
      visaSponsorship: detectVisaSponsorship(j.Title)
    }));
  } catch (err) {
    console.error(`Oracle Cloud fetch failed for ${companyId}:`, err);
    return [];
  }
}

async function fetchGMJobs(): Promise<Job[]> {
  const commonHeaders = {
    'Accept': 'application/json',
    'x-ph': 'internal',
    'Referer': 'https://search-careers.gm.com/jobs',
    'Origin': 'https://search-careers.gm.com',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  // 1. Try POST (Most robust)
  try {
    const res = await fetch('https://search-careers.gm.com/umbraco/jobboard/CandidateJobs/GetJobs?culture=en', {
      method: 'POST',
      headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ PageNumber: 1, PageSize: 100, SearchText: "", Filters: [] }),
      next: { revalidate: 3600 }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.Jobs?.length > 0) return mapGMJobs(data.Jobs);
    }
  } catch (err) {
    console.warn("GM POST fetch failed, trying GET...");
  }

  // 2. Try GET (Fallback API)
  try {
    const res = await fetch('https://search-careers.gm.com/umbraco/jobboard/CandidateJobs/GetJobs?culture=en&pagesize=100&page=1', {
      headers: commonHeaders,
      next: { revalidate: 3600 }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.Jobs?.length > 0) return mapGMJobs(data.Jobs);
    }
  } catch (err) {
    console.warn("GM GET fetch failed.");
  }

  // 3. Last Resort: Scraper using selectors from companies.ts
  const company = COMPANY_MAP.get('gm');
  if (company?.scrapedUrl) {
    try {
      return await scraperFetch(company.scrapedUrl, 'gm');
    } catch {
      return [];
    }
  }

  return [];
}

function mapGMJobs(jobsList: any[]): Job[] {
  return jobsList.map((j: any) => ({
    id: `gm-${j.Id || Math.random().toString(36).slice(2, 7)}`,
    title: j.Title || "Software Engineer",
    company: "General Motors",
    companyId: "gm",
    location: j.Location || "USA",
    description: `Team: ${j.Team || 'Various'}. View details on GM careers site.`,
    applyUrl: j.Url ? `https://search-careers.gm.com${j.Url}` : "https://search-careers.gm.com/jobs",
    postedAt: new Date().toISOString(),
    source: "scraped",
    visaSponsorship: detectVisaSponsorship(j.Title || "")
  }));
}

// ─── Main fetcher ────────────────────────────────────────────────────────────

export async function fetchJobsForCompany(companyId: string): Promise<Job[]> {
  // 1. Try Greenhouse
  try {
    const ghUrl = `https://boards-api.greenhouse.io/v1/boards/${companyId}/jobs`;
    const ghRes = await fetch(ghUrl, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });
    if (ghRes.ok) {
      const data = await ghRes.json();
      if (Array.isArray(data.jobs) && data.jobs.length > 0) {
        return parseGreenhouse(data, companyId);
      }
    }
  } catch {
    // fall through
  }

  // 2. Try Lever
  try {
    const lvUrl = `https://api.lever.co/v0/postings/${companyId}?mode=json`;
    const lvRes = await fetch(lvUrl, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });
    if (lvRes.ok) {
      const data: LvPosting[] = await lvRes.json();
      if (Array.isArray(data) && data.length > 0) {
        return parseLever(data, companyId);
      }
    }
  } catch {
    // fall through
  }

  // 3. Try Scraper or specialized handlers
  try {
    // Specialized handlers for companies that block simple scraping
    if (companyId === 'gm') {
      const gmJobs = await fetchGMJobs();
      if (gmJobs.length > 0) return gmJobs;
    }

    // Oracle Cloud HCM sites (Ford, JPMorgan, Oracle)
    const oracleCloudSites = ['ford', 'jpmorgan', 'oracle'];
    if (oracleCloudSites.includes(companyId)) {
      const oracleJobs = await fetchOracleCloudJobs(companyId);
      if (oracleJobs.length > 0) return oracleJobs;
    }

    const company = COMPANY_MAP.get(companyId);

    // Check if company uses Workday (most common for blocking sites)
    if (company?.scrapedUrl?.includes('myworkdayjobs.com')) {
      const wdJobs = await fetchWorkdayJobs(companyId);
      if (wdJobs.length > 0) return wdJobs;
    }

    if (company?.scrapedUrl) {
      const scrapedJobs = await scraperFetch(company.scrapedUrl, companyId);
      if (scrapedJobs.length > 0) return scrapedJobs;
    }
  } catch {
    // fall through
  }

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

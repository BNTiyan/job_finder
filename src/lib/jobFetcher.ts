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

    // Heuristic-based scraping for common patterns
    // This is a "generic" scraper that looks for common job board classes/ids

    // Pattern 1: Table rows (Apple style)
    if (companyId === 'apple') {
      $('.resultsTableHeader').parent().find('tr').each((_, el) => {
        const title = $(el).find('.table--column-title').text().trim();
        const location = $(el).find('.table--column-location').text().trim();
        const link = $(el).find('a').attr('href');
        if (title && link) {
          jobs.push({
            id: `scraped-${companyId}-${title.toLowerCase().replace(/\s+/g, '-')}`,
            title,
            company: company?.name ?? "Apple",
            companyId,
            location: location || "USA",
            description: "View job details on Apple's career site.",
            applyUrl: link.startsWith('http') ? link : `https://jobs.apple.com${link}`,
            postedAt: new Date().toISOString(),
            source: "scraped"
          });
        }
      });
    }

    // Pattern 2: List items (Generic fallbacks)
    if (jobs.length === 0) {
      $('.job-result, .posting, .job-item, .job-listing').each((_, el) => {
        const title = $(el).find('h2, h3, .title').first().text().trim();
        const link = $(el).find('a').attr('href');
        if (title && link) {
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

    return jobs;
  } catch (err) {
    console.error(`Scraping failed for ${companyId}:`, err);
    return [];
  }
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

  // 3. Try Scraper (for companies like Apple/Mercedes)
  try {
    const company = COMPANY_MAP.get(companyId);
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

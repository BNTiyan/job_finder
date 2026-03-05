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
    source: "greenhouse" as const,
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
    source: "lever" as const,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  // 3. Nothing found – caller will show "Visit Careers Page" link
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

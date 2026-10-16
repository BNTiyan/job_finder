import { load } from "cheerio";
import { Job } from "@/types";
import { sponsorshipStatus } from "./sponsorship";
import { isUSALocation } from "./usaFilter";

const origin = "https://www.careers.ford.com";
const options = () => ({ cache: "no-store" as const, signal: AbortSignal.timeout(20_000) });

/** Parse the employer's named JobPosting fields, never embedded executable code. */
export function parseFordPosting(html: string, url: string): Job | null {
  const $ = load(html);
  for (const element of $('script[type="application/ld+json"]').toArray()) {
    try {
      const data = JSON.parse($(element).text());
      const nodes = Array.isArray(data) ? data : data["@graph"] ?? [data];
      const posting = nodes.find((node: { "@type"?: string | string[] }) =>
        node["@type"] === "JobPosting" || (Array.isArray(node["@type"]) && node["@type"].includes("JobPosting")));
      if (!posting?.title) continue;
      const locations = (Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation])
        .filter(Boolean).map((location: { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string | { name?: string } } }) => {
          const address = location.address ?? {};
          const country = typeof address.addressCountry === "string" ? address.addressCountry : address.addressCountry?.name;
          return { label: [address.addressLocality, address.addressRegion, country].filter(Boolean).join(", "), country };
        });
      const eligible = locations.find((loc: { label: string; country?: string }) => {
        if (loc.country && /^[A-Z]{2,3}$/i.test(loc.country) && !/^(US|USA)$/i.test(loc.country)) return false;
        return isUSALocation(loc.label);
      });
      const location = eligible?.label;
      if (!location) return null;
      const desc = load(posting.description ?? "").text().replace(/\s+/g, " ").trim();
      const id = posting.identifier?.value || new URL(url).pathname.split("/").filter(Boolean).at(-1);
      const type = Array.isArray(posting.employmentType) ? posting.employmentType.join(" ") : posting.employmentType ?? "";
      return {
        id: `ford-${id}`, title: posting.title, company: "Ford Motor Company", companyId: "ford",
        location, description: desc.slice(0, 12000), applyUrl: url,
        postedAt: typeof posting.datePosted === "string" ? posting.datePosted : "",
        source: "company", sponsorshipStatus: sponsorshipStatus(desc),
        jobType: /\b(intern|internship|co-op)\b/i.test(posting.title) ? "Intern"
          : /PART[_ -]?TIME/i.test(type) ? "Part-time" : /CONTRACT|TEMPORARY/i.test(type) ? "Contract" : "Full-time",
      };
    } catch { /* A malformed structured-data block is not a posting. */ }
  }
  return null;
}

export async function fetchFordJobs(): Promise<Job[]> {
  const links = new Set<string>();
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    const response = await fetch(`${origin}/en/search-jobs?p=${page}`, options());
    if (!response.ok) throw new Error(`Ford search returned HTTP ${response.status}`);
    const $ = load(await response.text());
    const container = $("#search-results");
    if (!container.length) throw new Error("Ford search markup changed");
    const reported = Number(container.attr("data-total-pages"));
    if (!Number.isInteger(reported) || reported < 1 || reported > 200) throw new Error("Invalid Ford pagination");
    pages = reported;
    $("#search-results-list a[data-job-id]").each((_, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      const url = new URL(href, origin);
      if (url.origin === origin && /\/job\//.test(url.pathname)) links.add(url.href);
    });
  }
  const pending = [...links];
  const jobs: Job[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < pending.length) {
      const url = pending[cursor++];
      try {
        const response = await fetch(url, options());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const job = parseFordPosting(await response.text(), url);
        if (job) jobs.push(job);
      } catch { console.warn(`Could not retrieve Ford posting ${url}`); }
    }
  }));
  return jobs;
}

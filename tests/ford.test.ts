import assert from "node:assert/strict";
import test from "node:test";
import { parseFordPosting, fetchFordJobs } from "../src/lib/fordJobs";
import { fetchJobsForCompany } from "../src/lib/jobFetcher";

const posting = (country = "US", date: string | undefined = "2026-10-15") => `<script type="application/ld+json">${JSON.stringify({
  "@type": "JobPosting", title: "Functional Safety Engineer", identifier: { value: "72900" },
  datePosted: date, description: "<p>ISO 26262, HARA and safety validation</p>", employmentType: "FULL_TIME",
  jobLocation: { address: { addressLocality: "Dearborn", addressRegion: "MI", addressCountry: country } },
})}</script>`;

test("Ford uses source dates and structured requirements, and rejects foreign countries", () => {
  const job = parseFordPosting(posting(), "https://www.careers.ford.com/en/job/engineer/48560/123");
  assert.equal(job?.id, "ford-72900");
  assert.equal(job?.postedAt, "2026-10-15");
  assert.equal(job?.description, "ISO 26262, HARA and safety validation");
  assert.equal(job?.source, "company");
  assert.equal(parseFordPosting(posting("MX"), "https://www.careers.ford.com/en/job/123"), null);
  assert.equal(parseFordPosting(posting("US", ""), "https://www.careers.ford.com/en/job/123")?.postedAt, "");
  assert.equal(parseFordPosting('<script type="application/ld+json">not JSON</script>', "https://www.careers.ford.com"), null);
});

test("Ford paginates search results, fetches details and keeps careers-only sources out", async () => {
  const saved = globalThis.fetch;
  let lists = 0;
  globalThis.fetch = async url => {
    const parsed = new URL(String(url));
    if (parsed.pathname.endsWith("search-jobs")) {
      lists++;
      const page = parsed.searchParams.get("p");
      return new Response(`<section id="search-results" data-total-pages="2"></section><div id="search-results-list"><a data-job-id="${page}" href="/en/job/engineer/${page}">Engineer</a><a data-job-id="bad" href="https://example.com/job/bad">External</a></div>`);
    }
    assert.equal(parsed.hostname, "www.careers.ford.com");
    return new Response(posting());
  };
  try {
    const jobs = await fetchFordJobs();
    assert.equal(lists, 2);
    assert.equal(jobs.length, 2);
    globalThis.fetch = async () => { throw new Error("Must not fetch unavailable feeds"); };
    assert.deepEqual(await fetchJobsForCompany("google"), []);
    assert.deepEqual(await fetchJobsForCompany("tesla"), []);
  } finally { globalThis.fetch = saved; }
});

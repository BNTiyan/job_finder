import assert from "node:assert/strict";
import test from "node:test";
import { fetchJobsForCompany } from "../src/lib/jobFetcher";
import { isRecentJob } from "../src/lib/usaFilter";

test("Ashby routes to the public API and preserves dates, listing visibility, employment and US locations", async () => {
  const originalFetch = globalThis.fetch;
  const publishedAt = new Date().toISOString();
  const base = { id: "1", title: "Platform Engineer", location: "Toronto", descriptionPlain: "Build Kubernetes platforms.",
    address: { postalAddress: { addressCountry: "CAN" } }, jobUrl: "https://jobs.ashbyhq.com/openai/1", publishedAt, employmentType: "FullTime", isListed: true };
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.ashbyhq.com/posting-api/job-board/openai");
    assert.equal(options?.cache, "no-store");
    return Response.json({ jobs: [
      { ...base, secondaryLocations: [{ location: "San Francisco, CA", address: { addressCountry: "USA" } }] },
      { ...base, id: "foreign" },
      { ...base, id: "hidden", isListed: false, address: { postalAddress: { addressCountry: "USA" } } },
      { ...base, id: "undated", publishedAt: undefined, address: undefined, location: "New York, NY", employmentType: "PartTime" },
    ] });
  };
  try {
    const jobs = await fetchJobsForCompany("openai");
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].postedAt, publishedAt);
    assert.equal(jobs[0].source, "ashby");
    assert.equal(jobs[0].location, "San Francisco, CA, USA");
    assert.equal(jobs[0].jobType, "Full-time");
    assert.equal(jobs[1].jobType, "Part-time");
    assert.equal(isRecentJob(jobs[1].postedAt), false);
  } finally { globalThis.fetch = originalFetch; }
});

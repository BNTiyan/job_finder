import assert from "node:assert/strict";
import test from "node:test";
import { fetchJobsForCompany } from "../src/lib/jobFetcher";
import { isRecentJob } from "../src/lib/usaFilter";

test("Rivian paginates the official feed and keeps source dates and full requirements", async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    const page = new URL(String(url)).searchParams.get("page");
    const data = { req_id: page, title: "Software Engineer", city: "Irvine", state: "CA", country: "United States", description: "<p>Python APIs</p>", qualifications: "Kubernetes", posted_date: "2026-10-15T12:00:00Z", employment_type: "FULL_TIME" };
    return Response.json({ jobs: [{ data }], totalCount: page === "1" ? 101 : 101 });
  };
  try {
    const jobs = await fetchJobsForCompany("rivian");
    assert.equal(calls, 2);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].source, "icims");
    assert.equal(jobs[0].postedAt, "2026-10-15T12:00:00Z");
    assert.match(jobs[0].description, /Python APIs Kubernetes/);
  } finally { globalThis.fetch = saved; }
});

test("Cox uses Workday details for dates, skips older listings and preserves unknown dates", async () => {
  const saved = globalThis.fetch;
  let detailCalls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("/jobs")) {
      const { offset } = JSON.parse(options!.body as string);
      const posting = { title: "Engineer", externalPath: `/job/Engineer-${offset}`, postedOn: "Posted Today" };
      return Response.json({ total: 21, jobPostings: offset === 0 ? [posting, ...Array.from({ length: 19 }, () => ({ ...posting, postedOn: "Posted 9 Days Ago" }))] : [posting] });
    }
    detailCalls++;
    return Response.json({ jobPostingInfo: { id: String(detailCalls), title: "Engineer", canApply: true, location: "Atlanta", country: { descriptor: "United States" }, startDate: detailCalls === 1 ? "2026-10-15" : undefined, jobDescription: "<p>Python Kubernetes</p>" } });
  };
  try {
    const jobs = await fetchJobsForCompany("cox");
    assert.equal(detailCalls, 2);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].source, "workday");
    assert.ok(jobs.some(job => job.postedAt === "2026-10-15"));
    assert.ok(jobs.some(job => job.postedAt === "" && !isRecentJob(job.postedAt)));
    globalThis.fetch = async () => { throw new Error("Careers-only entries must not fetch"); };
    assert.deepEqual(await fetchJobsForCompany("adp"), []);
  } finally { globalThis.fetch = saved; }
});

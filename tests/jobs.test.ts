import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/jobs/route";
import { refreshJobs } from "../src/lib/refreshJobs";
import { readSnapshot, writeSnapshot } from "../src/lib/jobCache";
import { isRecentJob } from "../src/lib/usaFilter";

test("48-hour boundary excludes unknown, invalid, older and future dates", () => {
  const now = Date.now();
  const iso = (hours: number) => new Date(now - hours * 3600000).toISOString();
  assert.equal(isRecentJob(iso(48), 48, now), true);
  assert.equal(isRecentJob(iso(48.001), 48, now), false);
  assert.equal(isRecentJob(iso(1), 48, now), true);
  assert.equal(isRecentJob(iso(-1), 48, now), false);
  assert.equal(isRecentJob("", 48, now), false);
  assert.equal(isRecentJob("invalid", 48, now), false);
});

test("daily refresh persists only recent USA jobs; API expires jobs and preserves snapshot on failure", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "job-feed-test-"));
  const originalFetch = globalThis.fetch;
  const originalPath = process.env.JOBS_CACHE_PATH;
  process.env.JOBS_CACHE_PATH = path.join(directory, "jobs.json");
  const now = Date.now();
  const fixture = (id: number, hours: number, location = "New York, NY") => ({
    id, title: "Software Engineer", updated_at: new Date(now - hours * 3600000).toISOString(),
    location: { name: location }, absolute_url: `https://example.com/jobs/${id}`,
  });
  globalThis.fetch = async (input, options) => {
    assert.equal(options?.cache, "no-store");
    return String(input).includes("/boards/stripe/jobs")
      ? Response.json({ jobs: [fixture(1, 1), fixture(2, 47), fixture(3, 49), fixture(4, -1),
          fixture(5, 1, "London, UK"), { ...fixture(6, 1), updated_at: "" }] })
      : new Response(null, { status: 404 });
  };
  try {
    const result = await refreshJobs();
    assert.equal(result.stats.totalRecent48h, 2);
    assert.deepEqual(readSnapshot()?.jobs.map((job) => job.id), ["gh-stripe-1", "gh-stripe-2"]);
    const response = await GET(new NextRequest("http://localhost/api/jobs?companies=stripe&page=invalid"));
    const body = await response.json();
    assert.equal(body.total, 2);
    assert.equal(body.page, 1);
    assert.equal((await (await GET(new NextRequest("http://localhost/api/jobs?companies=brex"))).json()).total, 0);
    const before = readFileSync(process.env.JOBS_CACHE_PATH, "utf8");
    globalThis.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(refreshJobs(), /No jobs returned/);
    assert.equal(readFileSync(process.env.JOBS_CACHE_PATH, "utf8"), before);
    const snapshot = readSnapshot()!;
    snapshot.jobs[0].postedAt = new Date(now - 49 * 3600000).toISOString();
    writeSnapshot(snapshot);
    const expired = await (await GET(new NextRequest("http://localhost/api/jobs"))).json();
    assert.equal(expired.total, 1);
    const originalVercel = process.env.VERCEL;
    try {
      process.env.VERCEL = "1";
      snapshot.fetchedAt = new Date(now - 30 * 3600000).toISOString();
      writeSnapshot(snapshot);
      globalThis.fetch = async () => { throw new Error("Hosted API must not fetch sources or call an LLM"); };
      assert.equal((await (await GET(new NextRequest("http://localhost/api/jobs"))).json()).total, 1);
    } finally {
      if (originalVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = originalVercel;
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalPath === undefined) delete process.env.JOBS_CACHE_PATH;
    else process.env.JOBS_CACHE_PATH = originalPath;
    rmSync(directory, { recursive: true, force: true });
  }
});

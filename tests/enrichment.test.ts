import assert from "node:assert/strict";
import test from "node:test";
import { carrySummaries, enrichmentHash, enrichJobs } from "../src/lib/jobEnrichment";
import { Job } from "../src/types";

const job = (id: string, hours = 0): Job => ({
  id, title: "Engineer", company: "Example", companyId: "example", location: "New York, NY",
  description: "Build TypeScript services.", applyUrl: "https://example.com/jobs/" + id,
  postedAt: new Date(Date.now() - hours * 3600000).toISOString(), source: "greenhouse", jobType: "Full-time",
});

test("runner enrichment is bounded, reusable, invalidated by changes and resilient to outages", async () => {
  const originalFetch = globalThis.fetch;
  const originalVercel = process.env.VERCEL;
  delete process.env.VERCEL;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const body = JSON.parse(options!.body as string);
    assert.equal(body.max_tokens, 150);
    const data = JSON.parse(body.messages[1].content);
    assert.equal(data.description, "Build TypeScript services.");
    assert.equal("resume" in data, false);
    return Response.json({ choices: [{ message: { content: "Build services using TypeScript." } }] });
  };
  try {
    const jobs = [job("old", 2), job("new", 1)];
    const stats = await enrichJobs(jobs, { limit: 1 });
    assert.equal(stats.generated, 1);
    assert.equal(jobs[0].aiSummary, undefined);
    assert.equal(jobs[1].aiSummary?.inputHash, enrichmentHash(jobs[1]));
    const carried = carrySummaries([job("new", 1)], jobs);
    await enrichJobs(carried);
    assert.equal(calls, 1);
    assert.equal(carrySummaries([{ ...job("new"), description: "Changed requirements" }], jobs)[0].aiSummary, undefined);
    assert.equal((await enrichJobs([job("none")], { budgetMs: 0 })).attempted, 0);
    globalThis.fetch = async () => { throw new Error("Server unavailable"); };
    const failed = await enrichJobs([job("1"), job("2"), job("3"), job("4")]);
    assert.equal(failed.failures, 3);
    assert.equal(failed.attempted, 3);
    assert.equal(failed.generated, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});

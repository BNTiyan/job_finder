import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/jobs/route";
import { containsSkill, scoreJob } from "../src/lib/jobMatching";
import { writeSnapshot } from "../src/lib/jobCache";
import { Job, ResumeData } from "../src/types";

const resume: ResumeData = {
  rawText: "AI Platform & Infrastructure Engineer. 11+ years building AWS Kubernetes platforms. Previously mentored interns and student researchers.",
  skills: ["python", "typescript", "aws", "kubernetes", "terraform", "mlflow", "ui", "ux", "agile"],
  keywords: ["design", "platform", "student"],
};
const job = (title: string, description = "Build Python AWS Kubernetes Terraform platforms.", jobType: Job["jobType"] = "Full-time"): Job => ({
  id: title, title, description, jobType, company: "Stripe", companyId: "stripe", location: "New York, NY",
  applyUrl: "https://example.com/job", source: "greenhouse", postedAt: new Date().toISOString(),
});

test("senior platform resume does not match product design or internships through generic keywords", () => {
  assert.equal(scoreJob(job("[Summer 2027] Product Design Intern", "UI UX agile design", "Intern"), resume), 0);
  assert.equal(scoreJob(job("Product Designer", "UI UX agile design"), resume), 0);
  assert.equal(scoreJob(job("Senior Hardware Engineer - GPU & AI Infrastructure"), resume), 0);
  assert.equal(scoreJob(job("Software Engineering Intern", "Python AWS", "Intern"), resume), 0);
  assert.ok(scoreJob(job("Senior AI Platform Engineer"), resume) >= 70);
  assert.ok(scoreJob(job("Senior Backend Engineer"), resume) >= 50);
  assert.ok(scoreJob(job("Software Engineering Intern", "Python AWS", "Intern"), resume, true) > 0);
  assert.equal(containsSkill("ReactJS and Node.js C++", "react"), true);
  assert.equal(containsSkill("JavaScript", "java"), false);
  assert.equal(containsSkill("container", "ai"), false);
});

test("API ranks the entire company snapshot before pagination and applies explicit job-type filters", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "matching-test-"));
  const original = process.env.JOBS_CACHE_PATH;
  process.env.JOBS_CACHE_PATH = path.join(directory, "jobs.json");
  try {
    const jobs = Array.from({ length: 105 }, (_, i) => ({ ...job("Product Designer"), id: String(i) }));
    jobs.push(job("Senior AI Platform Engineer"));
    writeSnapshot({ fetchedAt: new Date().toISOString(), totalFetched: jobs.length, totalUSA: jobs.length, totalRecent: jobs.length, jobs });
    const request = (body: unknown) => new NextRequest("http://localhost/api/jobs?companies=stripe", { method: "POST", body: JSON.stringify(body) });
    const response = await POST(request({ resume }));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.total, 1);
    assert.equal(data.jobs[0].title, "Senior AI Platform Engineer");
    assert.equal((await (await POST(request({ filters: { jobTypes: ["Intern"] } }))).json()).total, 0);
    assert.equal((await POST(request({ resume: { skills: 123 } }))).status, 400);
    assert.equal((await POST(request({ filters: { sources: "bad" } }))).status, 400);
  } finally {
    if (original === undefined) delete process.env.JOBS_CACHE_PATH;
    else process.env.JOBS_CACHE_PATH = original;
    rmSync(directory, { recursive: true, force: true });
  }
});

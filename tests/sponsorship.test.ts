import assert from "node:assert/strict";
import test from "node:test";
import { sponsorshipStatus } from "../src/lib/sponsorship";
import { SPONSOR_COMPANIES } from "../src/data/sponsorCompanies";
import { COMPANY_MAP, COMPANIES } from "../src/data/companies";
import evidence from "../data/sponsorship-evidence.json";

const norm = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(?:(?:INCORPORATED|CORPORATION|LIMITED|CORP|INC|LLC|LTD))+$/g, "");

test("100 distinct new sponsor employers have source records, approvals and supported boards", () => {
  assert.equal(SPONSOR_COMPANIES.length, 100);
  assert.equal(COMPANIES.length, COMPANY_MAP.size);
  assert.equal(COMPANIES.filter(c => c.sponsorshipHistory).length, 100);
  assert.equal(new Set(SPONSOR_COMPANIES.map(c => c.id)).size, 100);
  assert.equal(evidence.fiscalYear, 2023);
  assert.match(evidence.sourceUrl, /^https:\/\/www\.uscis\.gov\//);
  assert.match(evidence.sourceSha256, /^[a-f0-9]{64}$/);
  for (const company of SPONSOR_COMPANIES) {
    assert.equal(COMPANY_MAP.get(company.id)?.name, company.name);
    assert.ok(["greenhouse", "lever", "ashby"].includes(company.atsType!));
    assert.equal(company.sponsorshipHistory!.fiscalYear, 2023);
    assert.ok(company.sponsorshipHistory!.initialApprovals + company.sponsorshipHistory!.continuingApprovals > 0);
    for (const employer of company.sponsorshipHistory!.employerNames) {
      assert.ok(norm(employer) === norm(company.name) || norm(employer.split(/\bDBA\b/i)[1] || "") === norm(company.name), `Employer mismatch: ${company.name} -> ${employer}`);
    }
  }
});

test("role sponsorship requires an explicit offer; negatives and unknowns stay distinct", () => {
  assert.equal(sponsorshipStatus("We provide visa sponsorship to qualified candidates."), "offered");
  assert.equal(sponsorshipStatus("Visa sponsorship is available for this position."), "offered");
  assert.equal(sponsorshipStatus("We may sponsor eligible candidates."), "offered");
  assert.equal(sponsorshipStatus("We do not offer visa sponsorship."), "not-offered");
  assert.equal(sponsorshipStatus("Must work without sponsorship now or in the future."), "not-offered");
  assert.equal(sponsorshipStatus("H1B sponsorship is not available for this role."), "not-offered");
  assert.equal(sponsorshipStatus("Visa sponsorship is available. However, this role is not eligible for sponsorship."), "not-offered");
  assert.equal(sponsorshipStatus("We welcome OPT/CPT and H1B applicants."), "unknown");
  assert.equal(sponsorshipStatus("Equal opportunity regardless of citizenship or visa sponsorship status."), "unknown");
  assert.equal(sponsorshipStatus(""), "unknown");
});

test("API keeps unknown sponsorship out of both affirmative and negative filters", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { NextRequest } = await import("next/server");
  const { POST } = await import("../src/app/api/jobs/route");
  const { writeSnapshot } = await import("../src/lib/jobCache");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sponsor-filter-"));
  const original = process.env.JOBS_CACHE_PATH;
  process.env.JOBS_CACHE_PATH = path.join(directory, "jobs.json");
  try {
    const descriptions = ["We provide visa sponsorship.", "No visa sponsorship is available.", "H1B and OPT/CPT applicants welcome."];
    writeSnapshot({ fetchedAt: new Date().toISOString(), totalFetched: 3, totalUSA: 3, totalRecent: 3,
      jobs: descriptions.map((description, i) => ({ id: String(i), title: "Engineer", company: "Anyscale", companyId: "anyscale", location: "New York, NY", description, applyUrl: "https://example.com/jobs/" + i, postedAt: new Date().toISOString(), source: "greenhouse", jobType: "Full-time" })) });
    for (const [visaSponsorship, expected] of [[true, "0"], [false, "1"]] as const) {
      const response = await POST(new NextRequest("http://localhost/api/jobs?companies=anyscale", {
        method: "POST", body: JSON.stringify({ filters: { visaSponsorship } }),
      }));
      const data = await response.json();
      assert.equal(data.total, 1);
      assert.equal(data.jobs[0].id, expected);
    }
  } finally {
    if (original === undefined) delete process.env.JOBS_CACHE_PATH;
    else process.env.JOBS_CACHE_PATH = original;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

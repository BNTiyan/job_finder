import fs from "fs";
import path from "path";
import { COMPANY_MAP } from "../src/data/companies";
import { fetchJobsForCompanies } from "../src/lib/jobFetcher";
import { isUSALocation } from "../src/lib/usaFilter";

const STATS_FILE = path.join(process.cwd(), "data", "company-stats.json");
const COMPANIES_TS_FILE = path.join(process.cwd(), "src", "data", "companies.ts");

interface CompanyStats {
  lastJobsSeen: string | null;
  firstZeroSeen: string | null;
}

async function run() {
  console.log("Starting GitHub Fetch Cron...");
  const allIds = Array.from(COMPANY_MAP.keys());
  
  // 1. Fetch in parallel
  console.log(`Fetching jobs for ${allIds.length} companies in parallel...`);
  const { jobs: allJobs, noJobsFor: allNoJobsFor } = await fetchJobsForCompanies(allIds);
  console.log(`Fetched ${allJobs.length} jobs.`);

  // Load existing stats
  let stats: Record<string, CompanyStats> = {};
  if (fs.existsSync(STATS_FILE)) {
    try {
      stats = JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
    } catch {}
  }

  const now = new Date();
  const toDelete: string[] = [];

  // 2. Count jobs per company
  const jobsPerCompany: Record<string, number> = {};
  for (const id of allIds) jobsPerCompany[id] = 0;
  for (const job of allJobs) {
    if (job.companyId) jobsPerCompany[job.companyId]++;
  }

  // 3. Update stats & identify 14-day zero jobs
  for (const id of allIds) {
    if (!stats[id]) {
      stats[id] = { lastJobsSeen: null, firstZeroSeen: null };
    }

    if (jobsPerCompany[id] > 0) {
      stats[id].lastJobsSeen = now.toISOString();
      stats[id].firstZeroSeen = null;
    } else {
      if (!stats[id].firstZeroSeen) {
        stats[id].firstZeroSeen = now.toISOString();
      } else {
        const firstZero = new Date(stats[id].firstZeroSeen!);
        const diffDays = (now.getTime() - firstZero.getTime()) / (1000 * 3600 * 24);
        if (diffDays >= 14) {
          console.log(`Company ${id} has had 0 jobs for > 14 days. Removing...`);
          toDelete.push(id);
        }
      }
    }
  }

  // 4. Remove deleted from companies.ts
  if (toDelete.length > 0) {
    let tsContent = fs.readFileSync(COMPANIES_TS_FILE, "utf-8");
    for (const id of toDelete) {
      // Regex to remove the `{ id: "id_value", ... }` line securely.
      const rgx = new RegExp(`\\s*\\{\\s*id:\\s*"${id}".*?\\},?\\n?`, "g");
      const before = tsContent;
      tsContent = tsContent.replace(rgx, "");
      if (before === tsContent) {
        console.log(`Regex did not match for ${id}.`);
      }
      delete stats[id];
    }
    fs.writeFileSync(COMPANIES_TS_FILE, tsContent, "utf-8");
    console.log(`Deleted ${toDelete.length} companies from src/data/companies.ts.`);
  }

  // Rewrite stats
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf-8");
  console.log("Stats updated.");
  
  console.log(`GitHub Actions run complete. Stats saved to ${STATS_FILE}.`);
  if (toDelete.length > 0) {
    console.log(`Removed ${toDelete.length} companies: ${toDelete.join(", ")}.`);
    console.log("The Next.js app's /api/cron/fetch-jobs endpoint handles DB upserts on Vercel.");
  }
}

run().catch((e) => {
  console.error("Script failed:", e);
  process.exit(1);
});

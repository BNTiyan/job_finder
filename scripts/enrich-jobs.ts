import { readSnapshot, writeSnapshot } from "../src/lib/jobCache";
import { enrichJobs } from "../src/lib/jobEnrichment";

async function run() {
  const snapshot = readSnapshot();
  if (!snapshot) throw new Error("Fetch jobs before running enrichment.");
  const limit = Number(process.env.JOB_AI_LIMIT || 100);
  const budgetMs = Number(process.env.JOB_AI_BUDGET_MS || 480000);
  if (!Number.isInteger(limit) || limit < 0 || !Number.isFinite(budgetMs) || budgetMs < 0) {
    throw new Error("JOB_AI_LIMIT and JOB_AI_BUDGET_MS must be non-negative numbers (limit must be an integer).");
  }
  const stats = await enrichJobs(snapshot.jobs, { limit, budgetMs });
  writeSnapshot(snapshot);
  console.log(JSON.stringify(stats, null, 2));
  if (stats.failures > 0) console.warn("Some AI summaries could not be generated; job listings remain available.");
  if (stats.attempted > 0 && stats.generated === 0 && stats.failures > 0) process.exitCode = 1;
}
run().catch(error => { console.error("Job enrichment failed:", error.message); process.exitCode = 1; });

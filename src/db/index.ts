import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { Job } from "@/types";

// ─── DB path ────────────────────────────────────────────────────────────────

function getDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.VERCEL === "1") return "/tmp/jobs.db";
  return path.join(process.cwd(), "data", "jobs.db");
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    company     TEXT NOT NULL,
    company_id  TEXT NOT NULL,
    location    TEXT DEFAULT '',
    description TEXT DEFAULT '',
    apply_url   TEXT NOT NULL,
    posted_at   TEXT DEFAULT '',
    source      TEXT NOT NULL,
    visa_sponsorship INTEGER DEFAULT 0,
    job_type    TEXT DEFAULT 'Full-time',
    fetched_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_posted  ON jobs(posted_at DESC);
  CREATE INDEX IF NOT EXISTS idx_jobs_fetched ON jobs(fetched_at DESC);

  CREATE TABLE IF NOT EXISTS fetch_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at      TEXT NOT NULL,
    finished_at     TEXT,
    duration_ms     INTEGER DEFAULT 0,
    total_fetched   INTEGER DEFAULT 0,
    total_usa       INTEGER DEFAULT 0,
    total_recent_24h INTEGER DEFAULT 0
  );
`;

// ─── Singleton connection ────────────────────────────────────────────────────

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");  // better concurrency
  _db.pragma("foreign_keys = ON");

  // Migrations for columns added after initial schema
  const migrations = [
    "ALTER TABLE jobs ADD COLUMN job_type TEXT DEFAULT 'Full-time'",
    "ALTER TABLE jobs ADD COLUMN visa_sponsorship INTEGER DEFAULT 0",
  ];
  for (const sql of migrations) {
    try { _db.exec(sql); } catch { /* column already exists */ }
  }

  _db.exec(INIT_SQL);
  return _db;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export interface DbJob {
  id: string;
  title: string;
  company: string;
  company_id: string;
  location: string;
  description: string;
  apply_url: string;
  posted_at: string;
  source: string;
  visa_sponsorship: number;
  job_type: string;
  fetched_at: string;
}

/** Convert a DB row back to the app's Job type */
function toJob(row: DbJob): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    companyId: row.company_id,
    location: row.location,
    description: row.description,
    applyUrl: row.apply_url,
    postedAt: row.posted_at,
    source: row.source as Job["source"],
    visaSponsorship: !!row.visa_sponsorship,
    jobType: (row.job_type || "Full-time") as Job["jobType"],
  };
}

/** Upsert a batch of jobs. Existing rows are replaced so data stays fresh. */
export function upsertJobs(jobs: Job[], fetchedAt: string): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO jobs
      (id, title, company, company_id, location, description, apply_url, posted_at, source, visa_sponsorship, job_type, fetched_at)
    VALUES
      (@id, @title, @company, @company_id, @location, @description, @apply_url, @posted_at, @source, @visa_sponsorship, @job_type, @fetched_at)
  `);

  const insertMany = db.transaction((rows: Job[]) => {
    for (const j of rows.filter(r => r.title && r.company && r.applyUrl)) {
      insert.run({
        id: j.id,
        title: j.title,
        company: j.company,
        company_id: j.companyId,
        location: j.location ?? "",
        description: j.description ?? "",
        apply_url: j.applyUrl,
        posted_at: j.postedAt ?? "",
        source: j.source,
        visa_sponsorship: j.visaSponsorship ? 1 : 0,
        job_type: j.jobType,
        fetched_at: fetchedAt,
      });
    }
  });

  insertMany(jobs);
}

/** Query jobs with optional company filter. Returns all matching rows. */
export function queryJobs(companyIds: string[]): Job[] {
  const db = getDb();

  const rows =
    companyIds.length > 0
      ? (db
        .prepare(
          `SELECT * FROM jobs
             WHERE company_id IN (${companyIds.map(() => "?").join(",")})
             ORDER BY posted_at DESC, fetched_at DESC`
        )
        .all(...companyIds) as DbJob[])
      : (db
        .prepare(
          `SELECT * FROM jobs
             ORDER BY posted_at DESC, fetched_at DESC`
        )
        .all() as DbJob[]);

  return rows.map(toJob);
}

/** Total number of jobs currently stored. */
export function getJobCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as n FROM jobs").get() as { n: number };
  return row.n;
}

/** Log a completed cron run. */
export function logFetchRun(
  startedAt: string,
  finishedAt: string,
  durationMs: number,
  totalFetched: number,
  totalUSA: number,
  totalRecent24h: number
): void {
  getDb()
    .prepare(
      `INSERT INTO fetch_runs (started_at, finished_at, duration_ms, total_fetched, total_usa, total_recent_24h)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(startedAt, finishedAt, durationMs, totalFetched, totalUSA, totalRecent24h);
}

/** Return the last N fetch run records. */
export function getRecentRuns(limit = 10) {
  return getDb()
    .prepare(
      `SELECT * FROM fetch_runs ORDER BY id DESC LIMIT ?`
    )
    .all(limit);
}

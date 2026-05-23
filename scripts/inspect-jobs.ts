import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'jobs.db');
const db = new Database(dbPath);

const rows = db.prepare("SELECT location, COUNT(*) as count FROM jobs GROUP BY location ORDER BY count DESC").all() as { location: string, count: number }[];

console.log("Total unique locations:", rows.length);
console.log("Top 30 locations:");
console.log(rows.slice(0, 30));

const allJobs = db.prepare("SELECT title, company, location, posted_at FROM jobs ORDER BY posted_at DESC LIMIT 20").all();
console.log("\nLatest 20 jobs:");
console.log(JSON.stringify(allJobs, null, 2));

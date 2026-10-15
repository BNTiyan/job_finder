import { NextRequest, NextResponse } from "next/server";
import { refreshJobs } from "@/lib/refreshJobs";

// Always fetch fresh — never use Next.js fetch cache
export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";

// Vercel Cron and the remote refresh helper call this endpoint.
// Protect with CRON_SECRET env var (optional but recommended in production).
export async function GET(request: NextRequest) {
  if (process.env.VERCEL === "1") {
    return NextResponse.json({ error: "Hosted job refresh runs through the daily GitHub Actions workflow." }, { status: 410 });
  }
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    return NextResponse.json(await refreshJobs());
  } catch (error) {
    console.error("Daily refresh failed:", error);
    return NextResponse.json({ error: "Job refresh failed; previous snapshot retained" }, { status: 502 });
  }
}

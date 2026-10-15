import { NextRequest, NextResponse } from "next/server";
import { FitInput, generateFitAnswer, LocalLlmError } from "@/lib/localLlm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (process.env.VERCEL === "1") {
    return NextResponse.json({ error: "Job summaries are generated daily. Personalized answers are available when running the app locally." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected job details and resume text." }, { status: 400 });
  }
  const fields = body as Record<string, unknown>;
  if (typeof fields.resumeText !== "string" || !fields.resumeText.trim()) {
    return NextResponse.json({ error: "Please upload your resume first." }, { status: 400 });
  }
  for (const key of ["jobTitle", "jobDescription", "companyName"] as const) {
    if (typeof fields[key] !== "string") {
      return NextResponse.json({ error: `Missing or invalid ${key}.` }, { status: 400 });
    }
  }
  if ([fields.resumeText, fields.jobDescription, fields.jobTitle, fields.companyName]
    .some(value => (value as string).length > 100_000)) {
    return NextResponse.json({ error: "Job details or resume text are too large." }, { status: 413 });
  }
  try {
    const fitReason = await generateFitAnswer(fields as unknown as FitInput);
    return NextResponse.json({ fitReason });
  } catch (error) {
    if (error instanceof LocalLlmError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to generate a fit answer." }, { status: 500 });
  }
}

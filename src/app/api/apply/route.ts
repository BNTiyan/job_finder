import { NextRequest, NextResponse } from "next/server";
import { applyToGreenhouse, applyToLever, UserProfile } from "@/lib/applyService";
import { Job } from "@/types";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { job, profile }: { job: Job; profile: UserProfile } = body;

        if (!job || !profile) {
            return NextResponse.json({ success: false, error: "Missing job or profile data." }, { status: 400 });
        }

        let result;
        if (job.source === "greenhouse") {
            result = await applyToGreenhouse(job, profile);
        } else if (job.source === "lever") {
            result = await applyToLever(job, profile);
        } else {
            return NextResponse.json({ success: false, error: "Unsupported job source for auto-apply." }, { status: 400 });
        }

        if (result.success) {
            return NextResponse.json({ success: true, message: result.message });
        } else {
            return NextResponse.json({ success: false, error: result.message }, { status: 400 });
        }
    } catch (err: any) {
        console.error("Auto-apply error:", err);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

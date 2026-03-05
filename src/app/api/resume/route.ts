import { NextRequest, NextResponse } from "next/server";
import { parseResume } from "@/lib/resumeParser";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type;
    const fileName = file.name ?? "resume";

    // Validate file type
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const validExts = ["pdf", "docx", "txt"];

    if (!validTypes.includes(mimeType) && !validExts.includes(ext)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF, DOCX, or TXT." },
        { status: 400 }
      );
    }

    // Limit file size to 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const resumeData = await parseResume(buffer, mimeType, fileName);

    return NextResponse.json(resumeData);
  } catch (error) {
    console.error("Resume parsing error:", error);
    return NextResponse.json(
      { error: "Failed to parse resume. Please try another file." },
      { status: 500 }
    );
  }
}

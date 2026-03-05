import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
    try {
        const { jobTitle, jobDescription, companyName, resumeText } = await req.json();

        if (!resumeText) {
            return NextResponse.json({ error: "Please upload your resume first." }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
      You are helping a candidate apply for a job. Based on the candidate's resume and the job details below, write a SHORT, PERSUASIVE response (max 100 words) for the question: "Why are you a good fit for this role?" or "Why this company?".

      COMPANY: ${companyName}
      JOB TITLE: ${jobTitle}
      JOB DESCRIPTION: ${jobDescription}

      CANDIDATE'S RESUME:
      ${resumeText.slice(0, 4000)}

      INSTRUCTIONS:
      - Use specific keywords from the resume that match the job.
      - Sound professional but excited.
      - Keep it under 100 words.
      - Do not include placeholders like "[Your Name]".
    `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        return NextResponse.json({ fitReason: text.trim() });
    } catch (err) {
        console.error("AI Fit generation failed:", err);
        return NextResponse.json({ error: "Failed to generate AI response." }, { status: 500 });
    }
}

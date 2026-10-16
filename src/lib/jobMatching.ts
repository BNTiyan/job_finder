import { Job, ResumeData } from "@/types";

export interface JobFilters {
  industries: string[];
  sources: string[];
  searchTitle: string;
  visaSponsorship: boolean | null;
  jobTypes?: string[];
}

const SOFT = new Set(["agile", "scrum", "jira", "leadership", "communication", "collaboration", "analytical", "cross-functional", "teamwork", "testing", "git", "github", "ui", "ux", "security"]);
const PLATFORM = /\b(platform|infrastructure|mlops|devops|site reliability|sre|cloud|distributed systems)\b/i;
const AI = /\b(ai|ml|llm|machine learning|generative ai|agent|artificial intelligence)\b/i;
const ENGINEERING = /\b(engineer|engineering|developer|architect|software|backend|back.end|full.stack|frontend|front.end)\b/i;
const DESIGN = /\b(product design|product designer|ux designer|ui designer|visual design|graphic design|brand design|user researcher)\b/i;

/** Token boundaries also handle C++, C#, ReactJS and Node.js without substring hits. */
export function containsSkill(text: string, skill: string): boolean {
  const aliases: Record<string, string[]> = {
    react: ["react", "reactjs", "react.js"], "node.js": ["node.js", "nodejs", "node js"],
    javascript: ["javascript", "js"], typescript: ["typescript"],
    kubernetes: ["kubernetes", "k8s"], postgresql: ["postgresql", "postgres"],
    aws: ["aws", "amazon web services"], gcp: ["gcp", "google cloud"],
  };
  return (aliases[skill.toLowerCase()] ?? [skill]).some(alias => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
  });
}

/** Explainable relevance heuristic, not a probability of getting hired. */
export function scoreJob(job: Job, resume: ResumeData, includeInternships = false): number {
  const heading = resume.rawText.slice(0, 1600);
  const technical = [...new Set(resume.skills.map(skill => skill.toLowerCase()))].filter(skill => !SOFT.has(skill));
  const engineeringProfile = ENGINEERING.test(heading) || technical.length >= 4;
  const senior = /\b(senior|staff|principal|lead|architect)\b/i.test(heading) || /\b(?:[5-9]|[1-9]\d)\+?\s*years?\b/i.test(heading);
  const internship = job.jobType === "Intern" || /\b(intern|internship|co-op)\b/i.test(job.title);
  if (!includeInternships && senior && (internship || /\b(new grad|entry.level|graduate program|junior)\b/i.test(job.title))) return 0;
  if (engineeringProfile && DESIGN.test(job.title) && !DESIGN.test(heading.slice(0, 300))) return 0;
  if (engineeringProfile && !ENGINEERING.test(job.title) && !AI.test(job.title) && !PLATFORM.test(job.title)) return 0;

  const specialty = job.title.match(/\b(hardware|electrical|mechanical|civil|structural|manufacturing|chemical|facilities)\b/i)?.[1];
  if (engineeringProfile && specialty && !/\b(software|developer|firmware|embedded)\b/i.test(job.title) &&
      !containsSkill(heading, specialty)) return 0;

  const text = `${job.title} ${job.description}`;
  const hits = technical.filter(skill => containsSkill(text, skill)).length;
  let roleScore = engineeringProfile && ENGINEERING.test(job.title) ? 30 : 0;
  if (PLATFORM.test(heading) && PLATFORM.test(job.title)) roleScore += 20;
  if (AI.test(heading) && AI.test(job.title)) roleScore += 15;
  if (!engineeringProfile && !roleScore && !hits) return 0;
  const skillScore = Math.min(30, hits * 5);
  const seniority = senior && /\b(senior|staff|principal|lead|architect)\b/i.test(job.title) ? 5 : 0;
  return Math.min(100, roleScore + skillScore + seniority);
}

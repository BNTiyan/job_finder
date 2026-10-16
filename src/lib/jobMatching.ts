import { Job, ResumeData } from "@/types";

export interface JobFilters {
  industries: string[];
  sources: string[];
  searchTitle: string;
  visaSponsorship: boolean | null;
  jobTypes?: string[];
}

const SOFT = new Set(["agile", "scrum", "jira", "leadership", "communication", "collaboration", "analytical", "cross-functional", "teamwork", "testing", "git", "github", "ui", "ux", "security"]);
// Responsibilities and concrete tools provide evidence across the whole resume.
const FAMILIES = [
  ["platform", "infrastructure", "kubernetes", "terraform", "aws", "azure", "gcp", "site reliability", "observability", "distributed systems"],
  ["python", "java", "node.js", "fastapi", "django", "flask", "spring", "graphql", "microservices", "restful", "backend", "sdk"],
  ["react", "typescript", "javascript", "angular", "frontend", "accessibility", "html", "css"],
  ["machine learning", "deep learning", "llm", "rag", "langchain", "langgraph", "mlflow", "kubeflow", "model deployment", "computer vision", "mlops"],
  ["etl", "data pipeline", "airflow", "sql", "postgresql", "spark", "redshift", "iceberg", "data engineering"],
  ["pytest", "jest", "selenium", "test automation", "automation framework", "tdd", "unit testing", "integration testing", "validation", "jenkins"],
  ["adas", "aspice", "doors", "v-model", "object detection", "sensor fusion", "automotive", "requirements traceability"],
  ["scrum master", "sprint planning", "agile delivery", "retrospectives", "stakeholder management", "team leadership"],
  ["product designer", "ux designer", "user research", "figma", "wireframes", "prototyping", "design system", "usability testing", "interaction design"],
];
const SPECIALTIES: [RegExp, string[]][] = [
  [/\b(product design|product designer|ux designer|ui designer|visual design|user researcher)\b/i, FAMILIES[8]],
  [/\b(hardware|electrical)\b/i, ["hardware engineer", "electrical engineer", "fpga", "verilog", "rtl", "asic", "pcb", "circuit design"]],
  [/\b(mechanical|civil|structural|chemical)\b/i, ["mechanical engineer", "civil engineer", "structural engineer", "chemical engineer", "cad", "solidworks"]],
];

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

/** Relevance from responsibilities and skills anywhere in the resume, not title identity. */
export function createResumeMatcher(resume: ResumeData, includeInternships = false): (job: Job) => number {
  const history = resume.rawText;
  const senior = /\b(?:[5-9]|[1-9]\d)\+?\s*years?\b/i.test(history.slice(0, 2000)) ||
    /\b(senior|staff|principal|lead|architect)\s+(?:software|engineer|developer|platform|infrastructure)/i.test(history);
  const technical = [...new Set(resume.skills.map(skill => skill.toLowerCase()))]
    .filter(skill => !SOFT.has(skill) && !["ai", "ml", "api", "r-language"].includes(skill));
  const practiced = SPECIALTIES.map(([pattern, evidence]) => {
    const hits = evidence.filter(term => containsSkill(history, term));
    return { pattern, supported: hits.length >= 2 || hits.some(term => /designer|engineer|research/.test(term)) };
  });
  const experience = FAMILIES.map(terms => ({ terms,
    evidence: new Set(terms.filter(term => containsSkill(history, term) || technical.includes(term))),
  }));
  return (job: Job): number => {
    const internship = job.jobType === "Intern" || /\b(intern|internship|co-op)\b/i.test(job.title);
    if (!includeInternships && senior && (internship || /\b(new grad|entry.level|early.career|university grad|graduate program|junior)\b/i.test(job.title))) return 0;

    // Specialized disciplines need specific evidence, including in earlier roles.
    for (const { pattern, supported } of practiced) {
      if (pattern.test(job.title) && !/\b(software|firmware|embedded)\b/i.test(job.title) && !supported) return 0;
    }

    // Description provides primary evidence; title is only supplementary context.
    const requirements = job.description.trim() || job.title;
    const text = `${requirements} ${job.title}`;
    const sharedSkills = technical.filter(skill => containsSkill(requirements, skill));
    const familyMatches = experience.map(({ terms, evidence }) => {
      const jobEvidence = terms.filter(term => containsSkill(text, term));
      const shared = jobEvidence.filter(term => evidence.has(term));
      return { jobEvidence, shared };
    }).filter(family => family.shared.length >= 2);
    // A generic engineering title or one incidental keyword cannot establish relevance.
    if (sharedSkills.length < 2 && familyMatches.length === 0) return 0;

    const bestFamily = Math.max(0, ...familyMatches.map(family => family.shared.length / family.jobEvidence.length));
    const responsibilityScore = familyMatches.length ? 25 + Math.round(10 * bestFamily) : 10;
    const jobSkills = technical.filter(skill => containsSkill(text, skill));
    const skillScore = Math.min(35, sharedSkills.length * 7);
    const breadthScore = Math.min(20, familyMatches.length * 5);
    const titleScore = jobSkills.some(skill => containsSkill(job.title, skill)) ? 5 : 0;
    const seniorityScore = senior && /\b(senior|staff|principal|lead|architect)\b/i.test(job.title) ? 5 : 0;
    return Math.min(100, responsibilityScore + skillScore + breadthScore + titleScore + seniorityScore);
  };
}

export function scoreJob(job: Job, resume: ResumeData, includeInternships = false): number {
  return createResumeMatcher(resume, includeInternships)(job);
}

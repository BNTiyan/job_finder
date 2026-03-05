import { ResumeData } from "@/types";

// ─── Skill keywords ──────────────────────────────────────────────────────────

const SKILL_KEYWORDS: string[] = [
  // Languages
  "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
  "ruby", "swift", "kotlin", "scala", "r", "matlab", "perl", "php", "bash",
  "shell", "sql", "html", "css", "sass", "less",
  // Frameworks / Libraries
  "react", "next.js", "vue", "angular", "svelte", "express", "django",
  "flask", "fastapi", "spring", "rails", "laravel", "node.js", "nodejs",
  "graphql", "rest", "grpc", "tailwind",
  // Databases
  "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra",
  "dynamodb", "sqlite", "oracle", "sql server",
  // Cloud / DevOps
  "aws", "azure", "gcp", "google cloud", "kubernetes", "docker", "terraform",
  "ansible", "jenkins", "github actions", "ci/cd", "linux", "nginx",
  "cloudformation", "eks", "ecs", "lambda",
  // Data / ML
  "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
  "scikit-learn", "pandas", "numpy", "spark", "hadoop", "airflow",
  "data pipeline", "etl", "tableau", "power bi", "looker", "dbt",
  // Product / Design
  "product management", "agile", "scrum", "kanban", "jira", "figma",
  "sketch", "ux", "ui", "user research", "a/b testing",
  // Soft skills
  "leadership", "communication", "collaboration", "problem solving",
  "analytical", "teamwork", "mentoring", "cross-functional",
  // Other tech
  "api", "microservices", "event-driven", "rabbitmq", "kafka",
  "git", "github", "gitlab", "bitbucket", "testing", "unit testing",
  "integration testing", "selenium", "cypress", "jest", "pytest",
  "security", "cryptography", "oauth", "jwt", "blockchain", "web3",
  "ios", "android", "react native", "flutter", "mobile",
];

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "was", "with", "this", "that", "from",
  "have", "has", "had", "will", "would", "could", "should", "been",
  "our", "your", "their", "they", "them", "then", "than", "when",
  "where", "what", "which", "who", "how", "all", "any", "can", "may",
  "not", "but", "its", "you", "more", "also", "both", "each", "into",
  "over", "only", "such", "other", "after", "about", "some", "these",
  "those", "work", "team", "role", "year", "years", "experience",
  "working", "strong", "good", "great", "excellent", "responsible",
  "ability", "skills", "knowledge", "using", "across", "within",
  "develop", "support", "help", "build", "use", "make", "look", "ensure",
]);

// ─── Extractors ──────────────────────────────────────────────────────────────

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  return SKILL_KEYWORDS.filter((skill) => lower.includes(skill));
}

function extractKeywords(text: string, excludeSkills: string[]): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        !STOP_WORDS.has(w) &&
        !excludeSkills.includes(w)
    );

  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] ?? 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([w]) => w);
}

// ─── Format handlers ─────────────────────────────────────────────────────────

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  // PDF
  if (mimeType === "application/pdf" || ext === "pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text;
  }

  // DOCX
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Plain text
  return buffer.toString("utf-8");
}

// ─── Main entry ──────────────────────────────────────────────────────────────

export async function parseResume(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ResumeData> {
  const rawText = await extractTextFromBuffer(buffer, mimeType, fileName);
  const skills = extractSkills(rawText);
  const keywords = extractKeywords(rawText, skills);

  return { skills, keywords, rawText: rawText.slice(0, 3000) };
}

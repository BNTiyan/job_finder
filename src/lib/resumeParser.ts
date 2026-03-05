import { ResumeData } from "@/types";
import nlp from "compromise";

// ─── Skill keywords ──────────────────────────────────────────────────────────

const SKILL_KEYWORDS: string[] = [
  // Languages
  "python", "javascript", "typescript", "java", "c++", "c#", "golang", "rust",
  "ruby", "swift", "kotlin", "scala", "r-language", "matlab", "perl", "php", "bash",
  "shell", "sql", "html", "css", "sass", "less",
  // Frameworks / Libraries / Tools
  "react", "next.js", "vue", "angular", "svelte", "express", "django",
  "flask", "fastapi", "spring", "spring boot", "rails", "laravel", "node.js", "nodejs",
  "graphql", "rest", "grpc", "tailwind", "redux", "mobx", "webpack", "vite",
  // Databases
  "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra",
  "dynamodb", "sqlite", "oracle", "sql server", "mariadb", "nebulagraph", "neo4j",
  // Cloud / DevOps / MLOps
  "aws", "azure", "gcp", "google cloud", "kubernetes", "docker", "terraform",
  "ansible", "jenkins", "github actions", "ci/cd", "linux", "nginx",
  "cloudformation", "eks", "ecs", "lambda", "fargate", "sagemaker", "bedrock",
  "vertex ai", "cloud runner", "prometheus", "grafana", "datadog", "new relic",
  "mlflow", "kubeflow", "dvc", "wandb", "airflow", "pelumi", "circleci",
  // Data / AI / ML / LLM
  "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
  "scikit-learn", "pandas", "numpy", "spark", "hadoop", "etl", "data pipeline",
  "tableau", "power bi", "looker", "dbt", "snowflake", "databricks",
  "ai", "ml", "llm", "llms", "artificial intelligence", "generative ai",
  "gen ai", "langchain", "langgraph", "prompt engineering", "openai", "gpt",
  "gemini", "claude", "llama", "mistral", "anthropic", "vector database",
  "pinecone", "milvus", "chromadb", "rag",
  // Banking / Fintech
  "kyc", "aml", "anti-money laundering", "payments", "swift", "pci dss",
  "open banking", "ledger", "fixed income", "derivatives", "equities",
  "trading systems", "wealth management", "credit risk", "basel iii",
  // Retail / E-commerce
  "e-commerce", "shopify", "magento", "inventory management", "pos",
  "supply chain", "logistics", "wms", "merchandising", "crm", "order management",
  // Product / Design
  "product management", "agile", "scrum", "kanban", "jira", "figma",
  "sketch", "ux", "ui", "user research", "a/b testing", "design system",
  // Soft skills
  "leadership", "communication", "collaboration", "problem solving",
  "analytical", "teamwork", "mentoring", "cross-functional",
  // Other tech
  "api", "microservices", "event-driven", "rabbitmq", "kafka",
  "git", "github", "gitlab", "bitbucket", "testing", "unit testing",
  "integration testing", "selenium", "cypress", "jest", "pytest",
  "security", "cryptography", "oauth", "jwt", "blockchain", "web3",
  "ios", "android", "react native", "flutter", "mobile",
  // High-level Roles / Disciplines
  "full stack", "frontend", "backend", "mlops", "devops", "sre",
  "data engineering", "quality assurance", "qa",
  // Automotive / Functional Safety / Systems
  "iso 26262", "iso-26262", "functional safety", "hara", "asil", "asil-d", "asil d",
  "fmea", "fmeda", "fta", "stpa", "sotif", "systems engineering",
  "adas", "eps", "v-model", "aspice", "medini analyze", "doors", "polarion",
  "canalyzer", "canoe", "embedded c", "safety architecture", "safety case",
  "safety goals", "fsc", "tsc", "braking", "chassis", "ecu", "can diagnostics",
  "hil", "sil", "requirement management", "item definition", "safety concept",
  "autosar", "can bus", "lin bus", "ethernet", "misra", "cybersecurity", "iso 21434",
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
  return SKILL_KEYWORDS.filter((skill) => {
    // Use word boundaries for most skills to avoid false positives (e.g., 'react' in 'reaction')
    // We only use simple 'includes' if the skill name itself contains non-word characters
    // that regex \b doesn't handle well (like .js, ++, #)
    const hasSpecialChars = /[\+\.#]/.test(skill);

    if (hasSpecialChars) {
      return lower.includes(skill);
    }

    // Use word boundary check for everything else
    // We escape the skill for regex just in case
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(text);
  });
}

function extractKeywords(text: string, excludeSkills: string[]): string[] {
  const doc = nlp(text);

  // Extract proper nouns and technical looking words
  // Filter out people names (don't want the user's name as a skill)
  const people = new Set(doc.people().text().toLowerCase().split(' '));

  const entities = doc.nouns()
    .not('#Pronoun')
    .not('#Determiner')
    .not('#Adverb')
    .not('#Verb')
    .text()
    .toLowerCase()
    .split(/[\s,.;:]+/)
    .filter(w =>
      w.length > 3 &&
      !STOP_WORDS.has(w) &&
      !excludeSkills.includes(w) &&
      !people.has(w)
    );

  const freq: Record<string, number> = {};
  for (const w of entities) {
    freq[w] = (freq[w] ?? 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30) // Top 30 unique keywords
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

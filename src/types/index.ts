export type Industry =
  | "Tech"
  | "Finance"
  | "Security"
  | "Healthcare"
  | "Education"
  | "Automotive"
  | "Media"
  | "Commerce"
  | "Other";

export interface Company {
  id: string;        // lowercase slug used to query Greenhouse / Lever
  name: string;      // display name
  industry: Industry;
  careersUrl: string;
  scrapedUrl?: string; // URL to scrape directly if not on Greenhouse/Lever
  logoColor: string;   // tailwind bg-* class for placeholder logo
}

export interface Job {
  id: string;
  title: string;
  company: string;     // display name
  companyId: string;
  location: string;
  description: string;
  applyUrl: string;
  postedAt: string;    // ISO date string or empty
  source: "greenhouse" | "lever" | "scraped";
  visaSponsorship?: boolean; // true if sponsorship is mentioned/offered
  matchScore?: number; // 0–100, computed client-side from resume
}

export interface JobsApiResponse {
  jobs: Job[];
  total: number;
  page: number;
  totalPages: number;
  companiesWithNoJobs: string[]; // company ids that returned 0 jobs
}

export interface ResumeData {
  skills: string[];
  keywords: string[];
  rawText: string;
}

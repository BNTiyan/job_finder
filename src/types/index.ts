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

export type AtsType =
  | "greenhouse"
  | "lever"
  | "workday"
  | "ashby"
  | "smartrecruiters"
  | "oracle"
  | "phenom"
  | "icims"
  | "custom";

export interface Company {
  id: string;        // lowercase slug used to query Greenhouse / Lever
  name: string;      // display name
  industry: Industry;
  careersUrl: string;
  scrapedUrl?: string; // URL to scrape directly if not on Greenhouse/Lever
  logoColor: string;   // tailwind bg-* class for placeholder logo
  // Explicit ATS routing (skips Greenhouse/Lever attempts when set)
  atsType?: AtsType;
  atsSlug?: string;  // override slug for ATS if different from company id
  // Scraping selectors (from Selenium config)
  listSelector?: string;
  titleSelector?: string;
  locationSelector?: string;
  linkSelector?: string;
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
  source: "greenhouse" | "lever" | "scraped" | "custom";
  visaSponsorship?: boolean; // true if sponsorship is mentioned/offered
  jobType: "Full-time" | "Part-time" | "Intern" | "Contract" | "Other";
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

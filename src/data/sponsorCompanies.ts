import { Company } from "@/types";
import evidence from "../../data/sponsorship-evidence.json";

// Job boards verified live; USCIS approval history is explicitly dated.
export const SPONSOR_COMPANIES: Company[] = evidence.companies.map(company => ({
  id: company.id,
  name: company.name,
  industry: ["Formlabs","Neuralink","Skydio","Bright Machines","Aescape","OSARO","Path Robotics","Skyryse"].includes(company.name) ? "Automotive" : "Tech",
  careersUrl: company.atsType === "greenhouse" ? `https://job-boards.greenhouse.io/${company.atsSlug}`
    : company.atsType === "lever" ? `https://jobs.lever.co/${company.atsSlug}`
    : `https://jobs.ashbyhq.com/${company.atsSlug}`,
  atsType: company.atsType as Company["atsType"],
  atsSlug: company.atsSlug,
  logoColor: "bg-emerald-700",
  sponsorshipHistory: {
    fiscalYear: evidence.fiscalYear, sourceUrl: evidence.sourceUrl, checkedAt: evidence.checkedAt,
    employerNames: company.employers.map(e => e.employer),
    initialApprovals: company.employers.reduce((n, e) => n + e.initial, 0),
    continuingApprovals: company.employers.reduce((n, e) => n + e.continuing, 0),
  },
}));

"use client";

import { Job } from "@/types";
import { COMPANY_MAP } from "@/data/companies";

interface Props {
  job: Job;
  showMatch?: boolean;
}

function formatDate(iso: string): string {
  if (!iso) return "Recently";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
}

function MatchBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-green-100 text-green-700" :
      score >= 40 ? "bg-yellow-100 text-yellow-700" :
        "bg-gray-100 text-gray-600";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      {score}% match
    </span>
  );
}

function SourceBadge({ source }: { source: Job["source"] }) {
  if (source === "greenhouse") {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-50 text-green-600 border border-green-200">
        Greenhouse
      </span>
    );
  }
  if (source === "lever") {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-600 border border-purple-200">
        Lever
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-50 text-gray-500 border border-gray-200">
      Scraped
    </span>
  );
}

function VisaBadge({ offered }: { offered?: boolean }) {
  if (!offered) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 font-bold uppercase tracking-tight">
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      Sponsorship
    </span>
  );
}

export default function JobCard({ job, showMatch = false }: Props) {
  const company = COMPANY_MAP.get(job.companyId);
  const logoColor = company?.logoColor ?? "bg-gray-500";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Company logo + info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 ${logoColor} rounded-lg flex-shrink-0 flex items-center justify-center`}>
            <span className="text-white font-bold text-sm">
              {job.company.charAt(0)}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-base leading-tight mb-0.5 truncate">
              {job.title}
            </h3>
            <p className="text-sm text-blue-600 font-medium">{job.company}</p>
          </div>
        </div>

        {/* Match badge */}
        {showMatch && job.matchScore !== undefined && (
          <div className="flex-shrink-0">
            <MatchBadge score={job.matchScore} />
          </div>
        )}
      </div>

      {/* Meta info */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        {job.location && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {job.location}
          </span>
        )}
        <span>{formatDate(job.postedAt)}</span>
        <SourceBadge source={job.source} />
        {job.visaSponsorship && <VisaBadge offered={job.visaSponsorship} />}
      </div>

      {/* Description snippet */}
      {job.description && (
        <p className="mt-3 text-sm text-gray-600 line-clamp-2">{job.description}</p>
      )}

      {/* Apply link */}
      <div className="mt-4">
        <a
          href={job.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Apply Now
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}

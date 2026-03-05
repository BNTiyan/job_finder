"use client";

import { useState } from "react";
import { Job } from "@/types";
import { COMPANY_MAP } from "@/data/companies";
import { useProfile } from "@/context/ProfileContext";

interface Props {
  job: Job;
  showMatch?: boolean;
  resumeText?: string;
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

export default function JobCard({ job, showMatch = false, resumeText = "" }: Props) {
  const company = COMPANY_MAP.get(job.companyId);
  const logoColor = company?.logoColor ?? "bg-gray-500";
  const [fitLoading, setFitLoading] = useState(false);
  const [fitReason, setFitReason] = useState<string | null>(null);

  const { profile, isProfileComplete } = useProfile();
  const [applyState, setApplyState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handle1ClickApply = async () => {
    if (!isProfileComplete) {
      alert("Please automatically fill your Quick Apply Profile in the top right corner first!");
      return;
    }
    setApplyState("loading");
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job, profile }),
      });
      const data = await res.json();
      if (data.success) {
        setApplyState("success");
      } else {
        setApplyState("error");
        alert(data.error || "Failed to auto-apply");
      }
    } catch {
      setApplyState("error");
      alert("Network error trying to auto-apply");
    }
  };

  const handleGenerateFit = async () => {
    if (!resumeText) {
      alert("Please upload your resume first!");
      return;
    }
    setFitLoading(true);
    setFitReason(null);
    try {
      const res = await fetch("/api/ai/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: job.title,
          jobDescription: job.description,
          companyName: job.company,
          resumeText
        })
      });
      const data = await res.json();
      if (data.fitReason) setFitReason(data.fitReason);
      else if (data.error) alert(data.error);
    } catch {
      alert("Failed to generate fit answer.");
    } finally {
      setFitLoading(false);
    }
  };

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
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <a
          href={job.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          Open App
        </a>

        {(job.source === 'greenhouse' || job.source === 'lever') && (
          <button
            onClick={handle1ClickApply}
            disabled={applyState === "loading" || applyState === "success"}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg shadow-md transition-all active:scale-95 ${applyState === "success"
                ? "bg-green-100 text-green-700 border border-green-200 shadow-none cursor-default"
                : applyState === "loading"
                  ? "bg-indigo-400 text-white cursor-wait"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
              }`}
          >
            {applyState === "success" ? (
              <>✅ Applied</>
            ) : applyState === "loading" ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>⚡ 1-Click Apply</>
            )}
          </button>
        )}

        <button
          onClick={handleGenerateFit}
          disabled={fitLoading}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all hover:scale-105 active:scale-95"
        >
          {fitLoading ? (
            <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          ) : "✨ AI: Why Me?"}
        </button>
      </div>

      {fitReason && (
        <div className="mt-4 p-4 bg-indigo-900 text-white rounded-xl shadow-inner relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-30">
            <svg className="w-8 h-8 rotate-12" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" /></svg>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-1">Personalized Fit Answer</p>
          <p className="text-[11px] leading-relaxed italic">&quot;{fitReason}&quot;</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(fitReason);
              alert("Answer copied to clipboard!");
            }}
            className="mt-3 text-[10px] font-bold text-indigo-400 hover:text-white flex items-center gap-1 uppercase"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Copy Answer
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import JobCard from "@/components/JobCard";
import ResumeUpload from "@/components/ResumeUpload";
import FilterSidebar from "@/components/FilterSidebar";
import { Job, JobsApiResponse, ResumeData } from "@/types";
import { COMPANY_MAP } from "@/data/companies";

interface Filters {
  industries: string[];
  sources: string[];
  searchTitle: string;
  visaSponsorship: boolean | null; // null means "All"
  jobTypes?: string[];
}

// ─── Inner page component ────────────────────────────────────────────────────

function JobsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const companiesParam = searchParams.get("companies") ?? "";
  const pageParam = parseInt(searchParams.get("page") ?? "1", 10);

  const selectedCompanies = companiesParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [noJobsFor, setNoJobsFor] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [filters, setFilters] = useState<Filters>({
    industries: [],
    sources: [],
    searchTitle: "",
    visaSponsorship: null,
    jobTypes: [],
  });

  // Fetch jobs when companies/page changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (companiesParam) params.set("companies", companiesParam);
    params.set("page", String(pageParam));

    setLoading(true);
    setApiError(null);

    const controller = new AbortController();
    fetch(`/api/jobs?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: resumeData, filters }),
      signal: controller.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Failed to load jobs");
        return body;
      })
      .then((data: JobsApiResponse) => {
        setAllJobs(data.jobs ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setNoJobsFor(data.companiesWithNoJobs ?? []);
      })
      .catch((error) => { if (!controller.signal.aborted) setApiError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companiesParam, pageParam, resumeData, filters]);

  const handleResumeProcessed = (data: ResumeData | null) => {
    setResumeData(data);
    if (pageParam !== 1) setPage(1);
  };

  // Server filters and ranks the complete snapshot before pagination.
  const displayJobs = allJobs;

  const topMatches = resumeData
    ? displayJobs.filter(j => (j.matchScore ?? 0) >= 70).slice(0, 5)
    : [];

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/jobs?${params.toString()}`);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedCompanies.length > 0
              ? `Jobs at ${selectedCompanies.length} company${selectedCompanies.length > 1 ? "ies" : ""}`
              : "All Company Jobs"}
          </h1>
          {!loading && (
            <div className="flex flex-wrap items-center gap-4 mt-0.5">
              <p className="text-sm text-gray-500">
                {total} job{total !== 1 ? "s" : ""} found
                {displayJobs.length !== allJobs.length && ` · ${displayJobs.length} after filters`}
              </p>


              <span className="text-xs font-semibold px-2 py-1 rounded border">Last 48 hours</span>
            </div>
          )}
        </div>

        {/* Debug Dashboard */}
        {noJobsFor.length > 0 && (
          <div className="w-full mt-4 p-4 bg-red-50 border border-red-100 rounded-xl shadow-sm">
            <h2 className="text-[10px] font-bold text-red-800 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              Empty Results Debugger
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {noJobsFor.slice(0, 20).map(id => (
                <span key={id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-white text-red-700 border border-red-200 uppercase">
                  {id}
                </span>
              ))}
              {noJobsFor.length > 20 && <span className="text-[9px] text-red-400">+{noJobsFor.length - 20} more...</span>}
            </div>
            <p className="mt-2 text-[10px] text-red-600 opacity-60 italic leading-relaxed">
              * Red companies returned 0 jobs. If your target automotive company is here, it might be due to IP blocking on the Vercel node.
            </p>
          </div>
        )}
        <a
          href="/"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          ← Back to companies
        </a>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-60 flex-shrink-0">
          <FilterSidebar
            selectedCompanies={selectedCompanies}
            filters={filters}
            onChange={(next) => { setFilters(next); if (pageParam !== 1) setPage(1); }}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Resume upload */}
          <ResumeUpload onResumeProcessed={handleResumeProcessed} />

          {/* Error */}
          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
              {apiError}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="h-3 bg-gray-200 rounded" />
                    <div className="h-3 bg-gray-200 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Top Matches Auto-Apply */}
          {!loading && topMatches.length > 0 && (
            <div className="mb-6 p-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-green-900 font-bold text-lg flex items-center gap-2">
                  <span className="text-xl">🚀</span> You have high-matching jobs!
                </h3>
                <p className="text-green-700 text-sm mt-1">
                  We found {topMatches.length} job{topMatches.length > 1 ? "s" : ""} with a match score of 70% or higher.
                </p>
              </div>
              <button
                onClick={() => {
                  alert("Opening applications in new tabs. Please ensure your browser allows pop-ups for this site.");
                  topMatches.forEach(job => window.open(job.applyUrl, '_blank'));
                }}
                className="whitespace-nowrap px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
              >
                Auto-Apply to Top {topMatches.length}
                <svg className="w-4 h-4" baseProfile="tiny" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 14L21 3m0 0h-6.5M21 3v6.5M10 14l-7-3.5 18-7.5-7.5 18-3.5-7z" />
                </svg>
              </button>
            </div>
          )}

          {/* Job list */}
          {!loading && displayJobs.length > 0 && (
            <div className="space-y-4">
              {displayJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  showMatch={!!resumeData}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && displayJobs.length === 0 && !apiError && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">No jobs found</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                The selected companies may not have public job boards via Greenhouse or Lever.
                Try selecting different companies or clearing your filters.
              </p>
              {noJobsFor.length > 0 && (
                <div className="mt-6 text-left max-w-md mx-auto bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                    Visit careers pages directly
                  </p>
                  {noJobsFor.slice(0, 8).map((id) => {
                    const co = COMPANY_MAP.get(id);
                    return co ? (
                      <a
                        key={id}
                        href={co.careersUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between py-1.5 text-sm text-blue-600 hover:underline"
                      >
                        {co.name}
                        <svg className="w-3.5 h-3.5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(pageParam - 1)}
                disabled={pageParam <= 1}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>

              {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${p === pageParam
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setPage(pageParam + 1)}
                disabled={pageParam >= totalPages}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page export (wrapped in Suspense for useSearchParams) ────────────────────

export default function JobsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <JobsPageInner />
    </Suspense>
  );
}

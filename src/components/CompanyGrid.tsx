"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Company, Industry } from "@/types";
import { COMPANIES, INDUSTRIES } from "@/data/companies";
import CompanyCard from "./CompanyCard";

export default function CompanyGrid() {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeIndustry, setActiveIndustry] = useState<string>("All");
  const [search, setSearch] = useState("");

  const filteredCompanies: Company[] = COMPANIES.filter((c) => {
    const matchesIndustry =
      activeIndustry === "All" || c.industry === activeIndustry;
    const matchesSearch =
      search.trim() === "" ||
      c.name.toLowerCase().includes(search.toLowerCase());
    return matchesIndustry && matchesSearch;
  });

  function toggleCompany(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    const ids = filteredCompanies.map((c) => c.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  function browseJobs(all = false) {
    if (all) {
      router.push("/jobs");
    } else {
      const ids = [...selectedIds].join(",");
      router.push(`/jobs?companies=${ids}`);
    }
  }

  return (
    <section>
      {/* Search + industry tabs */}
      <div className="mb-6 space-y-4">
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((ind) => (
            <button
              key={ind}
              onClick={() => setActiveIndustry(ind)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeIndustry === ind
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {ind}
            </button>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {filteredCompanies.length} companies shown
            {selectedIds.size > 0 && (
              <span className="ml-2 font-medium text-blue-600">
                · {selectedIds.size} selected
              </span>
            )}
          </span>
          <button
            onClick={selectAll}
            className="text-xs text-blue-600 hover:underline"
          >
            Select all
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-gray-500 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => browseJobs(false)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse {selectedIds.size} Company Jobs
            </button>
          )}
          <button
            onClick={() => browseJobs(true)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            Browse All 100 Companies
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filteredCompanies.map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            selected={selectedIds.has(company.id)}
            onToggle={toggleCompany}
          />
        ))}
      </div>

      {filteredCompanies.length === 0 && (
        <p className="text-center text-gray-500 py-12">
          No companies match your search.
        </p>
      )}
    </section>
  );
}

"use client";

import { COMPANIES, INDUSTRIES } from "@/data/companies";

interface Filters {
  industries: string[];
  sources: string[];
  searchTitle: string;
  visaSponsorship: boolean | null;
  jobTypes?: string[];
}

interface Props {
  selectedCompanies: string[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const SOURCES = [
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
  { value: "scraped", label: "Scraped" },
];

export default function FilterSidebar({ selectedCompanies, filters, onChange }: Props) {
  const toggleIndustry = (ind: string) => {
    const next = filters.industries.includes(ind)
      ? filters.industries.filter((i) => i !== ind)
      : [...filters.industries, ind];
    onChange({ ...filters, industries: next });
  };

  const toggleSource = (src: string) => {
    const next = filters.sources.includes(src)
      ? filters.sources.filter((s) => s !== src)
      : [...filters.sources, src];
    onChange({ ...filters, sources: next });
  };

  return (
    <aside className="space-y-6">
      {/* Title search */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Search job titles
        </label>
        <input
          type="text"
          placeholder="e.g. Software Engineer"
          value={filters.searchTitle}
          onChange={(e) => onChange({ ...filters, searchTitle: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Industry filter */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">Industry</p>
        <div className="space-y-1.5">
          {INDUSTRIES.filter((i) => i !== "All").map((ind) => (
            <label key={ind} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.industries.includes(ind)}
                onChange={() => toggleIndustry(ind)}
                className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{ind}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Source filter */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">Job Source</p>
        <div className="space-y-1.5">
          {SOURCES.map((s) => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.sources.includes(s.value)}
                onChange={() => toggleSource(s.value)}
                className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Job Type filter */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">Job Type</p>
        <div className="space-y-1.5">
          {['Full-time', 'Part-time', 'Intern', 'Contract'].map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.jobTypes?.includes(type)}
                onChange={() => {
                  const next = filters.jobTypes?.includes(type)
                    ? filters.jobTypes.filter(t => t !== type)
                    : [...(filters.jobTypes || []), type];
                  onChange({ ...filters, jobTypes: next });
                }}
                className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Visa sponsorship filter */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">Visa Sponsorship</p>
        <div className="space-y-1.5">
          {[
            { label: "All", value: null },
            { label: "Sponsorship Only", value: true },
            { label: "No Sponsorship Only", value: false },
          ].map((opt) => (
            <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="visaSponsorship"
                checked={filters.visaSponsorship === opt.value}
                onChange={() => onChange({ ...filters, visaSponsorship: opt.value })}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Active companies summary */}
      {selectedCompanies.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-2">
            Browsing {selectedCompanies.length} companies
          </p>
          <div className="flex flex-wrap gap-1">
            {selectedCompanies.slice(0, 10).map((id) => {
              const c = COMPANIES.find((co) => co.id === id);
              return c ? (
                <span
                  key={id}
                  className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
                >
                  {c.name}
                </span>
              ) : null;
            })}
            {selectedCompanies.length > 10 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                +{selectedCompanies.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

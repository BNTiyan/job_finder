"use client";

import { Company } from "@/types";

interface Props {
  company: Company;
  selected: boolean;
  onToggle: (id: string) => void;
}

const INDUSTRY_COLORS: Record<string, string> = {
  Tech: "bg-blue-100 text-blue-700",
  Finance: "bg-green-100 text-green-700",
  Healthcare: "bg-red-100 text-red-700",
  Retail: "bg-yellow-100 text-yellow-700",
  Automotive: "bg-gray-100 text-gray-700",
  Media: "bg-purple-100 text-purple-700",
  Other: "bg-orange-100 text-orange-700",
};

export default function CompanyCard({ company, selected, onToggle }: Props) {
  return (
    <button
      onClick={() => onToggle(company.id)}
      className={`
        relative w-full text-left rounded-xl border-2 p-4 transition-all duration-150
        hover:shadow-md hover:-translate-y-0.5
        ${
          selected
            ? "border-blue-500 bg-blue-50 shadow-sm"
            : "border-gray-200 bg-white"
        }
      `}
    >
      {/* Selection checkmark */}
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Logo placeholder */}
      <div
        className={`w-10 h-10 ${company.logoColor} rounded-lg mb-3 flex items-center justify-center`}
      >
        <span className="text-white font-bold text-sm">
          {company.name.charAt(0)}
        </span>
      </div>

      {/* Name */}
      <p className="font-semibold text-gray-900 text-sm leading-tight mb-2">
        {company.name}
      </p>

      {/* Industry badge */}
      <span
        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
          INDUSTRY_COLORS[company.industry] ?? "bg-gray-100 text-gray-600"
        }`}
      >
        {company.industry}
      </span>
    </button>
  );
}

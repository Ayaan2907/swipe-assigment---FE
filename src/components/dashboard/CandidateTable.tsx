"use client";

import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

import type { RootState } from "@/lib/store";
import type { CandidateRecord } from "@/types/interview";

interface SortState {
  field: "name" | "score" | "status" | "updatedAt";
  direction: "asc" | "desc";
}

const defaultSort: SortState = { field: "updatedAt", direction: "desc" };

function sortCandidates(candidates: CandidateRecord[], sort: SortState) {
  return [...candidates].sort((a, b) => {
    const direction = sort.direction === "asc" ? 1 : -1;

    switch (sort.field) {
      case "name":
        return direction * (a.name ?? "").localeCompare(b.name ?? "");
      case "score":
        return direction * ((a.score ?? -1) - (b.score ?? -1));
      case "status":
        return direction * (a.status ?? "").localeCompare(b.status ?? "");
      case "updatedAt":
      default: {
        const aTime = Date.parse(a.updatedAt ?? a.createdAt ?? "") || 0;
        const bTime = Date.parse(b.updatedAt ?? b.createdAt ?? "") || 0;
        return direction * (aTime - bTime);
      }
    }
  });
}

function useCandidateRows(filter: string, sort: SortState) {
  return useSelector((state: RootState) => {
    const allCandidates = Object.values(state.candidates.entities ?? {}).filter(Boolean) as CandidateRecord[];

    const filtered = filter
      ? allCandidates.filter((candidate) => {
          const term = filter.toLowerCase();
          return [candidate.name, candidate.email, candidate.phone]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(term));
        })
      : allCandidates;

    return sortCandidates(filtered, sort);
  });
}

interface CandidateTableProps {
  onSelectCandidate?: (candidateId: string) => void;
}

export function CandidateTable({ onSelectCandidate }: CandidateTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<SortState>(defaultSort);
  const candidates = useCandidateRows(searchTerm, sort);

  const displayedCandidates = useMemo(() => candidates, [candidates]);

  const toggleSort = (field: SortState["field"]) => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { field, direction: field === "name" ? "asc" : "desc" };
    });
  };

  const renderSortIcon = (field: SortState["field"]) => {
    if (sort.field !== field) return null;
    return sort.direction === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="Search candidates"
          />
        </div>
        <p className="text-sm text-slate-400">
          Showing
          <span className="mx-1 font-medium text-white">{displayedCandidates.length}</span>
          candidates
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="grid grid-cols-12 gap-4 border-b border-slate-800 bg-slate-950 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          <button
            type="button"
            onClick={() => toggleSort("name")}
            className="col-span-3 flex items-center gap-1 text-left"
          >
            Name
            {renderSortIcon("name")}
          </button>
          <button
            type="button"
            onClick={() => toggleSort("status")}
            className="col-span-3 flex items-center gap-1 text-left"
          >
            Status
            {renderSortIcon("status")}
          </button>
          <button
            type="button"
            onClick={() => toggleSort("score")}
            className="col-span-2 flex items-center gap-1 text-left"
          >
            Score
            {renderSortIcon("score")}
          </button>
          <button
            type="button"
            onClick={() => toggleSort("updatedAt")}
            className="col-span-2 flex items-center gap-1 text-left"
          >
            Last update
            {renderSortIcon("updatedAt")}
          </button>
          <span className="col-span-2 text-right">Actions</span>
        </div>

        <div className="divide-y divide-slate-800">
          {displayedCandidates.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              No candidates yet. Start an interview to see them here.
            </div>
          ) : (
            displayedCandidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onSelectCandidate?.(candidate.id)}
                className="grid w-full grid-cols-12 gap-4 px-4 py-4 text-left text-sm text-slate-200 transition hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                <div className="col-span-3">
                  <p className="font-medium text-white">{candidate.name ?? "Unnamed"}</p>
                  <p className="text-xs text-slate-400">{candidate.email ?? "No email"}</p>
                </div>
                <div className="col-span-3">
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-xs capitalize text-slate-300">
                    {candidate.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="font-semibold text-white">
                    {typeof candidate.score === "number" ? `${candidate.score.toFixed(1)}` : "—"}
                  </span>
                </div>
                <div className="col-span-2 text-xs text-slate-400">
                  {(candidate.updatedAt ?? candidate.createdAt)?.slice(0, 10) || ""}
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-sm text-slate-300">View</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

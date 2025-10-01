"use client";

import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { LucideIcon } from "lucide-react";
import { Users, Clock, PauseCircle, CheckCircle2 } from "lucide-react";

import type { RootState } from "@/lib/store";
import type { CandidateRecord } from "@/types/interview";

function collectStats(candidates: CandidateRecord[]) {
  return candidates.reduce(
    (stats, candidate) => {
      stats.total += 1;

      switch (candidate.status) {
        case "collecting_info":
          stats.collecting += 1;
          break;
        case "interviewing":
          stats.inProgress += 1;
          break;
        case "paused":
          stats.paused += 1;
          break;
        case "completed":
          stats.completed += 1;
          break;
        default:
          break;
      }

      return stats;
    },
    { total: 0, collecting: 0, inProgress: 0, paused: 0, completed: 0 },
  );
}

export function CandidateStats() {
  const stats = useSelector((state: RootState) => {
    const allCandidates = Object.values(state.candidates.entities ?? {}).filter(Boolean) as CandidateRecord[];
    return collectStats(allCandidates);
  });

  type StatCard = {
    label: string;
    value: number;
    icon: LucideIcon;
    accent: string;
  };

  const cards = useMemo(
    (): StatCard[] => [
      {
        label: "Total candidates",
        value: stats.total,
        icon: Users,
        accent: "bg-indigo-500/10 text-indigo-300",
      },
      {
        label: "Collecting info",
        value: stats.collecting,
        icon: Users,
        accent: "bg-amber-500/10 text-amber-300",
      },
      {
        label: "In progress",
        value: stats.inProgress,
        icon: Clock,
        accent: "bg-blue-500/10 text-blue-300",
      },
      {
        label: "Paused",
        value: stats.paused,
        icon: PauseCircle,
        accent: "bg-slate-500/10 text-slate-300",
      },
      {
        label: "Completed",
        value: stats.completed,
        icon: CheckCircle2,
        accent: "bg-emerald-500/10 text-emerald-300",
      },
    ],
    [stats],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${card.accent}`}>
              <card.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
              <p className="text-xl font-semibold text-white">{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

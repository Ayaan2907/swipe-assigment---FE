import Link from "next/link";

import { CandidateStats } from "@/components/dashboard/CandidateStats";
import { CandidateTable } from "@/components/dashboard/CandidateTable";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12">
        <header className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold">Interviewer Dashboard</h1>
            <p className="mt-2 max-w-2xl text-slate-300">
              Track every interview, resume, and AI assessment in one place.
              Select a candidate to jump back into their session or start a new
              interview.
            </p>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <CandidateStats />
            </div>
            <div className="flex justify-end lg:justify-start">
              <Link
                href="/session/new"
                className="inline-flex items-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                Start new interview
              </Link>
            </div>
          </div>
        </header>

        <section>
          <CandidateTable />
        </section>
      </div>
    </main>
  );
}

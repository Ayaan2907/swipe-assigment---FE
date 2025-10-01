"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid";

import { CandidateStats } from "@/components/dashboard/CandidateStats";
import { CandidateTable } from "@/components/dashboard/CandidateTable";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import {
  upsertCandidate,
  updateCandidateStatus,
} from "@/features/candidates/candidatesSlice";
import { createSession } from "@/features/sessions/sessionsSlice";
import { appendMessage } from "@/features/chat/chatSlice";
import type { InterviewSession } from "@/types/interview";

function useLatestSessionPerCandidate() {
  return useAppSelector((state) => {
    const sessions = (Object.values(state.sessions.sessions.entities ?? {})
      .filter(Boolean) as InterviewSession[]).sort((a, b) =>
      (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    );

    const map = new Map<string, string>();
    sessions.forEach((session) => {
      if (!session) return;
      if (!map.has(session.candidateId)) {
        map.set(session.candidateId, session.id);
      }
    });

    return map;
  });
}

export function DashboardView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const sessionsByCandidate = useLatestSessionPerCandidate();

  const handleSelectCandidate = useCallback(
    (candidateId: string) => {
      const sessionId = sessionsByCandidate.get(candidateId);
      if (sessionId) {
        router.push(`/session/${sessionId}`);
        return;
      }
      router.push("/session/new");
    },
    [router, sessionsByCandidate],
  );

  const handleStartNewInterview = useCallback(() => {
    const now = new Date().toISOString();
    const candidateId = uuid();
    const sessionId = uuid();

    dispatch(
      upsertCandidate({
        id: candidateId,
        name: null,
        email: null,
        phone: null,
        status: "collecting_info",
        createdAt: now,
        updatedAt: now,
      }),
    );

    dispatch(
      createSession({
        session: {
          id: sessionId,
          candidateId,
          status: "not_started",
          questionIds: [],
          startedAt: undefined,
          updatedAt: now,
        },
      }),
    );

    dispatch(
      appendMessage({
        sessionId,
        message: {
          role: "system",
          content:
            "Hi there! I'm Crisp. Please upload your resume (PDF/DOCX) or share your name, email, and phone number so we can get started.",
          meta: { type: "intro" },
        },
      }),
    );

    dispatch(
      updateCandidateStatus({
        id: candidateId,
        status: "collecting_info",
        updatedAt: now,
      }),
    );

    router.push(`/session/${sessionId}`);
  }, [dispatch, router]);

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
              <button
                type="button"
                onClick={handleStartNewInterview}
                className="inline-flex items-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                Start new interview
              </button>
            </div>
          </div>
        </header>

        <section>
          <CandidateTable onSelectCandidate={handleSelectCandidate} />
        </section>
      </div>
    </main>
  );
}

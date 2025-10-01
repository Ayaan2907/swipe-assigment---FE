"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Loader2, MessageSquare, PauseCircle, PlayCircle, User } from "lucide-react";

import { startInterview, submitAnswer, tickActiveQuestion } from "@/features/sessions/interviewThunks";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import type { RootState } from "@/lib/store";
import type { InterviewQuestion, InterviewQuestionStatus } from "@/types/interview";

interface SessionWorkspaceProps {
  sessionId: string;
}

function formatStatus(status: string | undefined | null) {
  if (!status) return "unknown";
  return status.replace(/_/g, " ");
}

function statusBadgeClass(status: string | undefined | null) {
  switch (status) {
    case "collecting_info":
      return "bg-amber-500/10 text-amber-200";
    case "in_progress":
    case "interviewing":
      return "bg-blue-500/10 text-blue-200";
    case "paused":
      return "bg-slate-500/10 text-slate-200";
    case "completed":
      return "bg-emerald-500/10 text-emerald-200";
    default:
      return "bg-slate-500/10 text-slate-200";
  }
}

function groupQuestions(questions: InterviewQuestion[]) {
  const counts: Record<InterviewQuestionStatus | "total", number> = {
    total: questions.length,
    pending: 0,
    active: 0,
    answered: 0,
    skipped: 0,
  };

  questions.forEach((question) => {
    counts[question.status] += 1;
  });

  const current = questions.find((question) => question.status === "active");
  return {
    counts,
    current,
  };
}

export function SessionWorkspace({ sessionId }: SessionWorkspaceProps) {
  const dispatch = useAppDispatch();
  const session = useAppSelector((state: RootState) => state.sessions.sessions.entities[sessionId]);
  const candidate = useAppSelector((state: RootState) =>
    session ? state.candidates.entities[session.candidateId] ?? null : null,
  );
  const messages = useAppSelector((state: RootState) => state.chat.threads[sessionId] ?? []);
  const questions = useAppSelector((state: RootState) => {
    const all = Object.values(state.sessions.questions.entities ?? {}).filter(Boolean) as InterviewQuestion[];
    return all.filter((question) => question.sessionId === sessionId);
  });

  const questionMeta = useMemo(() => groupQuestions(questions), [questions]);
  const currentQuestion = questionMeta.current;
  const questionCounts = questionMeta.counts;

  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const draftRef = useRef("");
  const autoSubmittedRef = useRef<string | null>(null);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    setDraft("");
    draftRef.current = "";
    autoSubmittedRef.current = null;
  }, [currentQuestion?.id]);

  useEffect(() => {
    if (!session?.currentQuestionId || session.status !== "in_progress") return;
    const interval = setInterval(() => {
      void dispatch(tickActiveQuestion({ sessionId }));
    }, 1000);
    return () => clearInterval(interval);
  }, [dispatch, session?.currentQuestionId, session?.status, sessionId]);

  useEffect(() => {
    if (!session) return;
    if (autoStartedRef.current) return;
    if (session.status === "not_started") {
      autoStartedRef.current = true;
      void dispatch(startInterview({ sessionId }));
    }
  }, [dispatch, session, sessionId]);

  useEffect(() => {
    if (!currentQuestion) return;
    if (currentQuestion.status !== "active") return;
    if (currentQuestion.remainingSeconds > 0) return;
    if (autoSubmittedRef.current === currentQuestion.id) return;

    autoSubmittedRef.current = currentQuestion.id;
    void dispatch(
      submitAnswer({
        sessionId,
        answer: draftRef.current,
      }),
    );
  }, [currentQuestion, dispatch, sessionId]);

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-16 text-center">
          <div>
            <h1 className="text-3xl font-semibold">Session not found</h1>
            <p className="mt-3 text-slate-300">
              We couldn&apos;t locate this interview session. It may have been cleared
              or never created.
            </p>
          </div>
          <div>
            <Link
              href="/"
              className="inline-flex items-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              Return to dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const canStartInterview = ["not_started", "collecting_info", "paused"].includes(session.status);
  const canCompose = session.status === "in_progress" && currentQuestion && currentQuestion.status === "active";

  const handleStartInterview = () => {
    void dispatch(startInterview({ sessionId }));
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !canCompose) return;
    setIsSubmitting(true);
    try {
      await dispatch(
        submitAnswer({
          sessionId,
          answer: draftRef.current,
        }),
      );
      setDraft("");
      draftRef.current = "";
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSubmitAnswer();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
            >
              ← Back to dashboard
            </Link>
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-400">Interview session</p>
              <h1 className="text-3xl font-semibold">{candidate?.name ?? "Unnamed candidate"}</h1>
            </div>
            <p className="text-slate-400">
              Session ID: <span className="font-mono text-slate-300">{sessionId}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${statusBadgeClass(session.status)}`}
            >
              {formatStatus(session.status)}
            </span>
            <div className="text-right text-sm text-slate-400">
              <p>Started {session.startedAt ? new Date(session.startedAt).toLocaleString() : "not yet"}</p>
              {session.updatedAt && <p>Updated {new Date(session.updatedAt).toLocaleString()}</p>}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <section className="flex min-h-[520px] flex-col rounded-2xl border border-slate-800 bg-slate-900">
            <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-200">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Interview chat</p>
                  <p className="text-xs text-slate-400">
                    Questions, answers, timers, and AI evaluations
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>{questionCounts.total} questions</p>
                <p>{messages.length} messages</p>
              </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-400">
                      <p>The interview hasn&apos;t started yet.</p>
                      {canStartInterview ? (
                        <button
                          type="button"
                      onClick={handleStartInterview}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                    >
                      <PlayCircle className="h-4 w-4" />
                      Start interview
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Waiting for the first AI-generated question.
                    </p>
                  )}
                </div>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-3xl rounded-xl border border-slate-800 px-4 py-3 text-sm shadow-sm ${
                      message.role === "user"
                        ? "ml-auto bg-indigo-500/10 text-indigo-100"
                        : message.role === "assistant"
                        ? "bg-slate-800/80 text-slate-100"
                        : "bg-slate-900 text-slate-300"
                    }`}
                  >
                    <header className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide">
                      <span>
                        {message.role === "user"
                          ? "Candidate"
                          : message.role === "assistant"
                          ? "AI Assistant"
                          : "System"}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </span>
                    </header>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  </article>
                ))
              )}
            </div>

            <footer className="border-t border-slate-800 px-6 py-4">
              {canCompose ? (
                <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Time remaining: {currentQuestion?.remainingSeconds ?? 0}s • Difficulty: {currentQuestion?.difficulty}
                    </span>
                    <span>Question #{(currentQuestion?.order ?? 0) + 1} of 6</span>
                  </div>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Type your answer..."
                    className="h-32 w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft("");
                        draftRef.current = "";
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
                    >
                      <PauseCircle className="h-4 w-4" />
                      Clear
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:bg-indigo-500/50"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                      Submit answer
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center text-xs text-slate-500">
                  {session.status === "completed"
                    ? "Interview completed. Review the transcript on the left."
                    : canStartInterview
                    ? "Start the interview to unlock chatting."
                    : "Waiting for the AI to deliver the next question."}
                </div>
              )}
            </footer>
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <header className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80 text-slate-200">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Candidate profile</p>
                  <p className="text-xs text-slate-400">Contact details and AI summary</p>
                </div>
              </header>
              <dl className="space-y-3 text-sm text-slate-300">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Name</dt>
                  <dd className="text-white">{candidate?.name ?? "Missing"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
                  <dd>{candidate?.email ?? "Missing"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Phone</dt>
                  <dd>{candidate?.phone ?? "Missing"}</dd>
                </div>
                {candidate?.resume?.fileName && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Resume</dt>
                    <dd className="truncate text-indigo-200">{candidate.resume.fileName}</dd>
                  </div>
                )}
                {candidate?.summary && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">AI summary</dt>
                    <dd className="text-sm text-slate-200">{candidate.summary}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <header className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80 text-slate-200">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Question progress</p>
                  <p className="text-xs text-slate-400">Difficulty sequence and timer status</p>
                </div>
              </header>
              {questionCounts.total === 0 ? (
                <p className="text-sm text-slate-400">
                  Interview questions have not been generated yet.
                </p>
              ) : (
                <ul className="space-y-3 text-sm text-slate-200">
                  <li className="flex items-center justify-between">
                    <span>Total questions</span>
                    <span className="font-semibold text-white">{questionCounts.total}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Answered</span>
                    <span className="font-semibold text-emerald-300">{questionCounts.answered}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Pending</span>
                    <span className="font-semibold text-slate-300">{questionCounts.pending}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Skipped</span>
                    <span className="font-semibold text-amber-300">{questionCounts.skipped}</span>
                  </li>
                  {currentQuestion && (
                    <li className="flex flex-col rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                      <span className="text-xs uppercase text-slate-500">Current question</span>
                      <span className="font-medium text-white">
                        {currentQuestion.difficulty.toUpperCase()} • #{currentQuestion.order + 1}
                      </span>
                      <span className="text-xs text-slate-400">
                        {currentQuestion.remainingSeconds}s remaining
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

import { createAsyncThunk, nanoid } from "@reduxjs/toolkit";
import dayjs from "dayjs";

import {
  addQuestionToSession,
  decrementQuestionTimer,
  setCurrentQuestion,
  setQuestionStatus,
  updateQuestionAnswer,
  updateQuestionEvaluation,
  updateSessionStatus,
  upsertSession,
} from "@/features/sessions/sessionsSlice";
import { appendMessage } from "@/features/chat/chatSlice";
import {
  updateCandidateContact,
  updateCandidateResume,
  updateCandidateScore,
  updateCandidateStatus,
} from "@/features/candidates/candidatesSlice";
import type { AppDispatch, RootState } from "@/lib/store";
import type { InterviewDifficulty, InterviewQuestion } from "@/types/interview";
import { extractContactDetails } from "@/utils/resumeParser";

const DIFFICULTY_SEQUENCE: InterviewDifficulty[] = ["easy", "easy", "medium", "medium", "hard", "hard"];
const TIMER_BY_DIFFICULTY: Record<InterviewDifficulty, number> = {
  easy: 20,
  medium: 60,
  hard: 120,
};

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request to ${url} failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export const startInterview = createAsyncThunk<
  void,
  { sessionId: string },
  { dispatch: AppDispatch; state: RootState }
>("interview/start", async ({ sessionId }, { dispatch, getState }) => {
  const state = getState();
  const session = state.sessions.sessions.entities[sessionId];
  if (!session) throw new Error("Session not found");
  const candidate = state.candidates.entities[session.candidateId];
  if (!candidate) throw new Error("Candidate not found");

  const askedCount = session.questionIds.length;
  if (askedCount >= DIFFICULTY_SEQUENCE.length) {
    return;
  }

  const difficulty = DIFFICULTY_SEQUENCE[askedCount];
  const now = dayjs().toISOString();

  try {
    dispatch(
      updateSessionStatus({
        id: sessionId,
        status: "in_progress",
        updatedAt: now,
      }),
    );

    if (!session.startedAt) {
      dispatch(
        upsertSession({
          ...session,
          startedAt: now,
          updatedAt: now,
        }),
      );
    }

    dispatch(
      updateCandidateStatus({
        id: candidate.id,
        status: "interviewing",
        updatedAt: now,
      }),
    );

    const previousQuestions = session.questionIds
      .map((id) => state.sessions.questions.entities[id])
      .filter(Boolean) as InterviewQuestion[];

    const questionResult = await postJson<QuestionResult>("/api/interview/question", {
      difficulty,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        role: candidate.role,
        resume: candidate.resume,
      },
      previousQuestions: previousQuestions.map((question) => ({
        prompt: question.prompt,
        difficulty: question.difficulty,
      })),
    });

    const questionId = nanoid();

    dispatch(
      addQuestionToSession({
        sessionId,
        question: {
          id: questionId,
          sessionId,
          order: askedCount,
          difficulty,
          prompt: questionResult.question,
          timerSeconds: TIMER_BY_DIFFICULTY[difficulty],
          remainingSeconds: TIMER_BY_DIFFICULTY[difficulty],
          status: "active",
          askedAt: now,
        },
      }),
    );

    dispatch(
      setCurrentQuestion({
        sessionId,
        questionId,
        updatedAt: now,
      }),
    );

    dispatch(
      setQuestionStatus({
        questionId,
        status: "active",
        askedAt: now,
      }),
    );

    dispatch(
      appendMessage({
        sessionId,
        message: {
          role: "assistant",
          content: questionResult.question,
          meta: {
            difficulty,
            type: "question",
            recommendedAnswer: questionResult.answerGuidance,
          },
        },
      }),
    );
  } catch (error) {
    dispatch(
      appendMessage({
        sessionId,
        message: {
          role: "system",
          content:
            "We hit a snag while generating the question. Please try again in a moment.",
          meta: { type: "error", error: String(error) },
        },
      }),
    );
    throw error;
  }
});

export const submitAnswer = createAsyncThunk<
  void,
  { sessionId: string; answer: string },
  { dispatch: AppDispatch; state: RootState }
>("interview/submitAnswer", async ({ sessionId, answer }, { dispatch, getState }) => {
  const state = getState();
  const session = state.sessions.sessions.entities[sessionId];
  if (!session) throw new Error("Session not found");
  if (!session.currentQuestionId) throw new Error("No active question");

  const question = state.sessions.questions.entities[session.currentQuestionId];
  if (!question) throw new Error("Question not found");
  if (question.status !== "active") return;

  const now = dayjs().toISOString();

  dispatch(
    appendMessage({
      sessionId,
      message: {
        role: "user",
        content: answer || "",
        meta: {
          questionId: question.id,
        },
      },
    }),
  );

  dispatch(
    updateQuestionAnswer({
      questionId: question.id,
      answer,
      answeredAt: now,
    }),
  );

  dispatch(
    setQuestionStatus({
      questionId: question.id,
      status: answer.trim().length > 0 ? "answered" : "skipped",
    }),
  );

  try {
    const evaluation = await postJson<EvaluationResult>("/api/interview/evaluate", {
      question: {
        prompt: question.prompt,
        difficulty: question.difficulty,
        evaluation: question.evaluation,
      },
      candidateAnswer: answer,
    });

    dispatch(
      updateQuestionEvaluation({
        questionId: question.id,
        score: evaluation.score,
        reasoning: evaluation.feedback,
      }),
    );

    dispatch(
      appendMessage({
        sessionId,
        message: {
          role: "assistant",
          content: evaluation.feedback,
          meta: {
            questionId: question.id,
            type: "evaluation",
            score: evaluation.score,
          },
        },
      }),
    );
  } catch (error) {
    dispatch(
      appendMessage({
        sessionId,
        message: {
          role: "system",
          content: "Failed to score that answer. You can retry submitting if needed.",
          meta: { type: "error", error: String(error) },
        },
      }),
    );
  }

  const currentIndex = session.questionIds.findIndex((id) => id === question.id);
  const remaining = DIFFICULTY_SEQUENCE.length - (currentIndex + 1);

  if (remaining <= 0) {
    const questions = session.questionIds
      .map((id) => state.sessions.questions.entities[id])
      .filter(Boolean) as InterviewQuestion[];

    const summary = await postJson<SummaryResult>("/api/interview/summary", {
      candidate: {
        id: state.candidates.entities[session.candidateId]!.id,
        name: state.candidates.entities[session.candidateId]!.name,
        email: state.candidates.entities[session.candidateId]!.email,
        phone: state.candidates.entities[session.candidateId]!.phone,
        role: state.candidates.entities[session.candidateId]!.role,
      },
      questions: questions.map((question) => ({
        prompt: question?.prompt ?? "",
        difficulty: question?.difficulty ?? "easy",
        answer: question?.answer,
        evaluation: question?.evaluation,
      })),
    });

    const averageScore =
      questions.reduce((total, q) => total + (q?.evaluation?.score ?? 0), 0) /
      Math.max(questions.length, 1);

    dispatch(
      updateSessionStatus({
        id: sessionId,
        status: "completed",
        updatedAt: summary.generatedAt,
      }),
    );

    dispatch(
      updateCandidateStatus({
        id: session.candidateId,
        status: "completed",
        updatedAt: summary.generatedAt,
      }),
    );

    dispatch(
      updateCandidateScore({
        id: session.candidateId,
        score: Math.round(averageScore),
        summary: summary.summary,
        updatedAt: summary.generatedAt,
      }),
    );

    dispatch(
      appendMessage({
        sessionId,
        message: {
          role: "assistant",
          content: summary.summary,
          meta: {
            type: "summary",
            finalScore: averageScore,
          },
        },
      }),
    );

    dispatch(
      setCurrentQuestion({
        sessionId,
        questionId: undefined,
        updatedAt: summary.generatedAt,
      }),
    );

    return;
  }

  const nextDifficulty = DIFFICULTY_SEQUENCE[currentIndex + 1];

  try {
    const questionResult = await postJson<QuestionResult>("/api/interview/question", {
      difficulty: nextDifficulty,
      candidate: {
        id: state.candidates.entities[session.candidateId]!.id,
        name: state.candidates.entities[session.candidateId]!.name,
        email: state.candidates.entities[session.candidateId]!.email,
        phone: state.candidates.entities[session.candidateId]!.phone,
        role: state.candidates.entities[session.candidateId]!.role,
        resume: state.candidates.entities[session.candidateId]!.resume,
      },
      previousQuestions: session.questionIds
        .map((id) => state.sessions.questions.entities[id])
        .filter(Boolean)
        .map((question) => ({
          prompt: question!.prompt,
          difficulty: question!.difficulty,
        })),
    });

    const nextQuestionId = nanoid();
    const askedAt = dayjs().toISOString();

    dispatch(
      addQuestionToSession({
        sessionId,
        question: {
          id: nextQuestionId,
          sessionId,
          order: currentIndex + 1,
          difficulty: nextDifficulty,
          prompt: questionResult.question,
          timerSeconds: TIMER_BY_DIFFICULTY[nextDifficulty],
          remainingSeconds: TIMER_BY_DIFFICULTY[nextDifficulty],
          status: "active",
          askedAt,
        },
      }),
    );

    dispatch(
      setCurrentQuestion({
        sessionId,
        questionId: nextQuestionId,
        updatedAt: askedAt,
      }),
    );

    dispatch(
      setQuestionStatus({
        questionId: nextQuestionId,
        status: "active",
        askedAt,
      }),
    );

    dispatch(
      appendMessage({
        sessionId,
        message: {
          role: "assistant",
          content: questionResult.question,
          meta: {
            difficulty: nextDifficulty,
            type: "question",
            recommendedAnswer: questionResult.answerGuidance,
          },
        },
      }),
    );
  } catch (error) {
    dispatch(
      appendMessage({
        sessionId,
        message: {
          role: "system",
          content: "Unable to fetch the next question right now. Please retry in a moment.",
          meta: { type: "error", error: String(error) },
        },
      }),
    );
    throw error;
  }
});

export const tickActiveQuestion = createAsyncThunk<
  void,
  { sessionId: string },
  { dispatch: AppDispatch; state: RootState }
>("interview/tick", async ({ sessionId }, { dispatch, getState }) => {
  const state = getState();
  const session = state.sessions.sessions.entities[sessionId];
  if (!session?.currentQuestionId) return;
  const question = state.sessions.questions.entities[session.currentQuestionId];
  if (!question || question.status !== "active") return;

  if (question.remainingSeconds <= 0) return;

  dispatch(decrementQuestionTimer({ questionId: question.id }));
});

interface ChatTurnPayload {
  sessionId: string;
  message: string;
  resume?: {
    fileName: string;
    fileType: string;
    size: number;
    uploadedAt: string;
    parsedText?: string;
  };
}

function getMissingFields(candidate: ReturnType<typeof selectCandidate>) {
  const missing: Array<"name" | "email" | "phone" | "resume"> = [];
  if (!candidate?.name) missing.push("name");
  if (!candidate?.email) missing.push("email");
  if (!candidate?.phone) missing.push("phone");
  if (!candidate?.resume?.parsedText) missing.push("resume");
  return missing;
}

function selectCandidate(state: RootState, id: string) {
  return state.candidates.entities[id] ?? null;
}

export const handleChatTurn = createAsyncThunk<
  void,
  ChatTurnPayload,
  { dispatch: AppDispatch; state: RootState }
>("interview/chatTurn", async ({ sessionId, message, resume }, { dispatch, getState }) => {
  const state = getState();
  const session = state.sessions.sessions.entities[sessionId];
  if (!session) throw new Error("Session not found");

  const candidate = selectCandidate(state, session.candidateId);
  if (!candidate) throw new Error("Candidate not found");

  const trimmedMessage = message.trim();

  const activeQuestionId = session.currentQuestionId;
  const activeQuestion = activeQuestionId ? state.sessions.questions.entities[activeQuestionId] : undefined;

  if (activeQuestion && session.status === "in_progress") {
    await dispatch(
      submitAnswer({
        sessionId,
        answer: trimmedMessage,
      }),
    );
    return;
  }

  if (trimmedMessage.length > 0) {
    dispatch(
      appendMessage({
        sessionId,
        message: {
          role: "user",
          content: trimmedMessage,
        },
      }),
    );

    const extracted = extractContactDetails(trimmedMessage);
    if (extracted) {
      const updates: { name?: string | null; email?: string | null; phone?: string | null } = {};
      if (!candidate.name && extracted.name) updates.name = extracted.name;
      if (!candidate.email && extracted.email) updates.email = extracted.email;
      if (!candidate.phone && extracted.phone) updates.phone = extracted.phone;
      if (Object.keys(updates).length > 0) {
        dispatch(
          updateCandidateContact({
            id: candidate.id,
            ...updates,
            updatedAt: new Date().toISOString(),
          }),
        );
      }
    }
  }

  if (resume && !candidate.resume?.parsedText) {
    dispatch(
      updateCandidateResume({
        id: candidate.id,
        resume,
        updatedAt: resume.uploadedAt,
      }),
    );
  }

  const updatedCandidate = selectCandidate(getState(), candidate.id);
  const missing = getMissingFields(updatedCandidate);

  if (missing.length > 0) {
    dispatch(
      appendMessage({
        sessionId,
        message: {
          role: "assistant",
          content: `Thanks! I still need your ${missing.join(", ")} before we start. Please provide them here.`,
        },
      }),
    );
    return;
  }

  const now = new Date().toISOString();

  const upcomingStatus = session.status === "completed"
    ? "completed"
    : session.questionIds.length > 0
      ? "interviewing"
      : "collecting_info";

  dispatch(
    updateCandidateStatus({
      id: candidate.id,
      status: upcomingStatus,
      updatedAt: now,
    }),
  );

  if (session.status !== "completed" && (session.questionIds.length === 0 || session.status !== "in_progress")) {
    await dispatch(startInterview({ sessionId }));
    return;
  }

  if (session.status === "completed") {
    dispatch(
      appendMessage({
        sessionId,
        message: {
          role: "assistant",
          content: "This interview is already complete. Feel free to review the summary above.",
        },
      }),
    );
  }
});
interface QuestionResult {
  question: string;
  answerGuidance: string;
}

interface EvaluationResult {
  score: number;
  feedback: string;
}

interface SummaryResult {
  summary: string;
  generatedAt: string;
}

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
import { updateCandidateScore, updateCandidateStatus } from "@/features/candidates/candidatesSlice";
import type { AppDispatch, RootState } from "@/lib/store";
import {
  fetchAnswerEvaluation,
  fetchInterviewQuestion,
  fetchInterviewSummary,
} from "@/lib/llm/interviewService";
import type { InterviewDifficulty, InterviewQuestion } from "@/types/interview";

const DIFFICULTY_SEQUENCE: InterviewDifficulty[] = ["easy", "easy", "medium", "medium", "hard", "hard"];
const TIMER_BY_DIFFICULTY: Record<InterviewDifficulty, number> = {
  easy: 20,
  medium: 60,
  hard: 120,
};

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

    const questionResult = await fetchInterviewQuestion({
      difficulty,
      candidate,
      previousQuestions,
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
    const evaluation = await fetchAnswerEvaluation({
      question,
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

    const summary = await fetchInterviewSummary({
      candidate: state.candidates.entities[session.candidateId]!,
      questions,
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
    const questionResult = await fetchInterviewQuestion({
      difficulty: nextDifficulty,
      candidate: state.candidates.entities[session.candidateId]!,
      previousQuestions: session.questionIds
        .map((id) => state.sessions.questions.entities[id])
        .filter(Boolean) as InterviewQuestion[],
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

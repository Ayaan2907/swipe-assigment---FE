import { createEntityAdapter, createSlice, nanoid, PayloadAction } from "@reduxjs/toolkit";
import type {
  InterviewQuestion,
  InterviewSession,
  InterviewSessionStatus,
} from "@/types/interview";

export const sessionsAdapter = createEntityAdapter<InterviewSession>({
  selectId: (session) => session.id,
  sortComparer: (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""),
});

export const questionsAdapter = createEntityAdapter<InterviewQuestion>({
  selectId: (question) => question.id,
  sortComparer: (a, b) => a.order - b.order,
});

interface SessionsState {
  sessions: ReturnType<typeof sessionsAdapter.getInitialState>;
  questions: ReturnType<typeof questionsAdapter.getInitialState>;
}

const initialState: SessionsState = {
  sessions: sessionsAdapter.getInitialState(),
  questions: questionsAdapter.getInitialState(),
};

const sessionsSlice = createSlice({
  name: "sessions",
  initialState,
  reducers: {
    createSession(
      state,
      action: PayloadAction<{ session: InterviewSession; questions?: Omit<InterviewQuestion, "id" | "sessionId">[] }>,
    ) {
      const { session, questions = [] } = action.payload;
      sessionsAdapter.addOne(state.sessions, {
        ...session,
        questionIds: session.questionIds ?? [],
      });
      questions.forEach((questionConfig, index) => {
        const id = nanoid();
        questionsAdapter.addOne(state.questions, {
          ...questionConfig,
          id,
          sessionId: session.id,
          order: index,
        });
        const sessionRecord = state.sessions.entities[session.id];
        if (sessionRecord) {
          sessionRecord.questionIds = [...(sessionRecord.questionIds ?? []), id];
        }
      });
    },
    upsertSession(state, action: PayloadAction<InterviewSession>) {
      sessionsAdapter.upsertOne(state.sessions, action.payload);
    },
    updateSessionStatus(
      state,
      action: PayloadAction<{ id: string; status: InterviewSessionStatus; updatedAt: string }>,
    ) {
      const { id, status, updatedAt } = action.payload;
      const session = state.sessions.entities[id];
      if (session) {
        session.status = status;
        session.updatedAt = updatedAt;
        if (status === "completed") {
          session.completedAt = updatedAt;
        }
      }
    },
    setCurrentQuestion(state, action: PayloadAction<{ sessionId: string; questionId: string | undefined; updatedAt: string }>) {
      const { sessionId, questionId, updatedAt } = action.payload;
      const session = state.sessions.entities[sessionId];
      if (session) {
        session.currentQuestionId = questionId;
        session.updatedAt = updatedAt;
      }
    },
    upsertQuestion(state, action: PayloadAction<InterviewQuestion>) {
      questionsAdapter.upsertOne(state.questions, action.payload);
    },
    upsertQuestions(state, action: PayloadAction<InterviewQuestion[]>) {
      questionsAdapter.upsertMany(state.questions, action.payload);
    },
    updateQuestionRemainingTime(
      state,
      action: PayloadAction<{ questionId: string; remainingSeconds: number }>,
    ) {
      const question = state.questions.entities[action.payload.questionId];
      if (question) {
        question.remainingSeconds = action.payload.remainingSeconds;
      }
    },
    decrementQuestionTimer(state, action: PayloadAction<{ questionId: string }>) {
      const question = state.questions.entities[action.payload.questionId];
      if (question && question.status === "active" && question.remainingSeconds > 0) {
        question.remainingSeconds -= 1;
      }
    },
    updateQuestionAnswer(
      state,
      action: PayloadAction<{ questionId: string; answer: string; answeredAt: string }>,
    ) {
      const question = state.questions.entities[action.payload.questionId];
      if (question) {
        question.answer = action.payload.answer;
        question.answeredAt = action.payload.answeredAt;
      }
    },
    setQuestionStatus(
      state,
      action: PayloadAction<{ questionId: string; status: InterviewQuestion["status"]; askedAt?: string }>,
    ) {
      const question = state.questions.entities[action.payload.questionId];
      if (question) {
        question.status = action.payload.status;
        if (action.payload.askedAt) {
          question.askedAt = action.payload.askedAt;
        }
      }
    },
    addQuestionToSession(
      state,
      action: PayloadAction<{ sessionId: string; question: InterviewQuestion; order?: number }>,
    ) {
      const { sessionId, question, order } = action.payload;
      const session = state.sessions.entities[sessionId];
      if (!session) return;

      const finalOrder = typeof order === "number" ? order : session.questionIds.length;
      const record: InterviewQuestion = {
        ...question,
        order: finalOrder,
      };

      questionsAdapter.addOne(state.questions, record);
      session.questionIds = [...(session.questionIds ?? []), record.id];
      session.updatedAt = new Date().toISOString();
    },
    updateQuestionEvaluation(
      state,
      action: PayloadAction<{ questionId: string; score: number; reasoning: string }>,
    ) {
      const question = state.questions.entities[action.payload.questionId];
      if (question) {
        question.evaluation = {
          score: action.payload.score,
          reasoning: action.payload.reasoning,
        };
      }
    },
    clearSessions(state) {
      sessionsAdapter.removeAll(state.sessions);
      questionsAdapter.removeAll(state.questions);
    },
  },
});

export const sessionsReducer = sessionsSlice.reducer;

export const {
  createSession,
  upsertSession,
  updateSessionStatus,
  setCurrentQuestion,
  upsertQuestion,
  upsertQuestions,
  updateQuestionRemainingTime,
  decrementQuestionTimer,
  updateQuestionAnswer,
  updateQuestionEvaluation,
  setQuestionStatus,
  addQuestionToSession,
  clearSessions,
} = sessionsSlice.actions;

export const sessionsSelectors = sessionsAdapter.getSelectors<
  (state: { sessions: SessionsState }) => SessionsState["sessions"]
>((state) => state.sessions.sessions);

export const questionsSelectors = questionsAdapter.getSelectors<
  (state: { sessions: SessionsState }) => SessionsState["questions"]
>((state) => state.sessions.questions);

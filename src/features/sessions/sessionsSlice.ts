import { createEntityAdapter, createSlice, nanoid, PayloadAction } from "@reduxjs/toolkit";
import type {
  InterviewQuestion,
  InterviewSession,
  InterviewSessionStatus,
} from "@/types/interview";

const sessionsAdapter = createEntityAdapter<InterviewSession>({
  selectId: (session) => session.id,
  sortComparer: (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""),
});

const questionsAdapter = createEntityAdapter<InterviewQuestion>({
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
      sessionsAdapter.addOne(state.sessions, session);
      questions.forEach((questionConfig, index) => {
        const id = nanoid();
        questionsAdapter.addOne(state.questions, {
          ...questionConfig,
          id,
          sessionId: session.id,
          order: index,
        });
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
  updateQuestionAnswer,
  updateQuestionEvaluation,
  clearSessions,
} = sessionsSlice.actions;

export const sessionsSelectors = sessionsAdapter.getSelectors<
  (state: { sessions: SessionsState }) => SessionsState["sessions"]
>((state) => state.sessions.sessions);

export const questionsSelectors = questionsAdapter.getSelectors<
  (state: { sessions: SessionsState }) => SessionsState["questions"]
>((state) => state.sessions.questions);

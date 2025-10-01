import { createSlice, nanoid, PayloadAction } from "@reduxjs/toolkit";
import type { ChatMessage } from "@/types/interview";

interface ChatState {
  threads: Record<string, ChatMessage[]>; // sessionId -> messages
}

const initialState: ChatState = {
  threads: {},
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    appendMessage(
      state,
      action: PayloadAction<{
        sessionId: string;
        message: Omit<ChatMessage, "id" | "createdAt"> & { createdAt?: string };
      }>,
    ) {
      const { sessionId, message } = action.payload;
      const existing = state.threads[sessionId] ?? [];
      const createdAt = message.createdAt ?? new Date().toISOString();
      state.threads[sessionId] = [
        ...existing,
        {
          ...message,
          id: nanoid(),
          createdAt,
        },
      ];
    },
    appendMessages(
      state,
      action: PayloadAction<{
        sessionId: string;
        messages: Array<Omit<ChatMessage, "id" | "createdAt"> & { createdAt?: string; id?: string }>;
      }>,
    ) {
      const { sessionId, messages } = action.payload;
      const existing = state.threads[sessionId] ?? [];
      state.threads[sessionId] = [
        ...existing,
        ...messages.map((message) => ({
          ...message,
          id: message.id ?? nanoid(),
          createdAt: message.createdAt ?? new Date().toISOString(),
        })),
      ];
    },
    replaceThread(state, action: PayloadAction<{ sessionId: string; messages: ChatMessage[] }>) {
      state.threads[action.payload.sessionId] = action.payload.messages;
    },
    clearThread(state, action: PayloadAction<string>) {
      delete state.threads[action.payload];
    },
    clearAllThreads(state) {
      state.threads = {};
    },
  },
});

export const chatReducer = chatSlice.reducer;

export const {
  appendMessage,
  appendMessages,
  replaceThread,
  clearThread,
  clearAllThreads,
} = chatSlice.actions;

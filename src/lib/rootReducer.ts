import { combineReducers } from "@reduxjs/toolkit";
import { candidatesReducer } from "@/features/candidates/candidatesSlice";
import { chatReducer } from "@/features/chat/chatSlice";
import { sessionsReducer } from "@/features/sessions/sessionsSlice";
import { uiReducer } from "@/features/ui/uiSlice";

export const rootReducer = combineReducers({
  candidates: candidatesReducer,
  sessions: sessionsReducer,
  chat: chatReducer,
  ui: uiReducer,
});

export type RootReducer = ReturnType<typeof rootReducer>;

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UiState {
  activeSessionId?: string | null;
  welcomeBackSessionId?: string | null;
  isWelcomeBackModalOpen: boolean;
}

const initialState: UiState = {
  activeSessionId: null,
  welcomeBackSessionId: null,
  isWelcomeBackModalOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setActiveSessionId(state, action: PayloadAction<string | null | undefined>) {
      state.activeSessionId = action.payload ?? null;
    },
    showWelcomeBack(state, action: PayloadAction<{ sessionId: string }>) {
      state.isWelcomeBackModalOpen = true;
      state.welcomeBackSessionId = action.payload.sessionId;
    },
    hideWelcomeBack(state) {
      state.isWelcomeBackModalOpen = false;
      state.welcomeBackSessionId = null;
    },
  },
});

export const uiReducer = uiSlice.reducer;

export const { setActiveSessionId, showWelcomeBack, hideWelcomeBack } = uiSlice.actions;

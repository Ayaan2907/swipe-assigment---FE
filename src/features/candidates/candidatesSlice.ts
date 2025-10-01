import { createEntityAdapter, createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { CandidateRecord } from "@/types/interview";

export const candidatesAdapter = createEntityAdapter<CandidateRecord>({
  selectId: (candidate) => candidate.id,
  sortComparer: (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""),
});

const initialState = candidatesAdapter.getInitialState();

const candidatesSlice = createSlice({
  name: "candidates",
  initialState,
  reducers: {
    upsertCandidate: candidatesAdapter.upsertOne,
    upsertCandidates: candidatesAdapter.upsertMany,
    removeCandidate: candidatesAdapter.removeOne,
    clearCandidates: candidatesAdapter.removeAll,
    updateCandidateStatus(
      state,
      action: PayloadAction<{ id: string; status: CandidateRecord["status"]; updatedAt: string }>,
    ) {
      const { id, status, updatedAt } = action.payload;
      const candidate = state.entities[id];
      if (candidate) {
        candidate.status = status;
        candidate.updatedAt = updatedAt;
        candidate.lastActiveAt = updatedAt;
      }
    },
    updateCandidateScore(
      state,
      action: PayloadAction<{ id: string; score: number; summary?: string; updatedAt: string }>,
    ) {
      const { id, score, summary, updatedAt } = action.payload;
      const candidate = state.entities[id];
      if (candidate) {
        candidate.score = score;
        candidate.summary = summary ?? candidate.summary;
        candidate.updatedAt = updatedAt;
      }
    },
    updateCandidateContact(
      state,
      action: PayloadAction<{ id: string; name?: string | null; email?: string | null; phone?: string | null; updatedAt: string }>,
    ) {
      const { id, name, email, phone, updatedAt } = action.payload;
      const candidate = state.entities[id];
      if (candidate) {
        if (typeof name !== "undefined") candidate.name = name;
        if (typeof email !== "undefined") candidate.email = email;
        if (typeof phone !== "undefined") candidate.phone = phone;
        candidate.updatedAt = updatedAt;
      }
    },
    updateCandidateResume(
      state,
      action: PayloadAction<{ id: string; resume: CandidateRecord["resume"]; updatedAt: string }>,
    ) {
      const { id, resume, updatedAt } = action.payload;
      const candidate = state.entities[id];
      if (candidate) {
        candidate.resume = resume;
        candidate.updatedAt = updatedAt;
      }
    },
  },
});

export const {
  upsertCandidate,
  upsertCandidates,
  removeCandidate,
  clearCandidates,
  updateCandidateStatus,
  updateCandidateScore,
  updateCandidateContact,
  updateCandidateResume,
} = candidatesSlice.actions;

export const candidatesReducer = candidatesSlice.reducer;

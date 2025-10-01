export type InterviewDifficulty = "easy" | "medium" | "hard";

export type InterviewQuestionStatus =
  | "pending"
  | "active"
  | "answered"
  | "skipped";

export type InterviewSessionStatus =
  | "not_started"
  | "collecting_info"
  | "in_progress"
  | "paused"
  | "completed";

export type CandidateStatus =
  | "new"
  | "collecting_info"
  | "interviewing"
  | "paused"
  | "completed";

export interface ResumeMetadata {
  fileName: string;
  fileType: string;
  size: number;
  uploadedAt: string; // ISO timestamp
  parsedText?: string;
}

export interface CandidateRecord {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: CandidateStatus;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  resume?: ResumeMetadata;
  role?: string;
  score?: number;
  summary?: string;
  lastActiveAt?: string;
}

export interface ChatMessage {
  id: string;
  role: "system" | "assistant" | "user";
  content: string;
  createdAt: string; // ISO timestamp
  meta?: Record<string, unknown>;
}

export interface InterviewQuestion {
  id: string;
  sessionId: string;
  order: number;
  difficulty: InterviewDifficulty;
  prompt: string;
  timerSeconds: number;
  remainingSeconds: number;
  status: InterviewQuestionStatus;
  answer?: string;
  answeredAt?: string;
  evaluation?: {
    score: number;
    reasoning: string;
  };
  askedAt?: string;
}

export interface InterviewSession {
  id: string;
  candidateId: string;
  status: InterviewSessionStatus;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  currentQuestionId?: string;
  questionIds: string[];
  totalScore?: number;
  summary?: string;
  welcomeBackDismissed?: boolean;
}

export interface ChatThread {
  sessionId: string;
  messages: ChatMessage[];
}

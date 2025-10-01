import { NextResponse } from "next/server";

import { fetchInterviewQuestion } from "@/lib/llm/interviewService";
import type { InterviewQuestion } from "@/types/interview";
interface RequestPayload {
  difficulty: "easy" | "medium" | "hard";
  candidate: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role?: string | null;
    resume?: {
      parsedText?: string;
    };
  };
  previousQuestions: Array<Pick<InterviewQuestion, "prompt" | "difficulty">>;
}

export async function POST(request: Request) {
  const body = (await request.json()) as RequestPayload;
  const result = await fetchInterviewQuestion({
    difficulty: body.difficulty,
    candidate: {
      name: body.candidate.name,
      role: body.candidate.role,
      resume: body.candidate.resume ?? null,
    },
    previousQuestions: body.previousQuestions,
  });

  return NextResponse.json(result);
}

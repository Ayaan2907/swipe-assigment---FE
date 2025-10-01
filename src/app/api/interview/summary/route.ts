import { NextResponse } from "next/server";

import { fetchInterviewSummary } from "@/lib/llm/interviewService";

interface RequestPayload {
  candidate: {
    name?: string | null;
  };
  questions: Array<{
    prompt: string;
    difficulty: "easy" | "medium" | "hard";
    answer?: string | null;
    evaluation?: {
      score?: number;
      reasoning?: string;
    };
  }>;
}

export async function POST(request: Request) {
  const body = (await request.json()) as RequestPayload;

  const result = await fetchInterviewSummary({
    candidate: body.candidate,
    questions: body.questions,
  });

  return NextResponse.json(result);
}

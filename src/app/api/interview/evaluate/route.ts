import { NextResponse } from "next/server";

import { fetchAnswerEvaluation } from "@/lib/llm/interviewService";

interface RequestPayload {
  question: {
    prompt: string;
    difficulty: "easy" | "medium" | "hard";
    evaluation?: {
      reasoning?: string;
    };
  };
  candidateAnswer: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as RequestPayload;

  const result = await fetchAnswerEvaluation({
    question: body.question,
    candidateAnswer: body.candidateAnswer,
  });

  return NextResponse.json(result);
}

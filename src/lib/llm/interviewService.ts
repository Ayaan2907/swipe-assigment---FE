import type { CandidateRecord, InterviewQuestion } from "@/types/interview";

import { Logger } from "@/utils/logger";

import { callOpenRouter } from "./openRouterClient";
import { selectModel } from "./router";
import { extractJsonBlock } from "./json";

interface QuestionRequest {
  difficulty: "easy" | "medium" | "hard";
  candidate: CandidateRecord;
  previousQuestions: InterviewQuestion[];
}

interface QuestionResult {
  question: string;
  answerGuidance: string;
}

interface EvaluationRequest {
  question: InterviewQuestion;
  candidateAnswer: string;
}

interface EvaluationResult {
  score: number;
  feedback: string;
}

interface SummaryRequest {
  candidate: CandidateRecord;
  questions: InterviewQuestion[];
}

interface SummaryResult {
  summary: string;
  generatedAt: string;
}

const QUESTION_SYSTEM_PROMPT = `You are Crisp, a senior full-stack interviewer hiring for a React + Node.js position.
Ask one question at a time.
Return strictly JSON with fields: question (string), answer_guidance (string explaining ideal answer and key points).
Do not add commentary outside JSON.`;

const EVALUATION_SYSTEM_PROMPT = `You are Crisp, an expert technical interviewer for React + Node.js roles.
Evaluate answers on a 0-100 scale. Return JSON with fields: score (number), feedback (string with concise coaching).
Focus on technical depth, correctness, and clarity.`;

const SUMMARY_SYSTEM_PROMPT = `You are Crisp, summarizing a technical interview. Produce JSON with fields: summary (3-4 sentences) and overall_score (0-100).
In the summary mention strengths, gaps, and hiring recommendation.`;

const logger = new Logger("LLM:InterviewService");

function buildQuestionUserPrompt({ difficulty, candidate, previousQuestions }: QuestionRequest) {
  const profileDetails = [candidate.name && `Name: ${candidate.name}`, candidate.role && `Role: ${candidate.role}`]
    .filter(Boolean)
    .join("\n");

  const asked = previousQuestions
    .map((q, index) => `${index + 1}. (${q.difficulty}) ${q.prompt}`)
    .join("\n");

  return `Generate a ${difficulty} difficulty interview question for a React + Node.js candidate.
Candidate profile:
${profileDetails || "Unknown"}

Previously asked questions:
${asked || "None"}

The question should be rigorous yet focused. Provide guidance for evaluating answers.`;
}

function buildEvaluationPrompt({ question, candidateAnswer }: EvaluationRequest) {
  return `Interview question: ${question.prompt}
Difficulty: ${question.difficulty}
Expected guidance: ${question.evaluation?.reasoning ?? "(not provided)"}

Candidate answer:
${candidateAnswer || "(No answer provided)"}`;
}

function buildSummaryPrompt({ candidate, questions }: SummaryRequest) {
  const qa = questions
    .map((q, index) => {
      const score = q.evaluation?.score ?? 0;
      return `${index + 1}. Q: ${q.prompt}\n   Difficulty: ${q.difficulty}\n   Candidate answer: ${q.answer ?? "(blank)"}\n   Score: ${score}\n   Feedback: ${q.evaluation?.reasoning ?? ""}`;
    })
    .join("\n\n");

  return `Candidate: ${candidate.name ?? "Unknown"}
Interview timeline summary:
${qa}`;
}

const DEFAULT_MODEL = "openai/gpt-4o-mini";

async function getModel(prompt: string, intent: "question" | "evaluation" | "summary") {
  try {
    const selection = await selectModel(prompt, {
      accuracy: intent === "question" ? 0.75 : 0.9,
      cost: intent === "summary" ? 0.4 : 0.6,
      speed: intent === "evaluation" ? 0.5 : 0.6,
      tokenLimit: 4000,
      reasoning: intent !== "summary",
    });
    return selection.model ?? DEFAULT_MODEL;
  } catch (error) {
    logger.warn("Model selection failed, falling back to default", error);
    return DEFAULT_MODEL;
  }
}

export async function fetchInterviewQuestion(request: QuestionRequest): Promise<QuestionResult> {
  const userPrompt = buildQuestionUserPrompt(request);
  const model = await getModel(userPrompt, "question");
  const response = await callOpenRouter({
    model,
    messages: [
      { role: "system", content: QUESTION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 600,
    temperature: 0.6,
  });

  const json = extractJsonBlock(response) as { question: string; answer_guidance: string };

  return {
    question: json.question,
    answerGuidance: json.answer_guidance,
  };
}

export async function fetchAnswerEvaluation(request: EvaluationRequest): Promise<EvaluationResult> {
  const userPrompt = buildEvaluationPrompt(request);
  const model = await getModel(userPrompt, "evaluation");
  const response = await callOpenRouter({
    model,
    messages: [
      { role: "system", content: EVALUATION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 500,
    temperature: 0.4,
  });

  const json = extractJsonBlock(response) as { score: number; feedback: string };

  return {
    score: Math.max(0, Math.min(100, Number(json.score))),
    feedback: json.feedback,
  };
}

export async function fetchInterviewSummary(request: SummaryRequest): Promise<SummaryResult> {
  const userPrompt = buildSummaryPrompt(request);
  const model = await getModel(userPrompt, "summary");
  const response = await callOpenRouter({
    model,
    messages: [
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 400,
    temperature: 0.4,
  });

  const json = extractJsonBlock(response) as { summary: string; overall_score: number };

  return {
    summary: json.summary,
    generatedAt: new Date().toISOString(),
  };
}

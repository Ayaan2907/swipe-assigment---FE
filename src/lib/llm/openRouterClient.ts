import { env } from "@/config/env";
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function callOpenRouter({ model, messages, maxTokens = 600, temperature = 0.7 }: ChatOptions) {
  if (!env.OPEN_ROUTER_API_KEY) {
    throw new Error("OPEN_ROUTER_API_KEY is required for LLM interactions");
  }
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPEN_ROUTER_API_KEY}`,
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "Swipe Interview Assistant",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned no content");
  }
  return content;
}

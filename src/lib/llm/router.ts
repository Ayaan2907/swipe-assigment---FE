import { AutoPromptRouter, type RouterConfig } from "auto-llm-selector";

import { env } from "@/config/env";
import { Logger } from "@/utils/logger";

const logger = new Logger("LLM:Router");
const apiKey = env.OPEN_ROUTER_API_KEY;

if (!apiKey) {
  logger.warn("OPEN_ROUTER_API_KEY is not set. LLM features will fail without it.");
}

const routerConfig: RouterConfig = {
  OPEN_ROUTER_API_KEY: apiKey ?? "",
  selectorModel: "google/gemini-2.0-flash-exp:free",
  enableLogging: false,
};

const routerPromise = (async () => {
  const router = new AutoPromptRouter(routerConfig);
  if (apiKey) {
    await router.initialize();
  }
  return router;
})();

export async function selectModel(prompt: string, options: Parameters<AutoPromptRouter["getModelRecommendation"]>[1]) {
  const router = await routerPromise;
  return router.getModelRecommendation(prompt, options);
}

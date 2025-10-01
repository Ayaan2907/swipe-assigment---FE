export function extractJsonBlock(raw: string) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("LLM response did not include JSON payload");
  }
  const jsonString = jsonMatch[0];
  return JSON.parse(jsonString);
}

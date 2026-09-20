import { SearchConstraints } from "./SearchConstraints";

type ChatResponse = { choices?: Array<{ message?: { content?: string } }> };

/** Small OpenAI-compatible client. The key is read only from the server environment. */
export class OpenAIClient {
  constructor(private readonly apiKey: string, private readonly apiUrl: string, private readonly model: string) {}

  async extractConstraints(query: string): Promise<SearchConstraints> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, temperature: 0, response_format: { type: "json_object" }, messages: [
        { role: "system", content: "Extract campus search constraints as JSON only. Allowed keys: category, openAfter (HH:MM), needsAccessibleEntrance, needsAutomaticDoor, needsElevator, avoidActiveImpacts, maxDistanceMeters." },
        { role: "user", content: query }
      ] })
    });
    if (!response.ok) throw new Error(`LLM request failed with status ${response.status}`);
    const payload = await response.json() as ChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned no constraint JSON");
    return this.validate(JSON.parse(content));
  }

  async complete(prompt: string): Promise<string> {
    const query = prompt.includes("from: ") ? prompt.slice(prompt.indexOf("from: ") + 6).split("\n")[0] : prompt;
    return JSON.stringify(await this.extractConstraints(query));
  }

  private validate(value: unknown): SearchConstraints {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("LLM constraints were not an object");
    const candidate = value as Record<string, unknown>;
    const bool = (key: string) => typeof candidate[key] === "boolean" ? candidate[key] as boolean : undefined;
    return {
      category: typeof candidate.category === "string" ? candidate.category.toLowerCase() : undefined,
      openAfter: typeof candidate.openAfter === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.openAfter) ? candidate.openAfter : undefined,
      needsAccessibleEntrance: bool("needsAccessibleEntrance"), needsAutomaticDoor: bool("needsAutomaticDoor"), needsElevator: bool("needsElevator"), avoidActiveImpacts: bool("avoidActiveImpacts"),
      maxDistanceMeters: typeof candidate.maxDistanceMeters === "number" && candidate.maxDistanceMeters > 0 ? candidate.maxDistanceMeters : undefined
    };
  }
}

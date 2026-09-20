import { SearchConstraints } from "./SearchConstraints";

type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

/** Google AI Studio / Gemini REST client. The API key never leaves the server. */
export class GeminiClient {
  constructor(private readonly apiKey: string, private readonly baseUrl: string, private readonly model: string) {}

  async complete(prompt: string): Promise<string> {
    const endpoint = `${this.baseUrl.replace(/\/$/, "")}/models/${this.model}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${prompt}\nReturn JSON only. Do not wrap it in markdown.` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 }
      })
    });
    if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);
    const payload = await response.json() as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!text) throw new Error("Gemini returned no constraint JSON");
    return JSON.stringify(this.validate(JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""))));
  }

  private validate(value: unknown): SearchConstraints {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Gemini constraints were not an object");
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

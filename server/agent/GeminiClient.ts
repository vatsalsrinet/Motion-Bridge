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
    if (!text) throw new Error("Gemini returned no JSON");
    const json = text.replace(/^```json\s*|\s*```$/g, "");
    JSON.parse(json);
    return json;
  }
}

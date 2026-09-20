import { SearchConstraints } from "./SearchConstraints";
import { DatabricksService } from "../services/DatabricksService";
import { AgentResponse, CampusLocation } from "../types/agent";

export interface LLMClient {
  complete(prompt: string): Promise<string>;
}

export type AgentTool = "findLocations";

export class CampusAgent {
  private readonly llmClient?: LLMClient;
  private readonly databricksService: DatabricksService;

  // The DatabricksService-only form preserves the original integration API.
  constructor(llmClient?: LLMClient, databricksService?: DatabricksService);
  constructor(databricksService?: DatabricksService);
  constructor(
    clientOrService?: LLMClient | DatabricksService,
    service?: DatabricksService,
  ) {
    if (clientOrService instanceof DatabricksService) {
      this.databricksService = clientOrService;
    } else {
      this.llmClient = clientOrService;
      this.databricksService = service ?? new DatabricksService();
    }
  }

  async extractConstraints(query: string): Promise<SearchConstraints> {
    if (this.llmClient) {
      try {
        const raw = await this.llmClient.complete(
          `Return JSON only. Extract campus search constraints from: ${query}\n` +
          'Allowed keys: category, openAfter (HH:MM), needsAccessibleEntrance, needsAutomaticDoor, needsElevator, avoidActiveImpacts, maxDistanceMeters. ' +
          'Category, when present, must be one of: study, academic, recreation, dining, residential, research, campus service.',
        );
        return this.validateConstraints(JSON.parse(raw));
      } catch {
        // A deterministic parser is safer than failing a user search on malformed LLM JSON.
      }
    }

    const q = query.toLowerCase();
    const category = ["study", "academic", "recreation", "dining", "hospital"]
      .find((candidate) => q.includes(candidate));
    return {
      category: category ?? (q.includes("library") || q.includes("quiet") || q.includes("work") ? "study" : undefined),
      openAfter: q.includes("tonight") ? "20:00" : this.findTime(q),
      needsAccessibleEntrance: q.includes("accessible") || q.includes("automatic entrance"),
      needsAutomaticDoor: q.includes("automatic entrance") || q.includes("automatic door"),
      needsElevator: q.includes("elevator"),
      avoidActiveImpacts: q.includes("avoid") || q.includes("impact"),
      maxDistanceMeters: q.includes("nearby") ? 1000 : undefined,
    };
  }

  chooseTool(_constraints: SearchConstraints): AgentTool {
    return "findLocations";
  }

  async searchCampus(constraints: SearchConstraints): Promise<CampusLocation[]> {
    return this.databricksService.findLocations(constraints);
  }

  rankResults(results: CampusLocation[], constraints: SearchConstraints): CampusLocation[] {
    return [...results].sort((a, b) => this.score(b, constraints) - this.score(a, constraints));
  }

  async generateExplanation(results: CampusLocation[]): Promise<string> {
    if (results.length === 0) return "I could not find a campus location that matches those requirements.";
    const names = results.slice(0, 3).map((location) => location.name).join(", ");
    return `Found ${results.length} matching location${results.length === 1 ? "" : "s"}: ${names}.`;
  }

  async processQuery(query: string): Promise<AgentResponse> {
    if (!query.trim()) throw new Error("A campus search query is required.");
    const constraints = await this.extractConstraints(query);
    this.chooseTool(constraints);
    // With Gemini, category is a relevance signal instead of a hard gate: a
    // request for a quiet study spot may reasonably include academic halls.
    const searchConstraints = this.llmClient ? { ...constraints, category: undefined } : constraints;
    const results = this.rankResults(await this.searchCampus(searchConstraints), constraints);
    if (this.llmClient && results.length > 0) {
      try {
        return await this.rankWithLlm(query, results);
      } catch {
        // Search remains usable if Gemini is unavailable or returns malformed IDs.
      }
    }
    const bestResults = results.slice(0, 20);
    return { message: await this.generateExplanation(bestResults), results: bestResults };
  }

  private validateConstraints(value: unknown): SearchConstraints {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Constraint output was not an object.");
    const candidate = value as Record<string, unknown>;
    const bool = (key: string) => typeof candidate[key] === "boolean" ? candidate[key] : undefined;
    return {
      category: typeof candidate.category === "string" && ["study", "academic", "recreation", "dining", "residential", "research", "campus service"].includes(candidate.category.toLowerCase())
        ? candidate.category.toLowerCase()
        : undefined,
      openAfter: typeof candidate.openAfter === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.openAfter) ? candidate.openAfter : undefined,
      needsAccessibleEntrance: bool("needsAccessibleEntrance"), needsAutomaticDoor: bool("needsAutomaticDoor"), needsElevator: bool("needsElevator"), avoidActiveImpacts: bool("avoidActiveImpacts"),
      maxDistanceMeters: typeof candidate.maxDistanceMeters === "number" && candidate.maxDistanceMeters > 0 ? candidate.maxDistanceMeters : undefined,
    };
  }

  private score(location: CampusLocation, constraints: SearchConstraints): number {
    let score = 0;
    if (constraints.category && location.category === constraints.category) score += 12;
    if (constraints.category === "study" && location.category === "academic") score += 6;
    if (location.accessibility.accessibleEntrance) score += 3;
    if (location.accessibility.automaticDoor) score += 2;
    if (location.activeImpacts.length === 0) score += 2;
    if (constraints.needsElevator && location.accessibility.elevatorAvailable) score += 1;
    if (location.closeTime) score += Number(location.closeTime.replace(":", "")) / 10000;
    return score;
  }

  private async rankWithLlm(query: string, results: CampusLocation[]): Promise<AgentResponse> {
    if (!this.llmClient) throw new Error("LLM ranking is unavailable");
    const catalog = results.map((location) => ({
      id: location.id,
      name: location.name,
      category: location.category,
      address: location.address,
      accessibility: {
        accessibleEntrance: location.accessibility.accessibleEntrance,
        automaticDoor: location.accessibility.automaticDoor,
        elevatorAvailable: location.accessibility.elevatorAvailable
      },
      operatingHours: location.operatingHours
    }));
    const raw = await this.llmClient.complete(
      "You are ranking official Virginia Tech campus locations for a user's request. " +
      "Use only the supplied catalog facts. Treat accessibility needs as strict requirements. " +
      "Return JSON only in this shape: " +
      '{"message":"one short helpful sentence","matches":[{"id":"exact catalog id","reason":"short factual reason"}]}. ' +
      "Choose up to 20 genuinely useful options, best match first. Never invent an ID, hours, amenity, or accessibility feature.\n" +
      `User request: ${JSON.stringify(query)}\nCatalog: ${JSON.stringify(catalog)}`
    );
    const parsed = JSON.parse(raw) as { message?: unknown; matches?: unknown };
    if (!Array.isArray(parsed.matches)) throw new Error("Gemini returned no ranked matches");

    const byId = new Map(results.map((location) => [location.id, location]));
    const seen = new Set<string>();
    const ranked = parsed.matches.flatMap((match) => {
      if (!match || typeof match !== "object") return [];
      const candidate = match as Record<string, unknown>;
      if (typeof candidate.id !== "string" || seen.has(candidate.id)) return [];
      const location = byId.get(candidate.id);
      if (!location) return [];
      seen.add(candidate.id);
      return [{
        ...location,
        ...(typeof candidate.reason === "string" && candidate.reason.trim()
          ? { matchReason: candidate.reason.trim().slice(0, 180) }
          : {})
      }];
    }).slice(0, 20);
    if (ranked.length === 0) throw new Error("Gemini returned no valid campus IDs");

    // Gemini may choose only a handful of obvious locations. Keep its choices
    // first, then fill the list from the already-filtered deterministic ranking
    // so users can browse a useful range without weakening hard requirements.
    const minimumResults = Math.min(15, results.length);
    for (const location of results) {
      if (ranked.length >= minimumResults) break;
      if (seen.has(location.id)) continue;
      seen.add(location.id);
      ranked.push(location);
    }

    return {
      message: typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message.trim().slice(0, 300)
        : `Gemini selected the ${ranked.length} strongest matches from the Virginia Tech campus catalog.`,
      results: ranked
    };
  }

  private findTime(query: string): string | undefined {
    const match = query.match(/(?:after|until)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!match) return undefined;
    let hour = Number(match[1]);
    if (match[3] === "pm" && hour < 12) hour += 12;
    if (match[3] === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${match[2] ?? "00"}`;
  }
}

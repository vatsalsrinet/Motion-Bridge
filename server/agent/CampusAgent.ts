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
          'Allowed keys: category, openAfter (HH:MM), needsAccessibleEntrance, needsAutomaticDoor, needsElevator, avoidActiveImpacts, maxDistanceMeters.',
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
    const results = this.rankResults(await this.searchCampus(constraints), constraints);
    return { message: await this.generateExplanation(results), results };
  }

  private validateConstraints(value: unknown): SearchConstraints {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Constraint output was not an object.");
    const candidate = value as Record<string, unknown>;
    const bool = (key: string) => typeof candidate[key] === "boolean" ? candidate[key] : undefined;
    return {
      category: typeof candidate.category === "string" ? candidate.category.toLowerCase() : undefined,
      openAfter: typeof candidate.openAfter === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.openAfter) ? candidate.openAfter : undefined,
      needsAccessibleEntrance: bool("needsAccessibleEntrance"), needsAutomaticDoor: bool("needsAutomaticDoor"), needsElevator: bool("needsElevator"), avoidActiveImpacts: bool("avoidActiveImpacts"),
      maxDistanceMeters: typeof candidate.maxDistanceMeters === "number" && candidate.maxDistanceMeters > 0 ? candidate.maxDistanceMeters : undefined,
    };
  }

  private score(location: CampusLocation, constraints: SearchConstraints): number {
    let score = 0;
    if (location.accessibility.accessibleEntrance) score += 3;
    if (location.accessibility.automaticDoor) score += 2;
    if (location.activeImpacts.length === 0) score += 2;
    if (constraints.needsElevator && location.accessibility.elevatorAvailable) score += 1;
    if (location.closeTime) score += Number(location.closeTime.replace(":", "")) / 10000;
    return score;
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

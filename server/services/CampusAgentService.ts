import { LLMClient, RuleBasedLLMClient } from "../agent/LLMClient";
import { SearchConstraints } from "../agent/SearchConstraints";
import { DatabricksService } from "./DatabricksService";
import { AgentResponse, CampusAgent, CampusLocation } from "../types/agent";

export type AgentTool = "searchCampus";

export class CampusAgentService implements CampusAgent {
  constructor(
    private readonly llmClient: LLMClient = new RuleBasedLLMClient(),
    private readonly databricksService: DatabricksService = new DatabricksService()
  ) {}

  async processQuery(query: string): Promise<AgentResponse> {
    const constraints = await this.extractConstraints(query);
    const results = await this.searchCampus(constraints);
    const rankedResults = this.rankResults(results, constraints);
    return {
      message: await this.generateExplanation(rankedResults),
      results: rankedResults
    };
  }

  async extractConstraints(query: string): Promise<SearchConstraints> {
    return this.llmClient.extractConstraints(query);
  }

  async searchCampus(constraints: SearchConstraints): Promise<CampusLocation[]> {
    return this.databricksService.findLocations(constraints);
  }

  chooseTool(_constraints: SearchConstraints): AgentTool {
    return "searchCampus";
  }

  rankResults(results: CampusLocation[], constraints: SearchConstraints): CampusLocation[] {
    return [...results].sort((left, right) => this.score(right, constraints) - this.score(left, constraints));
  }

  async generateExplanation(results: CampusLocation[]): Promise<string> {
    return this.llmClient.generateExplanation(results);
  }

  private score(location: CampusLocation, constraints: SearchConstraints): number {
    let score = 0;
    if (location.accessibility.accessibleEntrance) score += 3;
    if (location.accessibility.automaticDoor) score += 2;
    if (location.activeImpacts.length === 0) score += 2;
    if (constraints.needsElevator && location.accessibility.elevatorAvailable) score += 1;
    if (location.closeTime) score += Number(location.closeTime.replace(":", ".")) / 100;
    return score;
  }
}

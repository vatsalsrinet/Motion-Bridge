import { DatabricksService } from "../databricks/DatabricksService";

export class CampusAgent {
  constructor(
    private databricksService = new DatabricksService()
  ) {}

  async extractConstraints(query: string) {
    const q = query.toLowerCase();

    return {
      category: q.includes("study")
        ? "study"
        : undefined,

      needsAccessibleEntrance:
        q.includes("accessible"),

      needsElevator:
        q.includes("elevator"),

      avoidActiveImpacts:
        q.includes("avoid")
    };
  }

  async processQuery(query: string) {
    const constraints =
      await this.extractConstraints(query);

    const results =
      await this.databricksService.findLocations(
        constraints
      );

    return {
      message: `Found ${results.length} locations`,
      results
    };
  }
}
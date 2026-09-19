import { describe, expect, it } from "vitest";
import { CampusAgentService } from "../server/services/CampusAgentService";

const agent = new CampusAgentService();

describe("CampusAgentService", () => {
  it.each([
    ["Find an accessible study space open tonight.", "study"],
    ["Find somewhere with an automatic entrance.", "automatic"],
    ["Find a campus place with elevator access.", "elevator"],
    ["Avoid buildings with current accessibility impacts.", "impact"],
    ["Show me nearby accessible options.", "accessible"]
  ])("handles %s", async (query, category) => {
    const response = await agent.processQuery(query);

    expect(response.message).toMatch(/found|could not find/i);
    expect(Array.isArray(response.results)).toBe(true);
    if (category === "study") {
      expect(response.results.every((result) => result.category === "study")).toBe(true);
    }
    if (category === "automatic") {
      expect(response.results.every((result) => result.accessibility.automaticDoor)).toBe(true);
    }
    if (category === "elevator") {
      expect(response.results.every((result) => result.accessibility.elevatorAvailable)).toBe(true);
    }
    if (category === "impact") {
      expect(response.results.every((result) => result.activeImpacts.length === 0)).toBe(true);
    }
    if (category === "accessible") {
      expect(response.results.every((result) => result.accessibility.accessibleEntrance)).toBe(true);
    }
  });

  it("returns an empty result set without throwing", async () => {
    const response = await agent.processQuery("Find a hospital with a helipad");

    expect(response.results).toEqual([]);
    expect(response.message).toMatch(/could not find/i);
  });
});

import { describe, expect, it } from "vitest";
import { CampusAgent } from "../server/agent/CampusAgent";

const agent = new CampusAgent();

describe("CampusAgent", () => {
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

  it("uses LLM-ranked catalog IDs and exposes a factual match reason", async () => {
    const responses = [
      JSON.stringify({}),
      JSON.stringify({
        message: "Newman Library is the strongest match.",
        matches: [{ id: "newman-library-0177", reason: "Library study space with mapped accessibility features." }]
      })
    ];
    const rankedAgent = new CampusAgent({ complete: async () => responses.shift() ?? "{}" });

    const response = await rankedAgent.processQuery("Find a library");

    expect(response.results.length).toBeGreaterThanOrEqual(15);
    expect(response.results[0].name).toBe("Newman Library");
    expect(response.results[0].matchReason).toMatch(/study space/i);
  });

  it("provides weekday and weekend planning hours for the complete catalog", async () => {
    const locations = await agent.searchCampus({});

    expect(locations.length).toBeGreaterThan(500);
    expect(locations.every((location) =>
      Boolean(location.operatingHours?.weekdays && location.operatingHours?.weekends)
    )).toBe(true);
  });
});

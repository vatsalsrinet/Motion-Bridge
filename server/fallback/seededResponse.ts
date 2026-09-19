import { AgentResponse } from "../types/agent";

export const getSeededFallbackResponse = (query: string): AgentResponse => ({
  message: `Demo results for: ${query}`,
  results: [
    {
      id: "demo-study-space",
      name: "Newman Library",
      category: "study space",
      openTime: "07:00",
      closeTime: "23:00",
      accessibility: {
        accessibleEntrance: true,
        automaticDoor: true,
        elevatorAvailable: true,
        accessibleRoute: true,
        notes: "Accessible entrance is available from the east side."
      },
      activeImpacts: []
    }
  ]
});

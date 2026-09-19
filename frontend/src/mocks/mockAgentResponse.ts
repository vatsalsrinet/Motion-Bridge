import type { AgentResponse, ApiErrorResponse, CampusLocation } from "../types/contracts";

/**
 * Fixtures mirroring server/data/seed-campus-locations.json so the mocked UI
 * and the real backend render identically. Deliberately mixed: one flawless
 * result, one with an active impact, one with gaps in its accessibility data.
 */

export const mockLocations: CampusLocation[] = [
  {
    id: "newman-library",
    name: "Newman Library",
    category: "study",
    latitude: 37.2296,
    longitude: -80.4231,
    openTime: "07:00",
    closeTime: "23:00",
    accessibility: {
      accessibleEntrance: true,
      automaticDoor: true,
      elevatorAvailable: true,
      accessibleRoute: true,
      notes: "Accessible east entrance and elevator available."
    },
    activeImpacts: []
  },
  {
    id: "torgersen-hall",
    name: "Torgersen Hall",
    category: "study",
    latitude: 37.2289,
    longitude: -80.4242,
    openTime: "08:00",
    closeTime: "22:00",
    accessibility: {
      accessibleEntrance: true,
      automaticDoor: true,
      elevatorAvailable: true,
      accessibleRoute: true,
      notes: "Accessible entrance on the north side."
    },
    activeImpacts: [
      {
        id: "impact-torgersen-elevator",
        buildingId: "torgersen-hall",
        type: "Elevator outage",
        description: "The bridge-level elevator is out of service until Friday. Upper floors are reachable only by stairs."
      }
    ]
  },
  {
    id: "student-success-center",
    name: "Student Success Center",
    category: "study",
    latitude: 37.2267,
    longitude: -80.4219,
    openTime: "08:00",
    closeTime: "20:00",
    accessibility: {
      accessibleEntrance: true,
      automaticDoor: false,
      elevatorAvailable: true,
      accessibleRoute: true,
      notes: "Accessible route is available from the west entrance. The door is not automatic."
    },
    activeImpacts: []
  },
  {
    id: "squires-student-center",
    name: "Squires Student Center",
    category: "student life",
    latitude: 37.2288,
    longitude: -80.4174,
    openTime: "07:00",
    closeTime: "24:00",
    accessibility: {
      accessibleEntrance: true,
      automaticDoor: true,
      elevatorAvailable: false,
      accessibleRoute: false,
      notes: "Ground floor is accessible. No elevator to the lower-level study rooms."
    },
    activeImpacts: [
      {
        id: "impact-squires-walk",
        buildingId: "squires-student-center",
        type: "Construction",
        description: "Sidewalk closure on the College Avenue side. Detour adds roughly 120 metres."
      }
    ]
  }
];

export const mockAgentResponse: AgentResponse = {
  message:
    "I found four spaces open tonight. Newman Library is the strongest match — accessible entrance, automatic door and a working elevator. Two others have active impacts worth knowing about.",
  results: mockLocations
};

export const mockEmptyResponse: AgentResponse = {
  message:
    "I could not find a campus space matching all of those constraints tonight. Try relaxing the closing time or the elevator requirement.",
  results: []
};

export const mockApiError: ApiErrorResponse = {
  error: "The campus agent could not process the query",
  code: "AGENT_FAILURE",
  retryable: true
};

/** Stand-in for POST /api/agent, including a realistic delay. */
export const fetchMockAgentResponse = async (query: string): Promise<AgentResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const normalized = query.toLowerCase();
  if (normalized.includes("empty") || normalized.includes("nothing")) {
    return mockEmptyResponse;
  }
  if (normalized.includes("fail") || normalized.includes("error")) {
    throw mockApiError;
  }
  return mockAgentResponse;
};

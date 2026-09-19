export interface AccessibilityInfo {
  accessibleEntrance: boolean;
  automaticDoor: boolean;
  elevatorAvailable: boolean;
  accessibleRoute: boolean;
  notes: string;
}

export interface CampusImpact {
  id?: string;
  buildingId?: string;
  type: string;
  description: string;
}

export interface CampusLocation {
  id: string;
  name: string;
  category: string;
  latitude?: number;
  longitude?: number;
  openTime?: string;
  closeTime?: string;
  accessibility: AccessibilityInfo;
  activeImpacts: CampusImpact[];
}

export interface AgentResponse {
  message: string;
  results: CampusLocation[];
}

export interface CampusAgent {
  processQuery(query: string): Promise<AgentResponse>;
}

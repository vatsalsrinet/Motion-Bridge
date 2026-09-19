export interface AccessibilityInfo {
  accessibleEntrance: boolean;
  automaticDoor: boolean;
  elevatorAvailable: boolean;
  accessibleRoute: boolean;
  notes: string;
}

export interface CampusImpact {
  type: string;
  description: string;
}

export interface CampusLocation {
  id: string;
  name: string;
  category: string;
  openTime?: string;
  closeTime?: string;
  accessibility: AccessibilityInfo;
  activeImpacts: CampusImpact[];
}

export interface AgentResponse {
  message: string;
  results: CampusLocation[];
}

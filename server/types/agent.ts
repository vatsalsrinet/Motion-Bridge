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

export interface OperatingHours {
  weekdays: string;
  weekends: string;
  status: "published" | "typical";
  note: string;
  sourceUrl?: string;
}

export interface CampusLocation {
  id: string;
  buildingId?: string;
  name: string;
  category: string;
  latitude?: number;
  longitude?: number;
  openTime?: string;
  closeTime?: string;
  address?: string;
  sourceUrl?: string;
  matchReason?: string;
  operatingHours?: OperatingHours;
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

/**
 * Shared integration contracts.
 *
 * These shapes are agreed across the whole team. Do not change anything in this
 * file without telling Person 1 (gestures), Person 2 (agent) and Person 4 (API).
 * Verified against server/types/agent.ts and server/types/api.ts on the backend.
 */

/* ------------------------------------------------------------------ */
/* Person 1 — gesture events                                           */
/* ------------------------------------------------------------------ */

export type GestureType = "NEXT" | "SELECT";

export type GestureCommand = {
  command: "NEXT" | "SELECT" | "NEUTRAL";
  confidence: number;
};

/* ------------------------------------------------------------------ */
/* Person 2 / Person 4 — campus agent                                  */
/* ------------------------------------------------------------------ */

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
  /** Present in live payloads; unused by the UI but part of the shape. */
  buildingId?: string;
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

/** Error envelope produced by the backend's centralized error handler. */
export type ApiErrorCode =
  | "INVALID_QUERY"
  | "DATABRICKS_UNAVAILABLE"
  | "AGENT_FAILURE"
  | "INTERNAL_ERROR"
  /** Added by the frontend when the request never reached the server. */
  | "NETWORK_ERROR";

export interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  retryable: boolean;
}

/* ------------------------------------------------------------------ */
/* Frontend-owned                                                      */
/* ------------------------------------------------------------------ */

export type Screen =
  | "LANDING"
  | "NEUTRAL_CALIBRATION"
  | "NEXT_CALIBRATION"
  | "SELECT_CALIBRATION"
  | "READY"
  | "CAMPUS_AGENT"
  | "LOCATION_DETAILS";

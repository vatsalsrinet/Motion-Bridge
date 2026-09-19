export interface SearchConstraints {
  category?: string;
  openAfter?: string;
  needsAccessibleEntrance?: boolean;
  needsAutomaticDoor?: boolean;
  needsElevator?: boolean;
  avoidActiveImpacts?: boolean;
  maxDistanceMeters?: number;
}

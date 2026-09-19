export interface SearchConstraints {
  category?: string;
  openAfter?: string;
  needsAccessibleEntrance?: boolean;
  needsElevator?: boolean;
  avoidActiveImpacts?: boolean;
  maxDistanceMeters?: number;
}
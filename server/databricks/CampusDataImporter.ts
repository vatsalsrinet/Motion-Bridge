import locations from "../data/seed-campus-locations.json";
import { AccessibilityInfo, CampusLocation } from "../types/campus";

/** Normalizes the committed VT campus snapshot before a manual Databricks load. */
export class CampusDataImporter {
  async fetchVTAccessibilityData(): Promise<unknown[]> { return locations as unknown[]; }
  async fetchCampusImpactData(): Promise<unknown[]> {
    return (locations as CampusLocation[]).flatMap((location) => location.activeImpacts);
  }
  normalizeLocations(rawData: unknown[]): CampusLocation[] {
    return rawData.filter(this.isLocation).map((location) => ({ ...location, activeImpacts: location.activeImpacts ?? [] }));
  }
  normalizeAccessibility(rawData: unknown[]): AccessibilityInfo[] {
    return rawData.filter((value): value is AccessibilityInfo => Boolean(value) && typeof value === "object" && "accessibleEntrance" in value);
  }
  async loadIntoDatabricks(): Promise<void> {
    // Loading is intentionally manual for this hackathon. The normalized snapshot is
    // the source artifact; deploy it to the four documented Databricks tables.
  }
  private isLocation(value: unknown): value is CampusLocation {
    return Boolean(value) && typeof value === "object" && "id" in value && "name" in value && "accessibility" in value;
  }
}

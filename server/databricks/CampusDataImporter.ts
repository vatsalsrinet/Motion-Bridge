import { CampusLocation } from "../types/agent";

export class CampusDataImporter {
  async fetchVTAccessibilityData(): Promise<unknown[]> {
    return [];
  }

  async fetchCampusImpactData(): Promise<unknown[]> {
    return [];
  }

  normalizeLocations(rawData: unknown[]): CampusLocation[] {
    return rawData as CampusLocation[];
  }

  normalizeAccessibility(rawData: unknown[]): CampusLocation["accessibility"][] {
    return rawData as CampusLocation["accessibility"][];
  }

  async loadIntoDatabricks(): Promise<void> {
    throw new Error("Campus data import requires a configured Databricks workspace");
  }
}

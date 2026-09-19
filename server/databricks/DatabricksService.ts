import locations from "../data/seed-campus-locations.json";

export class DatabricksService {
  async healthCheck(): Promise<boolean> {
    return true;
  }

  async findLocations(constraints: any) {
    let results = [...locations];

    if (constraints.category) {
      results = results.filter(
        (l: any) => l.category === constraints.category
      );
    }

    if (constraints.needsAccessibleEntrance) {
      results = results.filter(
        (l: any) => l.accessibility.accessibleEntrance
      );
    }

    if (constraints.needsElevator) {
      results = results.filter(
        (l: any) => l.accessibility.elevatorAvailable
      );
    }

    return results;
  }
}
import seedLocations from "../data/seed-campus-locations.json";
import { SearchConstraints } from "../agent/SearchConstraints";
import { buildLocationQuery } from "../databricks/queries";
import { AccessibilityInfo, CampusImpact, CampusLocation } from "../types/agent";

type DatabricksConfig = {
  host?: string;
  token?: string;
  warehouseId?: string;
};

type DatabricksRow = Record<string, unknown>;

const toBoolean = (value: unknown): boolean => value === true || value === 1 || value === "true";

export class DatabricksService {
  constructor(private readonly config: DatabricksConfig = {}) {}

  private get isConfigured(): boolean {
    return Boolean(this.config.host && this.config.token && this.config.warehouseId);
  }

  async executeQuery(sql: string, params: Record<string, string | number | boolean> = {}): Promise<DatabricksRow[]> {
    if (!this.isConfigured) throw new Error("Databricks is not configured");

    const statement = sql.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
      const value = params[name];
      if (value === undefined) throw new Error(`Missing SQL parameter: ${name}`);
      if (typeof value === "boolean" || typeof value === "number") return String(value);
      return `'${value.replace(/'/g, "''")}'`;
    });

    const response = await fetch(`https://${this.config.host}/api/2.0/sql/statements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        warehouse_id: this.config.warehouseId,
        statement,
        wait_timeout: "30s",
        disposition: "INLINE",
        format: "JSON_ARRAY"
      })
    });

    if (!response.ok) throw new Error(`Databricks query failed with status ${response.status}`);
    const payload = await response.json() as {
      result?: { data_array?: unknown[][] };
      manifest?: { schema?: { columns?: { name: string }[] } };
    };
    const columns = payload.manifest?.schema?.columns?.map((column) => column.name) ?? [];
    return (payload.result?.data_array ?? []).map((row) =>
      Object.fromEntries(columns.map((column, index) => [column, row[index]]))
    );
  }

  async findLocations(constraints: SearchConstraints): Promise<CampusLocation[]> {
    if (!this.isConfigured) return this.filterSeedLocations(constraints);

    const params: Record<string, string | number | boolean> = {};
    if (constraints.category) params.category = constraints.category;
    if (constraints.openAfter) params.openAfter = constraints.openAfter;
    const rows = await this.executeQuery(buildLocationQuery(constraints), params);
    return rows.map((row) => this.mapRow(row));
  }

  async getAccessibility(buildingId: string): Promise<AccessibilityInfo> {
    const locations = await this.findLocations({});
    const location = locations.find((candidate) => candidate.id === buildingId);
    if (!location) throw new Error(`Building not found: ${buildingId}`);
    return location.accessibility;
  }

  async getCampusImpacts(): Promise<CampusImpact[]> {
    const locations = await this.findLocations({});
    return locations.flatMap((location) => location.activeImpacts);
  }

  async getLocationById(id: string): Promise<CampusLocation> {
    const locations = await this.findLocations({});
    const location = locations.find((candidate) => candidate.id === id);
    if (!location) throw new Error(`Location not found: ${id}`);
    return location;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      await this.executeQuery("SELECT 1 AS ok");
      return true;
    } catch {
      return false;
    }
  }

  private filterSeedLocations(constraints: SearchConstraints): CampusLocation[] {
    return (seedLocations as CampusLocation[]).filter((location) => {
      if (constraints.category && location.category !== constraints.category) return false;
      if (constraints.openAfter && (location.closeTime ?? "00:00") < constraints.openAfter) return false;
      if (constraints.needsAccessibleEntrance && !location.accessibility.accessibleEntrance) return false;
      if (constraints.needsAutomaticDoor && !location.accessibility.automaticDoor) return false;
      if (constraints.needsElevator && !location.accessibility.elevatorAvailable) return false;
      if (constraints.avoidActiveImpacts && location.activeImpacts.length > 0) return false;
      return true;
    });
  }

  private mapRow(row: DatabricksRow): CampusLocation {
    return {
      id: String(row.id),
      name: String(row.name),
      category: String(row.category),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      openTime: String(row.openTime),
      closeTime: String(row.closeTime),
      accessibility: {
        accessibleEntrance: toBoolean(row.accessibleEntrance),
        automaticDoor: toBoolean(row.automaticDoor),
        elevatorAvailable: toBoolean(row.elevatorAvailable),
        accessibleRoute: toBoolean(row.accessibleRoute),
        notes: String(row.accessibilityNotes ?? "")
      },
      activeImpacts: row.impactId
        ? [{ type: String(row.impactType), description: String(row.impactDescription) }]
        : []
    };
  }
}

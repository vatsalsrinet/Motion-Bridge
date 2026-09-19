import locations from "../data/seed-campus-locations.json";
import {
  AccessibilityInfo,
  CampusImpact,
  CampusLocation,
  SearchConstraints,
} from "../types/campus";

export interface DatabricksConfig {
  host: string;
  token: string;
  warehouseId: string;
}

type StatementResponse = {
  statement_id: string;
  status: { state: string; error?: { message?: string } };
  manifest?: { schema?: { columns?: Array<{ name: string }> } };
  result?: { data_array?: unknown[][] };
};

const isConfigured = (config?: Partial<DatabricksConfig>): config is DatabricksConfig =>
  Boolean(config?.host && config.token && config.warehouseId);

const asLocation = (value: CampusLocation): CampusLocation => ({
  ...value,
  accessibility: { ...value.accessibility },
  activeImpacts: [...value.activeImpacts],
});

export class DatabricksService {
  private readonly config?: DatabricksConfig;
  private readonly fetcher: typeof fetch;

  constructor(config?: Partial<DatabricksConfig>, fetcher: typeof fetch = fetch) {
    this.config = isConfigured(config) ? config : undefined;
    this.fetcher = fetcher;
  }

  /**
   * Runs a parameterized Databricks Statement Execution API query.
   * The seed-data fallback keeps the demo usable when credentials are absent.
   */
  async executeQuery(sql: string, params: Record<string, unknown> = {}): Promise<any[]> {
    if (!this.config) {
      throw new Error("Databricks is not configured. Set host, token, and warehouseId to execute SQL.");
    }

    const host = this.config.host.replace(/\/$/, "");
    const response = await this.fetcher(`${host}/api/2.0/sql/statements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        statement: sql,
        warehouse_id: this.config.warehouseId,
        disposition: "INLINE",
        format: "JSON_ARRAY",
        parameters: Object.entries(params).map(([name, value]) => ({
          name,
          value: String(value),
          type: typeof value === "boolean" ? "BOOLEAN" : "STRING",
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Databricks query failed (${response.status}): ${await response.text()}`);
    }

    let statement = (await response.json()) as StatementResponse;
    // Statement execution can be asynchronous; wait briefly for the result.
    for (let attempt = 0; statement.status.state === "PENDING" || statement.status.state === "RUNNING"; attempt += 1) {
      if (attempt === 20) throw new Error("Databricks query timed out while waiting for results.");
      await new Promise((resolve) => setTimeout(resolve, 250));
      const poll = await this.fetcher(`${host}/api/2.0/sql/statements/${statement.statement_id}`, {
        headers: { Authorization: `Bearer ${this.config.token}` },
      });
      if (!poll.ok) throw new Error(`Databricks query polling failed (${poll.status}).`);
      statement = (await poll.json()) as StatementResponse;
    }
    if (statement.status.state !== "SUCCEEDED") {
      throw new Error(`Databricks query failed: ${statement.status.error?.message ?? statement.status.state}`);
    }

    const columns = statement.manifest?.schema?.columns?.map((column) => column.name) ?? [];
    return (statement.result?.data_array ?? []).map((row) =>
      Object.fromEntries(columns.map((column, index) => [column, row[index]])),
    );
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config) return true; // Local seed snapshot is a valid demo data source.
    try {
      await this.executeQuery("SELECT 1 AS healthy");
      return true;
    } catch {
      return false;
    }
  }

  async findLocations(constraints: SearchConstraints): Promise<CampusLocation[]> {
    if (this.config) return this.findLocationsInDatabricks(constraints);

    let results = (locations as CampusLocation[]).map(asLocation);

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

    if (constraints.openAfter) {
      results = results.filter((location) => !location.closeTime || location.closeTime >= constraints.openAfter!);
    }

    if (constraints.avoidActiveImpacts) {
      results = results.filter((location) => location.activeImpacts.length === 0);
    }

    return results;
  }

  async getAccessibility(buildingId: string): Promise<AccessibilityInfo> {
    const location = await this.getLocationById(buildingId);
    if (!location) throw new Error(`No campus location found for building '${buildingId}'.`);
    return location.accessibility;
  }

  async getCampusImpacts(): Promise<CampusImpact[]> {
    if (!this.config) return (locations as CampusLocation[]).flatMap((location) => location.activeImpacts);
    const rows = await this.executeQuery("SELECT id, building_id, type, description, start_time, end_time FROM campus_impacts WHERE end_time >= current_timestamp()");
    return rows.map((row) => ({ id: row.id, buildingId: row.building_id, type: row.type, description: row.description, startTime: row.start_time, endTime: row.end_time }));
  }

  async getLocationById(id: string): Promise<CampusLocation | undefined> {
    if (!this.config) return (locations as CampusLocation[]).find((location) => location.id === id);
    const results = await this.findLocationsInDatabricks({});
    return results.find((location) => location.id === id);
  }

  private async findLocationsInDatabricks(constraints: SearchConstraints): Promise<CampusLocation[]> {
    const clauses = ["1 = 1"];
    const params: Record<string, unknown> = {};
    if (constraints.category) { clauses.push("p.category = :category"); params.category = constraints.category; }
    if (constraints.openAfter) { clauses.push("p.close_time >= :openAfter"); params.openAfter = constraints.openAfter; }
    if (constraints.needsAccessibleEntrance) clauses.push("a.accessible_entrance = true");
    if (constraints.needsElevator) clauses.push("e.elevator_available = true");
    if (constraints.avoidActiveImpacts) clauses.push("i.building_id IS NULL");
    const sql = `SELECT p.id, p.name, p.category, p.latitude, p.longitude, p.open_time, p.close_time,
      a.accessible_entrance, a.automatic_door, a.accessible_route, a.notes AS accessibility_notes,
      e.elevator_available
      FROM campus_places p
      LEFT JOIN accessible_entrances a ON p.building_id = a.building_id
      LEFT JOIN elevators e ON p.building_id = e.building_id
      LEFT JOIN campus_impacts i ON p.building_id = i.building_id AND i.start_time <= current_timestamp() AND i.end_time >= current_timestamp()
      WHERE ${clauses.join(" AND ")}`;
    const rows = await this.executeQuery(sql, params);
    return rows.map((row) => ({
      id: String(row.id), name: String(row.name), category: String(row.category),
      latitude: row.latitude == null ? undefined : Number(row.latitude), longitude: row.longitude == null ? undefined : Number(row.longitude),
      openTime: row.open_time, closeTime: row.close_time, activeImpacts: [],
      accessibility: { accessibleEntrance: Boolean(row.accessible_entrance), automaticDoor: Boolean(row.automatic_door), elevatorAvailable: Boolean(row.elevator_available), accessibleRoute: Boolean(row.accessible_route), notes: row.accessibility_notes ?? "" },
    }));
  }
}

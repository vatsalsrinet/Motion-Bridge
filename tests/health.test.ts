import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { DatabricksService } from "../server/services/DatabricksService";
import { CampusAgent } from "../server/types/agent";

const agent: CampusAgent = {
  processQuery: async () => ({ message: "ok", results: [] })
};

class HealthyDatabricksService extends DatabricksService {
  override async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe("GET /api/health", () => {
  it("reports healthy server dependencies", async () => {
    const response = await request(createApp(agent, new HealthyDatabricksService()))
      .get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      services: { server: true, databricks: true }
    });
  });
});

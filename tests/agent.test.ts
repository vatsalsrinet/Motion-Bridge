import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { DatabricksService } from "../server/services/DatabricksService";
import { CampusAgent } from "../server/types/agent";

const databricks = new DatabricksService();

const successfulAgent: CampusAgent = {
  processQuery: async (query) => ({ message: `received: ${query}`, results: [] })
};

describe("POST /api/agent", () => {
  it("rejects invalid queries", async () => {
    const response = await request(createApp(successfulAgent, databricks))
      .post("/api/agent")
      .send({ query: "   " });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_QUERY");
  });

  it("passes valid queries to CampusAgent", async () => {
    const response = await request(createApp(successfulAgent, databricks))
      .post("/api/agent")
      .send({ query: "Find an accessible study space" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "received: Find an accessible study space",
      results: []
    });
  });

  it("converts agent failures into stable API errors", async () => {
    const failingAgent: CampusAgent = {
      processQuery: async () => {
        throw new Error("agent unavailable");
      }
    };

    const response = await request(createApp(failingAgent, databricks))
      .post("/api/agent")
      .send({ query: "Find a library" });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: "The campus agent could not process the query",
      code: "AGENT_FAILURE",
      retryable: true
    });
  });
});

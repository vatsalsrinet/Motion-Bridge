import { Request, Response } from "express";
import { z } from "zod";
import { config } from "../config";
import { getSeededFallbackResponse } from "../fallback/seededResponse";
import { ApiError } from "../middleware/errorHandler";
import { CampusAgent } from "../types/agent";

const agentRequestSchema = z.object({
  query: z.string().trim().min(1).max(500)
});

export class AgentController {
  constructor(private readonly campusAgent: CampusAgent) {}

  async handleAgentQuery(request: Request, response: Response): Promise<void> {
    const parsedRequest = agentRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      throw new ApiError(
        "INVALID_QUERY",
        "A non-empty query of 500 characters or fewer is required",
        false,
        400
      );
    }

    try {
      const agentResponse = await this.campusAgent.processQuery(parsedRequest.data.query);
      response.json(agentResponse);
    } catch (error) {
      if (config.demoFallback) {
        console.warn("Campus agent failed; serving seeded demo response");
        response.json(getSeededFallbackResponse(parsedRequest.data.query));
        return;
      }

      throw new ApiError(
        "AGENT_FAILURE",
        "The campus agent could not process the query",
        true,
        503
      );
    }
  }
}

import cors from "cors";
import express, { Express } from "express";
import { AgentController } from "./controllers/AgentController";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { createAgentRouter } from "./routes/agent";
import { createHealthRouter } from "./routes/health";
import { CampusAgent as CampusAgentImplementation } from "./agent/CampusAgent";
import { DatabricksService } from "./services/DatabricksService";
import { CampusAgent as CampusAgentContract } from "./types/agent";
import { OpenAIClient } from "./agent/OpenAIClient";

export const createApp = (
  campusAgent: CampusAgentContract = new CampusAgentImplementation(
    config.llmApiKey ? new OpenAIClient(config.llmApiKey, config.llmApiUrl, config.llmModel) : undefined,
    new DatabricksService({
      host: config.databricksHost,
      token: config.databricksToken,
      warehouseId: config.databricksWarehouseId
    })
  ),
  databricksService: DatabricksService = new DatabricksService(
    {
      host: config.databricksHost,
      token: config.databricksToken,
      warehouseId: config.databricksWarehouseId
    }
  )
): Express => {
  const app = express();
  const agentController = new AgentController(campusAgent);

  app.use(cors({ origin: config.frontendOrigin }));
  app.use(express.json());
  app.use(requestLogger);
  app.use("/api/health", createHealthRouter(databricksService));
  app.use("/api/agent", createAgentRouter(agentController));
  app.use(errorHandler);

  return app;
};

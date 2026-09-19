import { Router } from "express";
import { AgentController } from "../controllers/AgentController";

export const createAgentRouter = (controller: AgentController): Router => {
  const router = Router();
  router.post("/", (request, response, next) => {
    controller.handleAgentQuery(request, response).catch(next);
  });
  return router;
};

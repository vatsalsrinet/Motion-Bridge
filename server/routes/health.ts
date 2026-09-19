import { Router } from "express";
import { DatabricksService } from "../services/DatabricksService";

export const createHealthRouter = (databricksService: DatabricksService): Router => {
  const router = Router();

  router.get("/", async (_request, response) => {
    const databricksAvailable = await databricksService.healthCheck();
    response.status(databricksAvailable ? 200 : 503).json({
      ok: databricksAvailable,
      services: {
        server: true,
        databricks: databricksAvailable
      }
    });
  });

  return router;
};

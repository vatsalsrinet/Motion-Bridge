import dotenv from "dotenv";

dotenv.config();

const parsePort = (value: string | undefined): number => {
  const port = Number(value ?? 3000);
  return Number.isInteger(port) && port > 0 ? port : 3000;
};

export const config = {
  port: parsePort(process.env.PORT),
  nodeEnv: process.env.NODE_ENV ?? "development",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  databricksHost: process.env.DATABRICKS_HOST,
  databricksToken: process.env.DATABRICKS_TOKEN,
  databricksWarehouseId: process.env.DATABRICKS_WAREHOUSE_ID,
  demoFallback: process.env.DEMO_FALLBACK === "true"
};

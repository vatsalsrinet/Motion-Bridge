import { useEffect, useState } from "react";

export type DataSource = "live" | "seed" | "unknown";

export interface BackendHealth {
  /** Whether the API answered at all. */
  reachable: boolean;
  /** Where campus results are coming from. */
  dataSource: DataSource;
  checked: boolean;
}

interface HealthPayload {
  ok: boolean;
  services: { server: boolean; databricks: boolean };
}

const isHealthPayload = (value: unknown): value is HealthPayload =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as HealthPayload).services === "object" &&
  (value as HealthPayload).services !== null;

/**
 * Reads GET /api/health.
 *
 * The backend answers 503 when Databricks is not configured, but campus search
 * still works — DatabricksService falls back to a committed seed snapshot. So a
 * 503 here means "degraded, not broken", and the body is still valid JSON worth
 * reading. Treating it as unreachable would be wrong.
 */
export const useBackendHealth = (enabled: boolean): BackendHealth => {
  const [health, setHealth] = useState<BackendHealth>({
    reachable: false,
    dataSource: "unknown",
    checked: false
  });

  useEffect(() => {
    if (!enabled) {
      setHealth({ reachable: false, dataSource: "unknown", checked: true });
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch("/api/health");
        const payload: unknown = await response.json();
        if (cancelled) return;

        if (!isHealthPayload(payload)) {
          setHealth({ reachable: true, dataSource: "unknown", checked: true });
          return;
        }

        setHealth({
          reachable: true,
          dataSource: payload.services.databricks ? "live" : "seed",
          checked: true
        });
      } catch {
        if (cancelled) return;
        setHealth({ reachable: false, dataSource: "unknown", checked: true });
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return health;
};

import { useCallback } from "react";
import { appController } from "../app/AppController";
import { fetchMockAgentResponse } from "../mocks/mockAgentResponse";
import type { AgentResponse, ApiErrorResponse } from "../types/contracts";

/** Mocks can be forced by env var or, handily mid-demo, by ?mock=1 in the URL. */
export const useMocks = (): boolean => {
  if (import.meta.env.VITE_USE_MOCKS === "true") return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mock") === "1";
};

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ApiErrorResponse).error === "string" &&
  typeof (value as ApiErrorResponse).code === "string";

/** Guards against a malformed 200 response, which would otherwise blank the UI. */
const isAgentResponse = (value: unknown): value is AgentResponse =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as AgentResponse).message === "string" &&
  Array.isArray((value as AgentResponse).results);

const postQuery = async (query: string): Promise<AgentResponse> => {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    throw {
      error: "The server sent a response the app could not read.",
      code: "INTERNAL_ERROR",
      retryable: true
    } satisfies ApiErrorResponse;
  }

  if (!response.ok) {
    if (isApiErrorResponse(payload)) throw payload;
    throw {
      error: `The server responded with status ${response.status}.`,
      code: "INTERNAL_ERROR",
      retryable: true
    } satisfies ApiErrorResponse;
  }

  if (!isAgentResponse(payload)) {
    throw {
      error: "The server sent results in an unexpected shape.",
      code: "INTERNAL_ERROR",
      retryable: false
    } satisfies ApiErrorResponse;
  }

  return payload;
};

export const useCampusAgent = () => {
  const mocked = useMocks();

  const submitQuery = useCallback(
    async (rawQuery: string): Promise<void> => {
      const query = rawQuery.trim();
      if (query.length === 0) {
        appController.showAgentError({
          error: "Enter a question before searching.",
          code: "INVALID_QUERY",
          retryable: false
        });
        return;
      }

      appController.startQuery();

      try {
        const response = mocked ? await fetchMockAgentResponse(query) : await postQuery(query);
        appController.showAgentResponse(response);
      } catch (error) {
        if (isApiErrorResponse(error)) {
          appController.showAgentError(error);
          return;
        }
        // fetch() rejects like this when the backend is not running at all.
        appController.showAgentError({
          error: "Could not reach the campus service. Check that the backend is running.",
          code: "NETWORK_ERROR",
          retryable: true
        });
      }
    },
    [mocked]
  );

  return { submitQuery, mocked };
};

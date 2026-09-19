export type ApiErrorCode =
  | "INVALID_QUERY"
  | "DATABRICKS_UNAVAILABLE"
  | "AGENT_FAILURE"
  | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  retryable: boolean;
}

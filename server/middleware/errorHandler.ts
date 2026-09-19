import { ErrorRequestHandler } from "express";
import { ApiErrorCode, ApiErrorResponse } from "../types/api";

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ApiError) {
    const payload: ApiErrorResponse = {
      error: error.message,
      code: error.code,
      retryable: error.retryable
    };
    response.status(error.statusCode).json(payload);
    return;
  }

  console.error(error);
  response.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    retryable: false
  } satisfies ApiErrorResponse);
};

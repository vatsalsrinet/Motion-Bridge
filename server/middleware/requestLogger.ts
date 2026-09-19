import { RequestHandler } from "express";

export const requestLogger: RequestHandler = (request, _response, next) => {
  console.info(`${request.method} ${request.path}`);
  next();
};

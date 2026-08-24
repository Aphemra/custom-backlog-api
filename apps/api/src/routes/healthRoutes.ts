import { Router } from "express";

export const healthRoutes = Router();

healthRoutes.get("/", (_request, response) => {
  response.json({
    ok: true,
    service: "trophy-backlog-api",
    version: 2,
  });
});

import { Router } from "express";
import { getPlatPricesIntegrationStatus } from "../features/platprices/platPricesConfig.js";

export const platPricesRoutes = Router();

platPricesRoutes.get("/status", (_request, response) => {
  response.json(getPlatPricesIntegrationStatus());
});

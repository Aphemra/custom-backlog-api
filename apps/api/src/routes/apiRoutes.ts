import { Router } from "express";
import { healthRoutes } from "./healthRoutes.js";
import { igdbRoutes } from "./igdbRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/igdb", igdbRoutes);

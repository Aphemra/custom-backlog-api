import { Router } from "express";
import { healthRoutes } from "./healthRoutes.js";
import { igdbRoutes } from "./igdbRoutes.js";
import { platPricesRoutes } from "./platPricesRoutes.js";
import { psnProfilesRoutes } from "./psnProfilesRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/igdb", igdbRoutes);
apiRoutes.use("/platprices", platPricesRoutes);
apiRoutes.use("/psnprofiles", psnProfilesRoutes);

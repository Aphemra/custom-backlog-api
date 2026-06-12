import cors from "cors";
import "dotenv/config";
import express from "express";
import { apiRoutes } from "./routes/apiRoutes.js";

const app = express();
const port = process.env.PORT ?? 3001;

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

app.use(express.json());

app.get("/", (_request, response) => {
  response.json({
    ok: true,
    service: "custom-backlog-api",
  });
});

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.use("/api", apiRoutes);

app.listen(port, () => {
  console.log(`Custom backlog API listening on port ${port}`);
});

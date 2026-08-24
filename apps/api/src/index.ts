import "dotenv/config";
import { createApp } from "./app.js";
import { runtimeConfig } from "./config/runtimeConfig.js";

const app = createApp();

app.listen(runtimeConfig.port, runtimeConfig.host, () => {
  console.log(
    `Trophy Backlog API listening at http://${runtimeConfig.host}:${runtimeConfig.port}`,
  );
});

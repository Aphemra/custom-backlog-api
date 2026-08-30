import "dotenv/config";
import { createApp } from "./app.js";
import { runtimeConfig } from "./config/runtimeConfig.js";
import { closeDatabase, getDatabase } from "./database/database.js";

const database = getDatabase();
const app = createApp(database);

const server = app.listen(runtimeConfig.port, runtimeConfig.host, () => {
  console.log(
    `Trophy Backlog listening at http://${runtimeConfig.host}:${runtimeConfig.port}`,
  );
  console.log(`Trophy Backlog data directory: ${runtimeConfig.dataDirectory}`);
});

let isShuttingDown = false;

function shutDown(signal: NodeJS.Signals): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`Received ${signal}; closing the local database.`);

  server.close((error) => {
    closeDatabase();

    if (error !== undefined) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);

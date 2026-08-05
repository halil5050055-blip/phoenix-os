import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "./http/app.js";
import { createDatabase } from "./shared/database.js";
import { bootstrapInitialAdmin } from "./modules/users/bootstrap.js";
import { loadBackendConfig } from "./config.js";

const config = loadBackendConfig(process.env);
mkdirSync(dirname(config.databasePath), { recursive: true, mode: 0o700 });
if (config.nodeEnv !== "production" && process.env.DATABASE_PATH === undefined) chmodSync(dirname(config.databasePath), 0o700);
const database = createDatabase(config.databasePath);
await bootstrapInitialAdmin(database, config.initialAdmin);

const server = createApp(database, { jwtSecret: config.jwtSecret, secureCookies: config.nodeEnv === "production" }).listen(config.port, config.host, () => {
  console.log(`Phoenix BOS API listening on ${config.host}:${config.port}`);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Phoenix BOS received ${signal}; shutting down`);
  const forceExit = setTimeout(() => {
    console.error("Phoenix BOS shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceExit.unref();
  server.close(() => {
    clearTimeout(forceExit);
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

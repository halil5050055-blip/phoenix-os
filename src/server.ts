import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createApp } from "./http/app.js";
import { createDatabase } from "./shared/database.js";

const usesDefaultDatabasePath = process.env.DATABASE_PATH === undefined;
const databasePath = resolve(process.env.DATABASE_PATH ?? "data/phoenix-bos.sqlite");
mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
if (usesDefaultDatabasePath) chmodSync(dirname(databasePath), 0o700);
const database = createDatabase(databasePath);
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST?.trim() || "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be an integer between 1 and 65535");

const server = createApp(database).listen(port, host, () => {
  console.log(`Phoenix BOS API listening on http://${host}:${port}`);
});

function shutdown(): void {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

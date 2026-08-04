import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createApp } from "./http/app.js";
import { createDatabase } from "./shared/database.js";
import { bootstrapInitialAdmin } from "./modules/users/bootstrap.js";

const usesDefaultDatabasePath = process.env.DATABASE_PATH === undefined;
const databasePath = resolve(process.env.DATABASE_PATH ?? "data/phoenix-bos.sqlite");
mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
if (usesDefaultDatabasePath) chmodSync(dirname(databasePath), 0o700);
const database = createDatabase(databasePath);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET is required");
await bootstrapInitialAdmin(database, {
  ...(process.env.INITIAL_ADMIN_EMAIL ? { email: process.env.INITIAL_ADMIN_EMAIL } : {}),
  ...(process.env.INITIAL_ADMIN_PASSWORD ? { password: process.env.INITIAL_ADMIN_PASSWORD } : {}),
  ...(process.env.INITIAL_ADMIN_NAME ? { displayName: process.env.INITIAL_ADMIN_NAME } : {}),
});
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST?.trim() || "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be an integer between 1 and 65535");

const server = createApp(database, { jwtSecret }).listen(port, host, () => {
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

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createApp } from "./http/app.js";
import { createDatabase } from "./shared/database.js";

const databasePath = resolve(process.env.DATABASE_PATH ?? "data/phoenix-bos.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
const database = createDatabase(databasePath);
const port = Number(process.env.PORT ?? 3000);

const server = createApp(database).listen(port, () => {
  console.log(`Phoenix BOS API listening on http://localhost:${port}`);
});

function shutdown(): void {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

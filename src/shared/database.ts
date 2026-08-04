import { chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Database = DatabaseSync;

export function createDatabase(filename: string, migrationsDirectory = join(process.cwd(), "migrations")): Database {
  const database = new DatabaseSync(filename);
  if (filename !== ":memory:") chmodSync(filename, 0o600);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");

  let version = (database.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
  for (const migration of ["001_initial.sql", "002_hardening.sql"]) {
    const targetVersion = Number.parseInt(migration.slice(0, 3), 10);
    if (version < targetVersion) {
      database.exec(readFileSync(join(migrationsDirectory, migration), "utf8"));
      version = targetVersion;
    }
  }

  return database;
}

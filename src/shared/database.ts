import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Database = DatabaseSync;

export function createDatabase(filename: string, migrationsDirectory = join(process.cwd(), "migrations")): Database {
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");

  const version = database.prepare("PRAGMA user_version").get() as { user_version: number };
  if (version.user_version < 1) {
    database.exec(readFileSync(join(migrationsDirectory, "001_initial.sql"), "utf8"));
  }

  return database;
}

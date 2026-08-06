import { DatabaseSync } from "node:sqlite";
import type { ProviderExecutionRecord, RunnerTask, ValidationRunRecord } from "./model.js";

export class TaskStore {
  private readonly database: DatabaseSync;

  constructor(filename: string) {
    this.database = new DatabaseSync(filename);
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS runner_tasks (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        state_version INTEGER NOT NULL,
        task_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS validation_runs (
        run_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES runner_tasks(id),
        validation_id TEXT NOT NULL,
        run_json TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS validation_runs_task_idx ON validation_runs(task_id, started_at, run_id);
      CREATE TABLE IF NOT EXISTS provider_runs (
        run_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES runner_tasks(id),
        phase TEXT NOT NULL,
        provider TEXT NOT NULL,
        run_json TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS provider_runs_task_idx ON provider_runs(task_id, started_at, run_id);
    `);
  }

  save(task: RunnerTask, expectedVersion?: number): void {
    if (expectedVersion === undefined) {
      this.database.prepare(`
        INSERT INTO runner_tasks (id, state, state_version, task_json, updated_at) VALUES (?, ?, ?, ?, ?)
      `).run(task.id, task.state, task.stateVersion, JSON.stringify(task), task.updatedAt);
      return;
    }
    const result = this.database.prepare(`
      UPDATE runner_tasks SET state = ?, state_version = ?, task_json = ?, updated_at = ?
      WHERE id = ? AND state_version = ?
    `).run(task.state, task.stateVersion, JSON.stringify(task), task.updatedAt, task.id, expectedVersion);
    if (result.changes !== 1) throw new Error("Stale task state");
  }

  get(id: string): RunnerTask {
    const row = this.database.prepare("SELECT task_json FROM runner_tasks WHERE id = ?").get(id) as { task_json: string } | undefined;
    if (!row) throw new Error(`Task ${id} was not found`);
    return JSON.parse(row.task_json) as RunnerTask;
  }

  appendValidationRun(run: ValidationRunRecord): void {
    this.database.prepare(`
      INSERT INTO validation_runs (run_id, task_id, validation_id, run_json, started_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(run.runId, run.taskId, run.validationId, JSON.stringify(run), run.startedAt, run.finishedAt);
  }

  listValidationRuns(taskId: string): ValidationRunRecord[] {
    const rows = this.database.prepare(`
      SELECT run_json FROM validation_runs WHERE task_id = ? ORDER BY started_at, run_id
    `).all(taskId) as Array<{ run_json: string }>;
    return rows.map((row) => JSON.parse(row.run_json) as ValidationRunRecord);
  }

  appendProviderRun(run: ProviderExecutionRecord): void {
    this.database.prepare(`
      INSERT INTO provider_runs (run_id, task_id, phase, provider, run_json, started_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(run.runId, run.taskId, run.phase, run.provider, JSON.stringify(run), run.startedAt, run.finishedAt);
  }

  listProviderRuns(taskId: string): ProviderExecutionRecord[] {
    const rows = this.database.prepare(`
      SELECT run_json FROM provider_runs WHERE task_id = ? ORDER BY started_at, run_id
    `).all(taskId) as Array<{ run_json: string }>;
    return rows.map((row) => JSON.parse(row.run_json) as ProviderExecutionRecord);
  }

  close(): void {
    this.database.close();
  }
}

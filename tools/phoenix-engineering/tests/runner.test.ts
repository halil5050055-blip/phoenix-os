import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AcceptanceResult, ExecutionResult, MilestoneContract, RepositorySnapshot, ValidationResult } from "../src/model.js";
import { Runner } from "../src/runner.js";
import { TaskStore } from "../src/store.js";

const stores: TaskStore[] = [];
const success: ExecutionResult = { provider: "test", exitCode: 0, stdout: "", stderr: "", timedOut: false, cancelled: false };

function contract(): MilestoneContract {
  return {
    version: 1,
    objective: "Implement bounded Runner Core",
    scope: ["Runner only"],
    allowedChanges: [{ pattern: "tools/phoenix-engineering/**" }],
    forbiddenChanges: [{ pattern: ".git/**" }, { pattern: "src/**" }],
    invariants: ["Provider cannot set state"],
    acceptanceCriteria: [{ id: "core", description: "Core gates pass", mandatory: true }],
    requiredTests: ["runner-core-tests"],
    verificationCommands: ["npx vitest run tools/phoenix-engineering/tests"],
    risks: ["Local-only persistence"],
  };
}

function snapshot(files: Record<string, string> = {}, marker = "same"): RepositorySnapshot {
  return { head: "head", status: "", stagedDiff: "", files, fingerprint: marker };
}

function setup(options: { maxRetries?: number; maxReworks?: number } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "phoenix-runner-test-"));
  const store = new TaskStore(join(directory, "runner.sqlite"));
  stores.push(store);
  const runner = new Runner(store, () => new Date("2026-08-06T00:00:00.000Z"));
  const task = runner.createTask({ ownerRequest: "Build Runner Core", repositoryRoot: "/repo", contract: contract(), ...options });
  return { runner, store, task };
}

function reachBuild(runner: Runner, id: string) {
  runner.beginSpec(id);
  runner.finishSpec(id, snapshot(), snapshot(), success);
  const task = runner.get(id);
  return runner.approve(id, task.contractHash);
}

function reachReview(runner: Runner, id: string) {
  reachBuild(runner, id);
  runner.finishBuild(id, snapshot({}, "before"), snapshot({ "tools/phoenix-engineering/src/new.ts": "hash" }, "after"), success);
  return runner.recordValidation(id, [{ id: "runner-core-tests", mandatory: true, status: "PASS", exitCode: 0 }]);
}

afterEach(() => {
  while (stores.length) stores.pop()!.close();
});

describe("deterministic Runner Core", () => {
  it("follows the valid workflow and completes only after every deterministic gate", () => {
    const { runner, task } = setup();
    expect(runner.beginSpec(task.id).state).toBe("SPEC");
    expect(runner.finishSpec(task.id, snapshot(), snapshot(), success).state).toBe("WAITING_APPROVAL");
    expect(runner.approve(task.id, runner.get(task.id).contractHash).state).toBe("BUILD");
    expect(runner.finishBuild(task.id, snapshot({}, "before"), snapshot({ "tools/phoenix-engineering/src/core.ts": "1" }, "after"), success).state).toBe("VALIDATE");
    const validations: ValidationResult[] = [{ id: "runner-core-tests", mandatory: true, status: "PASS", exitCode: 0 }];
    expect(runner.recordValidation(task.id, validations).state).toBe("REVIEW");
    const acceptance: AcceptanceResult[] = [{ criterionId: "core", status: "PASS", evidence: "tests passed" }];
    const completed = runner.finishReview(task.id, acceptance, success);
    expect(completed.state).toBe("COMPLETED");
    expect(completed.completionReport).toMatchObject({ taskId: task.id, objective: "Implement bounded Runner Core" });
  });

  it("rejects invalid transitions and requires matching approval", () => {
    const { runner, task } = setup();
    expect(() => runner.approve(task.id, task.contractHash)).toThrow("Invalid transition");
    runner.beginSpec(task.id);
    runner.finishSpec(task.id, snapshot(), snapshot(), success);
    expect(() => runner.approve(task.id, "wrong")).toThrow("Approval does not match");
    expect(runner.get(task.id).state).toBe("WAITING_APPROVAL");
  });

  it("blocks SPEC when repository state changes", () => {
    const { runner, task } = setup();
    runner.beginSpec(task.id);
    expect(runner.finishSpec(task.id, snapshot({}, "before"), snapshot({ "README.md": "changed" }, "after"), success).state).toBe("BLOCKED");
  });

  it("sends an out-of-scope BUILD to REWORK and a forbidden change to BLOCKED", () => {
    const first = setup();
    reachBuild(first.runner, first.task.id);
    expect(first.runner.finishBuild(first.task.id, snapshot({}, "before"), snapshot({ "README.md": "1" }, "after"), success).state).toBe("REWORK");

    const second = setup();
    reachBuild(second.runner, second.task.id);
    expect(second.runner.finishBuild(second.task.id, snapshot({}, "before"), snapshot({ "src/server.ts": "1" }, "after"), success).state).toBe("BLOCKED");
  });

  it("blocks BUILD when Git authority changes", () => {
    const { runner, task } = setup();
    reachBuild(runner, task.id);
    const before = snapshot({}, "before");
    const after = { ...snapshot({}, "after"), stagedDiff: "staged mutation" };
    expect(runner.finishBuild(task.id, before, after, success).state).toBe("BLOCKED");
  });

  it("moves passing validation to REVIEW and failing validation to REWORK", () => {
    const passing = setup();
    reachBuild(passing.runner, passing.task.id);
    passing.runner.finishBuild(passing.task.id, snapshot({}, "a"), snapshot({ "tools/phoenix-engineering/a.ts": "1" }, "b"), success);
    expect(passing.runner.recordValidation(passing.task.id, [{ id: "runner-core-tests", mandatory: true, status: "PASS" }]).state).toBe("REVIEW");

    const failing = setup();
    reachBuild(failing.runner, failing.task.id);
    failing.runner.finishBuild(failing.task.id, snapshot({}, "a"), snapshot({ "tools/phoenix-engineering/a.ts": "1" }, "b"), success);
    expect(failing.runner.recordValidation(failing.task.id, [{ id: "runner-core-tests", mandatory: true, status: "FAIL", exitCode: 1 }]).state).toBe("REWORK");
  });

  it("blocks when mandatory validation is unavailable", () => {
    const { runner, task } = setup();
    reachBuild(runner, task.id);
    runner.finishBuild(task.id, snapshot({}, "a"), snapshot({ "tools/phoenix-engineering/a.ts": "1" }, "b"), success);
    const blocked = runner.recordValidation(task.id, [{ id: "runner-core-tests", mandatory: true, status: "UNAVAILABLE" }]);
    expect(blocked.state).toBe("BLOCKED");
    expect(blocked.environmentLimitations).toHaveLength(1);
  });

  it("does not complete when an Acceptance Criterion fails", () => {
    const { runner, task } = setup();
    reachReview(runner, task.id);
    expect(runner.finishReview(task.id, [{ criterionId: "core", status: "FAIL", evidence: "missing" }], success).state).toBe("REWORK");
  });

  it("blocks on exhausted retry and rework budgets", () => {
    const retry = setup({ maxRetries: 0 });
    retry.runner.beginSpec(retry.task.id);
    expect(retry.runner.retry(retry.task.id).state).toBe("BLOCKED");

    const rework = setup({ maxReworks: 0 });
    reachReview(rework.runner, rework.task.id);
    expect(rework.runner.finishReview(rework.task.id, [], success).state).toBe("BLOCKED");
  });

  it("treats timeout and cancellation as non-success and supports owner stop", () => {
    const timed = setup();
    timed.runner.beginSpec(timed.task.id);
    expect(timed.runner.finishSpec(timed.task.id, snapshot(), snapshot(), { ...success, exitCode: null, timedOut: true }).state).toBe("BLOCKED");

    const cancelled = setup();
    expect(cancelled.runner.stop(cancelled.task.id).state).toBe("BLOCKED");
    expect(() => cancelled.runner.stop(cancelled.task.id)).toThrow("Cannot stop");
  });

  it("round-trips authoritative task state through SQLite", () => {
    const { runner, store, task } = setup();
    runner.beginSpec(task.id);
    const reloaded = new Runner(store).get(task.id);
    expect(reloaded).toMatchObject({ id: task.id, ownerRequest: "Build Runner Core", state: "SPEC", stateVersion: 1 });
    expect(reloaded.contractHash).toHaveLength(64);
  });
});

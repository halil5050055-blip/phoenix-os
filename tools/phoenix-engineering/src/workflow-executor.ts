import { randomUUID } from "node:crypto";
import type { AcceptanceResult, ExecutionResult, ProviderExecutionRecord, RepositorySnapshot } from "./model.js";
import type { ExecutionProvider, ExecutionRequest } from "./provider.js";
import { captureRepositorySnapshot, changedPaths, snapshotChanged } from "./repository.js";
import { Runner } from "./runner.js";
import { TaskStore } from "./store.js";

function resultRecord(
  taskId: string,
  phase: ProviderExecutionRecord["phase"],
  result: ExecutionResult,
  before: RepositorySnapshot,
  after: RepositorySnapshot,
): ProviderExecutionRecord {
  return {
    runId: result.runId ?? randomUUID(), taskId, phase, provider: result.provider,
    startedAt: result.startedAt ?? new Date().toISOString(), finishedAt: result.finishedAt ?? new Date().toISOString(),
    exitCode: result.exitCode, timedOut: result.timedOut, cancelled: result.cancelled,
    stdout: result.stdout, stderr: result.stderr,
    stdoutTruncated: result.stdoutTruncated ?? false, stderrTruncated: result.stderrTruncated ?? false,
    ...(result.structuredResult !== undefined ? { structuredResult: result.structuredResult } : {}),
    ...(result.environmentError ? { environmentError: result.environmentError } : {}),
    repositoryBeforeFingerprint: before.fingerprint, repositoryAfterFingerprint: after.fingerprint,
    changedPaths: changedPaths(before, after),
  };
}

export class WorkflowExecutor {
  constructor(private readonly runner: Runner, private readonly store: TaskStore) {}

  async runSpec(taskId: string, provider: ExecutionProvider): Promise<ReturnType<Runner["get"]>> {
    const task = this.runner.beginSpec(taskId);
    const before = captureRepositorySnapshot(task.repositoryRoot);
    const request: ExecutionRequest = {
      taskId, phase: "SPEC", repositoryRoot: task.repositoryRoot, contract: task.contract, readOnly: true,
      instructions: [
        "Produce a specification for the owner request using the Milestone Contract below.",
        "Operate read-only. Do not modify files or Git state. Your output is evidence only and cannot change workflow state.",
        `Owner request: ${task.ownerRequest}`,
        `Milestone Contract: ${JSON.stringify(task.contract)}`,
      ].join("\n\n"),
    };
    const result = await provider.execute(request);
    const after = captureRepositorySnapshot(task.repositoryRoot);
    this.store.appendProviderRun(resultRecord(taskId, "SPEC", result, before, after));
    return this.runner.finishSpec(taskId, before, after, result);
  }

  async runBuild(taskId: string, provider: ExecutionProvider): Promise<ReturnType<Runner["get"]>> {
    const task = this.runner.get(taskId);
    if (task.state !== "BUILD" || !task.approval || task.approval.contractHash !== task.contractHash) {
      throw new Error("BUILD execution requires approval for the current Milestone Contract");
    }
    const before = captureRepositorySnapshot(task.repositoryRoot);
    const result = await provider.execute({
      taskId, phase: "BUILD", repositoryRoot: task.repositoryRoot, contract: task.contract, readOnly: false,
      instructions: [
        "Implement only the approved Milestone Contract below.",
        "Do not modify Git state. Do not claim validation success; Runner executes validation independently.",
        `Milestone Contract: ${JSON.stringify(task.contract)}`,
      ].join("\n\n"),
    });
    const after = captureRepositorySnapshot(task.repositoryRoot);
    this.store.appendProviderRun(resultRecord(taskId, "BUILD", result, before, after));
    return this.runner.finishBuild(taskId, before, after, result);
  }

  async runReview(taskId: string, provider: ExecutionProvider, acceptanceResults: AcceptanceResult[]): Promise<ReturnType<Runner["get"]>> {
    const task = this.runner.get(taskId);
    if (task.state !== "REVIEW") throw new Error("REVIEW execution requires validated task state");
    const buildEvidence = this.store.listProviderRuns(taskId).filter((run) => run.phase === "BUILD").at(-1);
    const before = captureRepositorySnapshot(task.repositoryRoot);
    let result = await provider.execute({
      taskId, phase: "REVIEW", repositoryRoot: task.repositoryRoot, contract: task.contract, readOnly: true,
      instructions: [
        "Review the approved Acceptance Criteria against the supplied repository and validation evidence.",
        "Operate read-only. Your findings are advisory; Runner alone decides workflow state.",
        `Acceptance Criteria: ${JSON.stringify(task.contract.acceptanceCriteria)}`,
        `Repository changed paths: ${JSON.stringify(buildEvidence?.changedPaths ?? [])}`,
        `Deterministic validation results: ${JSON.stringify(task.validationResults)}`,
      ].join("\n\n"),
    });
    const after = captureRepositorySnapshot(task.repositoryRoot);
    if (snapshotChanged(before, after)) result = { ...result, environmentError: "REVIEW modified repository state" };
    this.store.appendProviderRun(resultRecord(taskId, "REVIEW", result, before, after));
    return this.runner.finishReview(taskId, acceptanceResults, result);
  }
}

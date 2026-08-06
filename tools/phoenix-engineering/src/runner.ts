import { createHash, randomUUID } from "node:crypto";
import type {
  AcceptanceResult, CompletionReport, EnvironmentLimitation, ExecutionResult, MilestoneContract,
  RepositorySnapshot, RunnerTask, ValidationCommand, ValidationResult, WorkflowState,
} from "./model.js";
import { changedPaths, evaluateBuildScope, snapshotChanged } from "./repository.js";
import { TaskStore } from "./store.js";
import { ValidationExecutor } from "./validation-executor.js";

const TERMINAL: ReadonlySet<WorkflowState> = new Set(["COMPLETED", "BLOCKED"]);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function contractHash(contract: MilestoneContract): string {
  return createHash("sha256").update(canonical(contract)).digest("hex");
}

function executionSucceeded(result: ExecutionResult): boolean {
  return result.exitCode === 0 && !result.timedOut && !result.cancelled && !result.environmentError;
}

export class Runner {
  constructor(private readonly store: TaskStore, private readonly now: () => Date = () => new Date()) {}

  createTask(input: { ownerRequest: string; repositoryRoot: string; contract: MilestoneContract; maxRetries?: number; maxReworks?: number }): RunnerTask {
    if (!input.ownerRequest.trim() || !input.contract.objective.trim()) throw new Error("Task request and objective are required");
    const timestamp = this.now().toISOString();
    const task: RunnerTask = {
      id: randomUUID(), ownerRequest: input.ownerRequest, repositoryRoot: input.repositoryRoot,
      state: "TASK", stateVersion: 0, contract: input.contract, contractHash: contractHash(input.contract), approval: null,
      retryCount: 0, reworkCount: 0, maxRetries: input.maxRetries ?? 1, maxReworks: input.maxReworks ?? 2,
      validationResults: [], acceptanceResults: [], environmentLimitations: [], completionReport: null,
      createdAt: timestamp, updatedAt: timestamp,
    };
    this.store.save(task);
    return task;
  }

  get(id: string): RunnerTask { return this.store.get(id); }

  beginSpec(id: string): RunnerTask { return this.transition(id, ["TASK"], "SPEC"); }

  finishSpec(id: string, before: RepositorySnapshot, after: RepositorySnapshot, result: ExecutionResult): RunnerTask {
    const task = this.requireState(id, ["SPEC"]);
    if (snapshotChanged(before, after)) return this.setState(task, "BLOCKED");
    if (!executionSucceeded(result)) return this.setState(task, "BLOCKED", this.limitation("SPEC", result));
    return this.setState(task, "WAITING_APPROVAL");
  }

  approve(id: string, approvedContractHash: string): RunnerTask {
    const task = this.requireState(id, ["WAITING_APPROVAL"]);
    if (approvedContractHash !== task.contractHash) throw new Error("Approval does not match the current Milestone Contract");
    task.approval = { contractHash: approvedContractHash, approvedAt: this.now().toISOString() };
    return this.setState(task, "BUILD");
  }

  continueRework(id: string): RunnerTask { return this.transition(id, ["REWORK"], "BUILD"); }

  retry(id: string): RunnerTask {
    const task = this.requireState(id, ["SPEC", "BUILD", "REVIEW"]);
    if (task.retryCount >= task.maxRetries) return this.setState(task, "BLOCKED");
    task.retryCount += 1;
    return this.setState(task, task.state);
  }

  finishBuild(id: string, before: RepositorySnapshot, after: RepositorySnapshot, result: ExecutionResult): RunnerTask {
    const task = this.requireState(id, ["BUILD"]);
    if (!task.approval || task.approval.contractHash !== task.contractHash) throw new Error("BUILD requires approval for the current contract");
    if (!executionSucceeded(result)) return this.reworkOrBlock(task, this.limitation("BUILD", result));
    if (before.head !== after.head || before.stagedDiff !== after.stagedDiff) return this.setState(task, "BLOCKED");
    const scope = evaluateBuildScope(task.contract, changedPaths(before, after));
    if (scope.forbidden.length) return this.setState(task, "BLOCKED");
    if (!scope.valid) return this.reworkOrBlock(task);
    return this.setState(task, "VALIDATE");
  }

  recordValidation(id: string, results: ValidationResult[]): RunnerTask {
    const task = this.requireState(id, ["VALIDATE"]);
    task.validationResults = structuredClone(results);
    const unavailable = results.find((item) => item.mandatory && item.status === "UNAVAILABLE");
    if (unavailable) {
      const limitation: EnvironmentLimitation = { phase: "VALIDATE", description: `${unavailable.id} was unavailable`, observedAt: this.now().toISOString() };
      return this.setState(task, "BLOCKED", limitation);
    }
    if (results.some((item) => item.mandatory && item.status !== "PASS")) return this.reworkOrBlock(task);
    if (!results.length || task.contract.requiredTests.some((id) => !results.some((item) => item.id === id && item.status === "PASS"))) {
      return this.reworkOrBlock(task);
    }
    return this.setState(task, "REVIEW");
  }

  async executeValidations(id: string, commands: ValidationCommand[], executor: ValidationExecutor): Promise<RunnerTask> {
    this.requireState(id, ["VALIDATE"]);
    const results: ValidationResult[] = [];
    for (const command of commands) {
      const run = await executor.execute(id, command);
      results.push({
        id: run.validationId, mandatory: run.mandatory, status: run.status,
        command: [run.executable, ...run.args].join(" "), stdout: run.stdout, stderr: run.stderr,
        ...(run.exitCode !== null ? { exitCode: run.exitCode } : {}),
      });
    }
    return this.recordValidation(id, results);
  }

  finishReview(id: string, results: AcceptanceResult[], providerResult: ExecutionResult): RunnerTask {
    const task = this.requireState(id, ["REVIEW"]);
    task.acceptanceResults = structuredClone(results);
    if (!executionSucceeded(providerResult)) return this.reworkOrBlock(task, this.limitation("REVIEW", providerResult));
    const mandatory = task.contract.acceptanceCriteria.filter((criterion) => criterion.mandatory);
    if (mandatory.some((criterion) => !results.some((result) => result.criterionId === criterion.id && result.status === "PASS"))) {
      return this.reworkOrBlock(task);
    }
    const completedAt = this.now().toISOString();
    task.completionReport = {
      taskId: task.id, objective: task.contract.objective, completedAt,
      validationResults: structuredClone(task.validationResults), acceptanceResults: structuredClone(results),
      reworkCount: task.reworkCount, retryCount: task.retryCount,
    } satisfies CompletionReport;
    return this.setState(task, "COMPLETED");
  }

  stop(id: string): RunnerTask {
    const task = this.store.get(id);
    if (TERMINAL.has(task.state)) throw new Error(`Cannot stop a task in ${task.state}`);
    return this.setState(task, "BLOCKED");
  }

  private transition(id: string, from: WorkflowState[], to: WorkflowState): RunnerTask {
    return this.setState(this.requireState(id, from), to);
  }

  private requireState(id: string, states: WorkflowState[]): RunnerTask {
    const task = this.store.get(id);
    if (!states.includes(task.state)) throw new Error(`Invalid transition from ${task.state}`);
    return task;
  }

  private reworkOrBlock(task: RunnerTask, limitation?: EnvironmentLimitation): RunnerTask {
    if (limitation) return this.setState(task, "BLOCKED", limitation);
    if (task.reworkCount >= task.maxReworks) return this.setState(task, "BLOCKED", limitation);
    task.reworkCount += 1;
    return this.setState(task, "REWORK", limitation);
  }

  private limitation(phase: EnvironmentLimitation["phase"], result: ExecutionResult): EnvironmentLimitation | undefined {
    const description = result.environmentError ?? (result.timedOut ? "Execution timed out" : result.cancelled ? "Execution was cancelled" : undefined);
    return description ? { phase, description, observedAt: this.now().toISOString() } : undefined;
  }

  private setState(task: RunnerTask, state: WorkflowState, limitation?: EnvironmentLimitation): RunnerTask {
    const previousVersion = task.stateVersion;
    task.state = state;
    task.stateVersion += 1;
    task.updatedAt = this.now().toISOString();
    if (limitation) task.environmentLimitations.push(limitation);
    this.store.save(task, previousVersion);
    return task;
  }
}

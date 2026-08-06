import type { ExecutionResult, MilestoneContract } from "./model.js";

export interface ExecutionRequest {
  taskId: string;
  phase: "SPEC" | "BUILD" | "REVIEW";
  repositoryRoot: string;
  contract: MilestoneContract;
  instructions: string;
  readOnly: boolean;
}

export interface ExecutionProvider {
  readonly name: string;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  cancel(taskId: string): Promise<void>;
}

export class ManualProvider implements ExecutionProvider {
  readonly name = "manual";

  constructor(private readonly result: ExecutionResult) {}

  async execute(_request: ExecutionRequest): Promise<ExecutionResult> {
    return { ...this.result, provider: this.name };
  }

  async cancel(_taskId: string): Promise<void> {}
}

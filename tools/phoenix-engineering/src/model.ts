export const WORKFLOW_STATES = [
  "TASK", "SPEC", "WAITING_APPROVAL", "BUILD", "VALIDATE", "REVIEW", "COMPLETED", "REWORK", "BLOCKED",
] as const;

export type WorkflowState = typeof WORKFLOW_STATES[number];
export type EvidenceStatus = "PASS" | "FAIL" | "UNAVAILABLE";

export interface PathRule {
  pattern: string;
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  mandatory: boolean;
}

export interface MilestoneContract {
  version: 1;
  objective: string;
  scope: string[];
  allowedChanges: PathRule[];
  forbiddenChanges: PathRule[];
  invariants: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  requiredTests: string[];
  verificationCommands: string[];
  risks: string[];
}

export interface ValidationResult {
  id: string;
  mandatory: boolean;
  status: EvidenceStatus;
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export interface ValidationCommand {
  id: string;
  executable: string;
  args: string[];
  cwd?: string;
  mandatory: boolean;
  timeoutMs: number;
  maxOutputBytes?: number;
}

export interface ValidationRunRecord {
  runId: string;
  taskId: string;
  validationId: string;
  executable: string;
  args: string[];
  cwd: string;
  mandatory: boolean;
  status: EvidenceStatus;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  timedOut: boolean;
  cancelled: boolean;
  unavailableReason?: string;
}

export interface AcceptanceResult {
  criterionId: string;
  status: EvidenceStatus;
  evidence: string;
}

export interface EnvironmentLimitation {
  phase: "SPEC" | "BUILD" | "VALIDATE" | "REVIEW";
  description: string;
  observedAt: string;
}

export interface ExecutionResult {
  provider: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  environmentError?: string;
  runId?: string;
  startedAt?: string;
  finishedAt?: string;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
  structuredResult?: unknown;
}

export interface ProviderExecutionRecord {
  runId: string;
  taskId: string;
  phase: "SPEC" | "BUILD" | "REVIEW";
  provider: string;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  timedOut: boolean;
  cancelled: boolean;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  structuredResult?: unknown;
  environmentError?: string;
  repositoryBeforeFingerprint: string;
  repositoryAfterFingerprint: string;
  changedPaths: string[];
}

export interface RepositorySnapshot {
  head: string;
  status: string;
  stagedDiff: string;
  files: Record<string, string>;
  fingerprint: string;
}

export interface Approval {
  contractHash: string;
  approvedAt: string;
}

export interface CompletionReport {
  taskId: string;
  objective: string;
  completedAt: string;
  validationResults: ValidationResult[];
  acceptanceResults: AcceptanceResult[];
  reworkCount: number;
  retryCount: number;
}

export interface RunnerTask {
  id: string;
  ownerRequest: string;
  repositoryRoot: string;
  state: WorkflowState;
  stateVersion: number;
  contract: MilestoneContract;
  contractHash: string;
  approval: Approval | null;
  retryCount: number;
  reworkCount: number;
  maxRetries: number;
  maxReworks: number;
  validationResults: ValidationResult[];
  acceptanceResults: AcceptanceResult[];
  environmentLimitations: EnvironmentLimitation[];
  completionReport: CompletionReport | null;
  createdAt: string;
  updatedAt: string;
}

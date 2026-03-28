import type { ExecutionWorkspace, Issue, IssueWorkProduct, Project } from "@paperclipai/shared";

export interface ExecutionWorkspaceGitStatusSummary {
  dirty: boolean;
  modifiedCount: number | null;
  untrackedCount: number | null;
  label: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readNestedValue(record: Record<string, unknown> | null, path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    const currentRecord = asRecord(current);
    if (!currentRecord) return undefined;
    current = currentRecord[key];
  }
  return current;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "dirty"].includes(normalized)) return true;
  if (["0", "false", "no", "clean"].includes(normalized)) return false;
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstBoolean(record: Record<string, unknown> | null, paths: string[][]): boolean | null {
  for (const path of paths) {
    const value = readBoolean(readNestedValue(record, path));
    if (value !== null) return value;
  }
  return null;
}

function firstNumber(record: Record<string, unknown> | null, paths: string[][]): number | null {
  for (const path of paths) {
    const value = readNumber(readNestedValue(record, path));
    if (value !== null) return value;
  }
  return null;
}

function formatGitStatusLabel(
  dirty: boolean,
  modifiedCount: number | null,
  untrackedCount: number | null,
): string {
  if (modifiedCount === null && untrackedCount === null) {
    return dirty ? "Dirty" : "Clean";
  }

  const parts: string[] = [];
  if (modifiedCount !== null) {
    parts.push(`${modifiedCount} modified`);
  }
  if (untrackedCount !== null) {
    parts.push(`${untrackedCount} untracked`);
  }
  if (parts.length === 0) {
    return dirty ? "Dirty" : "Clean";
  }
  return parts.join(", ");
}

export function readExecutionWorkspaceGitStatus(
  workspace: Pick<ExecutionWorkspace, "metadata"> | null | undefined,
): ExecutionWorkspaceGitStatusSummary | null {
  const metadata = asRecord(workspace?.metadata);
  if (!metadata) return null;

  const dirty = firstBoolean(metadata, [
    ["dirty"],
    ["gitDirty"],
    ["git", "dirty"],
    ["gitStatus", "dirty"],
    ["workingTree", "dirty"],
  ]);
  const modifiedCount = firstNumber(metadata, [
    ["modifiedCount"],
    ["git", "modifiedCount"],
    ["gitStatus", "modifiedCount"],
    ["workingTree", "modifiedCount"],
  ]);
  const untrackedCount = firstNumber(metadata, [
    ["untrackedCount"],
    ["git", "untrackedCount"],
    ["gitStatus", "untrackedCount"],
    ["workingTree", "untrackedCount"],
  ]);

  if (dirty === null && modifiedCount === null && untrackedCount === null) return null;

  const normalizedDirty = dirty ?? ((modifiedCount ?? 0) > 0 || (untrackedCount ?? 0) > 0);
  return {
    dirty: normalizedDirty,
    modifiedCount,
    untrackedCount,
    label: formatGitStatusLabel(normalizedDirty, modifiedCount, untrackedCount),
  };
}

export function formatExecutionWorkspaceModeLabel(mode: string | null | undefined): string {
  switch (mode) {
    case "isolated_workspace":
      return "Isolated workspace";
    case "operator_branch":
      return "Operator branch";
    case "reuse_existing":
      return "Reuse existing workspace";
    case "agent_default":
      return "Agent default";
    case "cloud_sandbox":
      return "Cloud sandbox";
    case "adapter_managed":
      return "Adapter managed";
    case "adapter_default":
      return "Adapter default";
    case "inherit":
      return "Project default";
    default:
      return "Shared workspace";
  }
}

export function formatExecutionWorkspaceStrategyLabel(type: string | null | undefined): string {
  switch (type) {
    case "git_worktree":
      return "Git worktree";
    case "adapter_managed":
      return "Adapter managed";
    case "cloud_sandbox":
      return "Cloud sandbox";
    default:
      return "Project primary workspace";
  }
}

function resolveIssueWorkspaceMode(
  issue: Pick<Issue, "currentExecutionWorkspace" | "executionWorkspacePreference" | "executionWorkspaceSettings">,
  project?: Pick<Project, "executionWorkspacePolicy"> | null,
): string {
  return (
    issue.currentExecutionWorkspace?.mode
    ?? issue.executionWorkspaceSettings?.mode
    ?? issue.executionWorkspacePreference
    ?? project?.executionWorkspacePolicy?.defaultMode
    ?? "shared_workspace"
  );
}

export function describeIssueCheckoutPlan(
  issue: Pick<Issue, "currentExecutionWorkspace" | "executionWorkspacePreference" | "executionWorkspaceSettings">,
  project?: Pick<Project, "executionWorkspacePolicy"> | null,
): string {
  const mode = resolveIssueWorkspaceMode(issue, project);
  switch (mode) {
    case "isolated_workspace":
      return "A fresh isolated workspace will be created the next time this issue runs.";
    case "operator_branch":
      return "This issue will use an operator branch checkout the next time it runs.";
    case "reuse_existing":
      return "This issue will reuse an existing execution workspace the next time it runs.";
    case "agent_default":
    case "adapter_default":
      return "This issue will let the assigned agent choose the checkout strategy.";
    case "cloud_sandbox":
      return "This issue will run in a cloud sandbox when the next execution starts.";
    case "adapter_managed":
      return "This issue will use an adapter-managed workspace when the next execution starts.";
    default:
      return "This issue will use the shared project workspace on its next run.";
  }
}

export function selectIssueLiveSurfaceWorkProducts(
  issue: Pick<Issue, "currentExecutionWorkspace" | "workProducts">,
): IssueWorkProduct[] {
  const liveProducts = (issue.workProducts ?? []).filter(
    (workProduct) => workProduct.type === "preview_url" || workProduct.type === "runtime_service",
  );
  const currentWorkspaceId = issue.currentExecutionWorkspace?.id ?? null;
  if (!currentWorkspaceId) return liveProducts;

  const scopedProducts = liveProducts.filter(
    (workProduct) => workProduct.executionWorkspaceId === currentWorkspaceId,
  );
  return scopedProducts.length > 0 ? scopedProducts : liveProducts;
}

export function selectIssueReviewWorkProducts(
  issue: Pick<Issue, "workProducts">,
): IssueWorkProduct[] {
  return [...(issue.workProducts ?? [])]
    .filter((workProduct) =>
      workProduct.type === "pull_request"
      || workProduct.type === "branch"
      || workProduct.type === "commit"
      || workProduct.type === "document",
    )
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
}

function resolveProjectStrategyType(
  project: Pick<Project, "executionWorkspacePolicy">,
): string {
  const policy = project.executionWorkspacePolicy;
  if (policy?.workspaceStrategy?.type) return policy.workspaceStrategy.type;
  if (policy?.defaultMode === "isolated_workspace" || policy?.defaultMode === "operator_branch") {
    return "git_worktree";
  }
  if (policy?.defaultMode === "adapter_default") return "adapter_managed";
  return "project_primary";
}

export function describeProjectExecutionWorkspacePolicy(
  project: Pick<Project, "executionWorkspacePolicy">,
): {
  modeLabel: string;
  strategyLabel: string;
  baseRef: string | null;
  branchTemplate: string | null;
  allowIssueOverride: boolean;
} {
  const policy = project.executionWorkspacePolicy;
  return {
    modeLabel: formatExecutionWorkspaceModeLabel(policy?.defaultMode ?? "shared_workspace"),
    strategyLabel: formatExecutionWorkspaceStrategyLabel(resolveProjectStrategyType(project)),
    baseRef: policy?.workspaceStrategy?.baseRef ?? null,
    branchTemplate: policy?.workspaceStrategy?.branchTemplate ?? null,
    allowIssueOverride: policy?.allowIssueOverride !== false,
  };
}

const OPERATIONAL_WORK_PRODUCT_ORDER: IssueWorkProduct["type"][] = [
  "pull_request",
  "preview_url",
  "runtime_service",
  "branch",
  "commit",
];

const EXECUTION_WORKSPACE_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  in_review: 1,
  idle: 2,
  cleanup_failed: 3,
  archived: 4,
};

function byUpdatedAtDesc<T extends { updatedAt: Date | string }>(left: T, right: T) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function selectPreferredWorkProduct(
  workProducts: IssueWorkProduct[],
  type: IssueWorkProduct["type"],
): IssueWorkProduct | null {
  const candidates = workProducts
    .filter((workProduct) => workProduct.type === type)
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
      return byUpdatedAtDesc(left, right);
    });
  return candidates[0] ?? null;
}

export function selectIssueOperationalWorkProducts(
  workProducts: IssueWorkProduct[] | null | undefined,
  limit = OPERATIONAL_WORK_PRODUCT_ORDER.length,
): IssueWorkProduct[] {
  const products = workProducts ?? [];
  const selected: IssueWorkProduct[] = [];
  const seen = new Set<string>();

  for (const type of OPERATIONAL_WORK_PRODUCT_ORDER) {
    const candidate = selectPreferredWorkProduct(products, type);
    if (!candidate || seen.has(candidate.id)) continue;
    selected.push(candidate);
    seen.add(candidate.id);
    if (selected.length >= limit) break;
  }

  return selected;
}

export function getExecutionWorkspaceLocation(
  workspace: Pick<ExecutionWorkspace, "providerRef" | "cwd"> | null | undefined,
): string | null {
  return workspace?.providerRef ?? workspace?.cwd ?? null;
}

export function getProjectCodebaseCheckout(
  project: Pick<Project, "codebase" | "primaryWorkspace"> | null | undefined,
): string | null {
  return project?.codebase.effectiveLocalFolder ?? project?.primaryWorkspace?.cwd ?? null;
}

export function getProjectCodebaseRef(
  project: Pick<Project, "codebase" | "primaryWorkspace"> | null | undefined,
): string | null {
  return project?.codebase.defaultRef ?? project?.codebase.repoRef ?? project?.primaryWorkspace?.defaultRef ?? null;
}

export function selectVisibleExecutionWorkspaces(
  workspaces: ExecutionWorkspace[] | null | undefined,
  limit = 5,
): ExecutionWorkspace[] {
  const deduplicated = new Map<string, ExecutionWorkspace>();

  for (const workspace of workspaces ?? []) {
    const key = workspace.providerRef ?? workspace.cwd ?? workspace.id;
    const existing = deduplicated.get(key);
    if (!existing || byUpdatedAtDesc(workspace, existing) < 0) {
      deduplicated.set(key, workspace);
    }
  }

  return Array.from(deduplicated.values())
    .sort((left, right) => {
      const statusDelta =
        (EXECUTION_WORKSPACE_STATUS_PRIORITY[left.status] ?? Number.MAX_SAFE_INTEGER)
        - (EXECUTION_WORKSPACE_STATUS_PRIORITY[right.status] ?? Number.MAX_SAFE_INTEGER);
      if (statusDelta !== 0) return statusDelta;
      return byUpdatedAtDesc(left, right);
    })
    .slice(0, limit);
}

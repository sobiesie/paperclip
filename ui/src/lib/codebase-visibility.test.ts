import { describe, expect, it } from "vitest";
import type { Issue, IssueWorkProduct, Project } from "@paperclipai/shared";
import {
  describeIssueCheckoutPlan,
  describeProjectExecutionWorkspacePolicy,
  getExecutionWorkspaceLocation,
  getProjectCodebaseCheckout,
  getProjectCodebaseRef,
  readExecutionWorkspaceGitStatus,
  selectIssueLiveSurfaceWorkProducts,
  selectIssueOperationalWorkProducts,
  selectIssueReviewWorkProducts,
  selectVisibleExecutionWorkspaces,
} from "./codebase-visibility";

function makeWorkProduct(overrides: Partial<IssueWorkProduct> = {}): IssueWorkProduct {
  return {
    id: overrides.id ?? "work-product-1",
    companyId: overrides.companyId ?? "company-1",
    projectId: overrides.projectId ?? "project-1",
    issueId: overrides.issueId ?? "issue-1",
    executionWorkspaceId: overrides.executionWorkspaceId ?? null,
    runtimeServiceId: overrides.runtimeServiceId ?? null,
    type: overrides.type ?? "pull_request",
    provider: overrides.provider ?? "github",
    externalId: overrides.externalId ?? null,
    title: overrides.title ?? "Work product",
    url: overrides.url ?? null,
    status: overrides.status ?? "active",
    reviewState: overrides.reviewState ?? "none",
    isPrimary: overrides.isPrimary ?? false,
    healthStatus: overrides.healthStatus ?? "unknown",
    summary: overrides.summary ?? null,
    metadata: overrides.metadata ?? null,
    createdByRunId: overrides.createdByRunId ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-28T10:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-03-28T10:00:00.000Z"),
  };
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: overrides.id ?? "issue-1",
    companyId: overrides.companyId ?? "company-1",
    projectId: overrides.projectId ?? "project-1",
    projectWorkspaceId: overrides.projectWorkspaceId ?? "workspace-1",
    goalId: overrides.goalId ?? null,
    parentId: overrides.parentId ?? null,
    title: overrides.title ?? "Issue",
    description: overrides.description ?? null,
    status: overrides.status ?? "todo",
    priority: overrides.priority ?? "medium",
    assigneeAgentId: overrides.assigneeAgentId ?? null,
    assigneeUserId: overrides.assigneeUserId ?? null,
    checkoutRunId: overrides.checkoutRunId ?? null,
    executionRunId: overrides.executionRunId ?? null,
    executionAgentNameKey: overrides.executionAgentNameKey ?? null,
    executionLockedAt: overrides.executionLockedAt ?? null,
    createdByAgentId: overrides.createdByAgentId ?? null,
    createdByUserId: overrides.createdByUserId ?? null,
    issueNumber: overrides.issueNumber ?? 1,
    identifier: overrides.identifier ?? "PAP-1",
    requestDepth: overrides.requestDepth ?? 0,
    billingCode: overrides.billingCode ?? null,
    assigneeAdapterOverrides: overrides.assigneeAdapterOverrides ?? null,
    executionWorkspaceId: overrides.executionWorkspaceId ?? null,
    executionWorkspacePreference: overrides.executionWorkspacePreference ?? null,
    executionWorkspaceSettings: overrides.executionWorkspaceSettings ?? null,
    codingWorkflowState: overrides.codingWorkflowState ?? null,
    startedAt: overrides.startedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    cancelledAt: overrides.cancelledAt ?? null,
    hiddenAt: overrides.hiddenAt ?? null,
    currentExecutionWorkspace: overrides.currentExecutionWorkspace ?? null,
    workProducts: overrides.workProducts ?? [],
    createdAt: overrides.createdAt ?? new Date("2026-03-28T10:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-03-28T10:00:00.000Z"),
  } as Issue;
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? "project-1",
    companyId: overrides.companyId ?? "company-1",
    urlKey: overrides.urlKey ?? "project-1",
    goalId: overrides.goalId ?? null,
    goalIds: overrides.goalIds ?? [],
    goals: overrides.goals ?? [],
    name: overrides.name ?? "Project",
    description: overrides.description ?? null,
    status: overrides.status ?? "planned",
    leadAgentId: overrides.leadAgentId ?? null,
    targetDate: overrides.targetDate ?? null,
    color: overrides.color ?? null,
    pauseReason: overrides.pauseReason ?? null,
    pausedAt: overrides.pausedAt ?? null,
    executionWorkspacePolicy: overrides.executionWorkspacePolicy ?? null,
    codebase: overrides.codebase ?? {
      workspaceId: null,
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
      repoName: null,
      localFolder: null,
      managedFolder: "/tmp/project",
      effectiveLocalFolder: "/tmp/project",
      origin: "managed_checkout",
    },
    workspaces: overrides.workspaces ?? [],
    primaryWorkspace: overrides.primaryWorkspace ?? null,
    archivedAt: overrides.archivedAt ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-28T10:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-03-28T10:00:00.000Z"),
  };
}

describe("codebase visibility helpers", () => {
  it("reads nested git status metadata from an execution workspace", () => {
    const summary = readExecutionWorkspaceGitStatus({
      metadata: {
        git: {
          dirty: true,
          modifiedCount: 2,
          untrackedCount: 1,
        },
      },
    } as any);

    expect(summary).toEqual({
      dirty: true,
      modifiedCount: 2,
      untrackedCount: 1,
      label: "2 modified, 1 untracked",
    });
  });

  it("prefers live surfaces attached to the current execution workspace", () => {
    const issue = makeIssue({
      currentExecutionWorkspace: { id: "ws-active" } as any,
      workProducts: [
        makeWorkProduct({ id: "preview-other", type: "preview_url", executionWorkspaceId: "ws-other" }),
        makeWorkProduct({ id: "runtime-active", type: "runtime_service", executionWorkspaceId: "ws-active" }),
        makeWorkProduct({ id: "preview-global", type: "preview_url", executionWorkspaceId: null }),
      ],
    });

    expect(selectIssueLiveSurfaceWorkProducts(issue).map((product) => product.id)).toEqual(["runtime-active"]);
  });

  it("returns review outputs without mixing in preview work products", () => {
    const issue = makeIssue({
      workProducts: [
        makeWorkProduct({ id: "preview-1", type: "preview_url", isPrimary: true }),
        makeWorkProduct({ id: "pr-1", type: "pull_request", isPrimary: false }),
        makeWorkProduct({ id: "commit-1", type: "commit", isPrimary: false }),
      ],
    });

    expect(selectIssueReviewWorkProducts(issue).map((product) => product.id)).toEqual(["pr-1", "commit-1"]);
  });

  it("picks a compact set of operational links for issue surfaces", () => {
    const products = selectIssueOperationalWorkProducts([
      makeWorkProduct({ id: "preview-1", type: "preview_url", updatedAt: new Date("2026-03-28T09:00:00.000Z") }),
      makeWorkProduct({ id: "runtime-1", type: "runtime_service", updatedAt: new Date("2026-03-28T08:00:00.000Z") }),
      makeWorkProduct({ id: "pr-1", type: "pull_request", isPrimary: true }),
      makeWorkProduct({ id: "branch-1", type: "branch", updatedAt: new Date("2026-03-28T11:00:00.000Z") }),
    ]);

    expect(products.map((product) => product.id)).toEqual(["pr-1", "preview-1", "runtime-1", "branch-1"]);
  });

  it("describes the next checkout plan from issue and project defaults", () => {
    const issue = makeIssue({
      executionWorkspacePreference: null,
      executionWorkspaceSettings: null,
      currentExecutionWorkspace: null,
    });
    const project = makeProject({
      executionWorkspacePolicy: {
        enabled: true,
        defaultMode: "isolated_workspace",
      },
    });

    expect(describeIssueCheckoutPlan(issue, project)).toBe(
      "A fresh isolated workspace will be created the next time this issue runs.",
    );
  });

  it("summarizes the project checkout policy for overview surfaces", () => {
    const project = makeProject({
      executionWorkspacePolicy: {
        enabled: true,
        defaultMode: "isolated_workspace",
        allowIssueOverride: true,
        workspaceStrategy: {
          type: "git_worktree",
          baseRef: "main",
          branchTemplate: "{{issue.identifier}}-{{slug}}",
        },
      },
    });

    expect(describeProjectExecutionWorkspacePolicy(project)).toEqual({
      modeLabel: "Isolated workspace",
      strategyLabel: "Git worktree",
      baseRef: "main",
      branchTemplate: "{{issue.identifier}}-{{slug}}",
      allowIssueOverride: true,
    });
  });

  it("derives project checkout and ref helpers from the codebase view", () => {
    const project = makeProject({
      codebase: {
        workspaceId: "workspace-1",
        repoUrl: "https://github.com/acme/repo",
        repoRef: "origin/main",
        defaultRef: "main",
        repoName: "repo",
        localFolder: null,
        managedFolder: "/tmp/managed",
        effectiveLocalFolder: "/tmp/managed",
        origin: "managed_checkout",
      },
      primaryWorkspace: {
        id: "workspace-1",
        companyId: "company-1",
        projectId: "project-1",
        name: "Primary",
        sourceType: "git_repo",
        cwd: "/tmp/local",
        repoUrl: "https://github.com/acme/repo",
        repoRef: "main",
        defaultRef: "main",
        visibility: "default",
        setupCommand: null,
        cleanupCommand: null,
        remoteProvider: null,
        remoteWorkspaceRef: null,
        sharedWorkspaceKey: null,
        metadata: null,
        isPrimary: true,
        runtimeServices: [],
        createdAt: new Date("2026-03-28T10:00:00.000Z"),
        updatedAt: new Date("2026-03-28T10:00:00.000Z"),
      },
    });

    expect(getProjectCodebaseCheckout(project)).toBe("/tmp/managed");
    expect(getProjectCodebaseRef(project)).toBe("main");
  });

  it("prefers the most recent visible execution workspaces and keeps active ones first", () => {
    const visible = selectVisibleExecutionWorkspaces([
      {
        id: "ws-idle",
        companyId: "company-1",
        projectId: "project-1",
        projectWorkspaceId: null,
        sourceIssueId: null,
        mode: "shared_workspace",
        strategyType: "project_primary",
        name: "Idle",
        status: "idle",
        cwd: "/tmp/repo",
        repoUrl: null,
        baseRef: null,
        branchName: null,
        providerType: "local_fs",
        providerRef: "/tmp/repo",
        derivedFromExecutionWorkspaceId: null,
        lastUsedAt: new Date("2026-03-28T10:00:00.000Z"),
        openedAt: new Date("2026-03-28T09:00:00.000Z"),
        closedAt: null,
        cleanupEligibleAt: null,
        cleanupReason: null,
        metadata: null,
        createdAt: new Date("2026-03-28T09:00:00.000Z"),
        updatedAt: new Date("2026-03-28T10:00:00.000Z"),
      },
      {
        id: "ws-active",
        companyId: "company-1",
        projectId: "project-1",
        projectWorkspaceId: null,
        sourceIssueId: null,
        mode: "isolated_workspace",
        strategyType: "git_worktree",
        name: "Active",
        status: "active",
        cwd: "/tmp/repo-active",
        repoUrl: null,
        baseRef: null,
        branchName: "feature/test",
        providerType: "git_worktree",
        providerRef: "/tmp/repo-active",
        derivedFromExecutionWorkspaceId: null,
        lastUsedAt: new Date("2026-03-28T11:00:00.000Z"),
        openedAt: new Date("2026-03-28T10:30:00.000Z"),
        closedAt: null,
        cleanupEligibleAt: null,
        cleanupReason: null,
        metadata: null,
        createdAt: new Date("2026-03-28T10:30:00.000Z"),
        updatedAt: new Date("2026-03-28T11:00:00.000Z"),
      },
      {
        id: "ws-active-newer",
        companyId: "company-1",
        projectId: "project-1",
        projectWorkspaceId: null,
        sourceIssueId: null,
        mode: "isolated_workspace",
        strategyType: "git_worktree",
        name: "Active newer",
        status: "active",
        cwd: "/tmp/repo-active",
        repoUrl: null,
        baseRef: null,
        branchName: "feature/test-2",
        providerType: "git_worktree",
        providerRef: "/tmp/repo-active",
        derivedFromExecutionWorkspaceId: null,
        lastUsedAt: new Date("2026-03-28T12:00:00.000Z"),
        openedAt: new Date("2026-03-28T11:30:00.000Z"),
        closedAt: null,
        cleanupEligibleAt: null,
        cleanupReason: null,
        metadata: null,
        createdAt: new Date("2026-03-28T11:30:00.000Z"),
        updatedAt: new Date("2026-03-28T12:00:00.000Z"),
      },
    ]);

    expect(visible.map((workspace) => workspace.id)).toEqual(["ws-active-newer", "ws-idle"]);
    expect(getExecutionWorkspaceLocation(visible[0]!)).toBe("/tmp/repo-active");
  });
});

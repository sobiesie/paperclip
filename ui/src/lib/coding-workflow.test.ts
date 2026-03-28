// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { Issue, IssueWorkProduct } from "@paperclipai/shared";
import {
  formatIssueWorkProductTypeLabel,
  getIssueCodingWorkflowPhase,
  getIssueCodingWorkflowSummary,
  getPrimaryIssueCodingWorkProduct,
  selectIssueCodingWorkProducts,
} from "./coding-workflow";

function makeWorkProduct(overrides: Partial<IssueWorkProduct> = {}): IssueWorkProduct {
  return {
    id: overrides.id ?? "work-product-1",
    companyId: "company-1",
    projectId: null,
    issueId: "issue-1",
    executionWorkspaceId: null,
    runtimeServiceId: null,
    type: overrides.type ?? "pull_request",
    provider: overrides.provider ?? "github",
    externalId: overrides.externalId ?? null,
    title: overrides.title ?? "Improve coding workflow",
    url: overrides.url ?? "https://example.com/pr/1",
    status: overrides.status ?? "active",
    reviewState: overrides.reviewState ?? "none",
    isPrimary: overrides.isPrimary ?? true,
    healthStatus: overrides.healthStatus ?? "unknown",
    summary: overrides.summary ?? null,
    metadata: overrides.metadata ?? null,
    createdByRunId: overrides.createdByRunId ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-28T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-03-28T00:00:00.000Z"),
  };
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    companyId: "company-1",
    projectId: "project-1",
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: "Make coding workflows visible",
    description: null,
    status: overrides.status ?? "todo",
    priority: "medium",
    assigneeAgentId: overrides.assigneeAgentId ?? "agent-builder",
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    issueNumber: 42,
    identifier: "PAP-42",
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    codingWorkflowState: overrides.codingWorkflowState ?? null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    labelIds: [],
    labels: [],
    workProducts: overrides.workProducts ?? [],
    createdAt: new Date("2026-03-28T00:00:00.000Z"),
    updatedAt: new Date("2026-03-28T00:00:00.000Z"),
  } as Issue;
}

describe("coding workflow helpers", () => {
  it("prefers primary coding work products over non-primary items", () => {
    const workProducts = [
      makeWorkProduct({ id: "commit-1", type: "commit", isPrimary: false }),
      makeWorkProduct({ id: "pr-1", type: "pull_request", isPrimary: true }),
      makeWorkProduct({ id: "preview-1", type: "preview_url", isPrimary: false }),
    ];

    expect(selectIssueCodingWorkProducts(workProducts).map((product) => product.id)).toEqual(["pr-1"]);
    expect(getPrimaryIssueCodingWorkProduct(makeIssue({ workProducts }))?.id).toBe("pr-1");
  });

  it("treats ready-for-review issues as being in the review lane", () => {
    const issue = makeIssue({
      status: "in_review",
      assigneeAgentId: "agent-reviewer",
      codingWorkflowState: {
        builderAgentId: "agent-builder",
        reviewerAgentId: "agent-reviewer",
      },
      workProducts: [
        makeWorkProduct({
          status: "ready_for_review",
          reviewState: "needs_board_review",
        }),
      ],
    });

    expect(getIssueCodingWorkflowPhase(issue)).toBe("review");
    expect(getIssueCodingWorkflowSummary(issue)?.recommendedActions).toEqual(["approve", "changes_requested"]);
  });

  it("treats a builder handoff after review as changes requested", () => {
    const issue = makeIssue({
      assigneeAgentId: "agent-builder",
      codingWorkflowState: {
        builderAgentId: "agent-builder",
        reviewerAgentId: "agent-reviewer",
      },
      workProducts: [
        makeWorkProduct({
          status: "changes_requested",
          reviewState: "changes_requested",
        }),
      ],
    });

    expect(getIssueCodingWorkflowPhase(issue)).toBe("changes_requested");
    expect(getIssueCodingWorkflowSummary(issue)?.shortLabel).toBe("Fixing");
  });

  it("treats done workflow issues as approved", () => {
    const issue = makeIssue({
      status: "done",
      workProducts: [
        makeWorkProduct({
          status: "approved",
          reviewState: "approved",
        }),
      ],
    });

    expect(getIssueCodingWorkflowPhase(issue)).toBe("approved");
    expect(getIssueCodingWorkflowSummary(issue)?.label).toBe("Approved");
  });

  it("formats work product labels for the coding workflow card", () => {
    expect(formatIssueWorkProductTypeLabel("pull_request")).toBe("Pull request");
    expect(formatIssueWorkProductTypeLabel("preview_url")).toBe("Preview");
    expect(formatIssueWorkProductTypeLabel("branch")).toBe("branch");
  });
});

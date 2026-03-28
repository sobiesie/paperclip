import { describe, expect, it } from "vitest";
import type { ActivityEvent, IssueWorkProduct } from "@paperclipai/shared";
import { buildIssueTimeline, describeIssueTimelineActivity, isIssueTimelineActivity } from "./issue-timeline";

function makeActivityEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: "activity-1",
    companyId: "company-1",
    actorType: "system",
    actorId: "paperclip",
    action: "issue.work_product_updated",
    entityType: "issue",
    entityId: "issue-1",
    agentId: null,
    runId: null,
    details: null,
    createdAt: new Date("2026-03-28T10:00:00.000Z"),
    ...overrides,
  };
}

function makeWorkProduct(overrides: Partial<IssueWorkProduct> = {}): IssueWorkProduct {
  return {
    id: "work-product-1",
    companyId: "company-1",
    issueId: "issue-1",
    projectId: "project-1",
    executionWorkspaceId: null,
    runtimeServiceId: null,
    type: "pull_request",
    provider: "github",
    externalId: null,
    title: "PR #12",
    url: "https://github.com/acme/repo/pull/12",
    status: "ready_for_review",
    reviewState: "needs_board_review",
    isPrimary: true,
    healthStatus: "unknown",
    summary: null,
    metadata: null,
    createdByRunId: null,
    createdAt: new Date("2026-03-28T09:00:00.000Z"),
    updatedAt: new Date("2026-03-28T09:30:00.000Z"),
    ...overrides,
  };
}

describe("issue timeline helpers", () => {
  it("keeps work-product and synced workflow events in the coding timeline", () => {
    expect(
      isIssueTimelineActivity(makeActivityEvent({ action: "issue.work_product_created" })),
    ).toBe(true);
    expect(
      isIssueTimelineActivity(
        makeActivityEvent({
          action: "issue.updated",
          details: { source: "work_product", workflowAction: "request_review" },
        }),
      ),
    ).toBe(true);
    expect(
      isIssueTimelineActivity(
        makeActivityEvent({
          action: "issue.updated",
          details: { source: "comment", workflowAction: "request_review" },
        }),
      ),
    ).toBe(false);
  });

  it("sorts comments, coding activity, and runs into one timeline", () => {
    const timeline = buildIssueTimeline({
      comments: [
        {
          id: "comment-1",
          companyId: "company-1",
          issueId: "issue-1",
          authorAgentId: null,
          authorUserId: "user-1",
          body: "First",
          workflowAction: null,
          createdAt: new Date("2026-03-28T10:00:00.000Z"),
          updatedAt: new Date("2026-03-28T10:00:00.000Z"),
        },
      ],
      activity: [
        makeActivityEvent({
          id: "activity-2",
          action: "issue.work_product_created",
          createdAt: new Date("2026-03-28T10:05:00.000Z"),
        }),
      ],
      linkedRuns: [
        {
          runId: "run-1",
          status: "completed",
          agentId: "agent-1",
          createdAt: new Date("2026-03-28T10:10:00.000Z"),
          startedAt: new Date("2026-03-28T10:10:00.000Z"),
        },
      ],
    });

    expect(timeline.map((item) => item.kind)).toEqual(["comment", "activity", "run"]);
  });

  it("describes work-product review updates in a coding-friendly way", () => {
    expect(
      describeIssueTimelineActivity(
        makeActivityEvent({
          details: {
            workProductId: "work-product-1",
            workflowAction: "request_review",
          },
        }),
        [makeWorkProduct()],
      ),
    ).toMatchObject({
      badge: "PR",
      title: "PR is ready for review",
      workProduct: expect.objectContaining({ id: "work-product-1" }),
    });

    expect(
      describeIssueTimelineActivity(
        makeActivityEvent({
          action: "issue.updated",
          details: {
            source: "work_product",
            workflowAction: "changes_requested",
            codingWorkflowHandoff: "changes_requested",
          },
        }),
        [makeWorkProduct()],
      ),
    ).toMatchObject({
      badge: "Workflow",
      title: "Sent changes back for fixes",
    });
  });
});

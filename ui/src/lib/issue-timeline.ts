import type { ActivityEvent, IssueComment, IssueWorkProduct } from "@paperclipai/shared";

export interface CommentTimelineItem extends IssueComment {
  runId?: string | null;
  runAgentId?: string | null;
}

export interface LinkedRunTimelineItem {
  runId: string;
  status: string;
  agentId: string;
  createdAt: Date | string;
  startedAt: Date | string | null;
}

export type IssueTimelineItem =
  | { kind: "comment"; id: string; createdAtMs: number; comment: CommentTimelineItem }
  | { kind: "run"; id: string; createdAtMs: number; run: LinkedRunTimelineItem }
  | { kind: "activity"; id: string; createdAtMs: number; event: ActivityEvent };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function workProductTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "pull_request":
      return "PR";
    case "branch":
      return "Branch";
    case "commit":
      return "Commit";
    case "preview_url":
      return "Preview";
    case "document":
      return "Document";
    case "artifact":
      return "Artifact";
    case "runtime_service":
      return "Runtime";
    default:
      return "Work product";
  }
}

export function isIssueTimelineActivity(event: ActivityEvent) {
  if (
    event.action === "issue.work_product_created" ||
    event.action === "issue.work_product_updated" ||
    event.action === "issue.work_product_deleted"
  ) {
    return true;
  }

  if (event.action !== "issue.updated") return false;
  const details = asRecord(event.details);
  return details?.source === "work_product" && typeof details.workflowAction === "string";
}

export function buildIssueTimeline(input: {
  comments: CommentTimelineItem[];
  linkedRuns?: LinkedRunTimelineItem[];
  activity?: ActivityEvent[];
}) {
  const commentItems: IssueTimelineItem[] = input.comments.map((comment) => ({
    kind: "comment",
    id: comment.id,
    createdAtMs: new Date(comment.createdAt).getTime(),
    comment,
  }));
  const runItems: IssueTimelineItem[] = (input.linkedRuns ?? []).map((run) => ({
    kind: "run",
    id: run.runId,
    createdAtMs: new Date(run.startedAt ?? run.createdAt).getTime(),
    run,
  }));
  const activityItems: IssueTimelineItem[] = (input.activity ?? [])
    .filter(isIssueTimelineActivity)
    .map((event) => ({
      kind: "activity",
      id: event.id,
      createdAtMs: new Date(event.createdAt).getTime(),
      event,
    }));

  return [...commentItems, ...runItems, ...activityItems].sort((a, b) => {
    if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
    if (a.kind === b.kind) return a.id.localeCompare(b.id);
    if (a.kind === "comment") return -1;
    if (b.kind === "comment") return 1;
    if (a.kind === "activity") return -1;
    if (b.kind === "activity") return 1;
    return 0;
  });
}

export function describeIssueTimelineActivity(
  event: ActivityEvent,
  workProducts: IssueWorkProduct[],
) {
  const details = asRecord(event.details);
  const workProductId = typeof details?.workProductId === "string" ? details.workProductId : null;
  const workProduct = workProductId
    ? workProducts.find((candidate) => candidate.id === workProductId) ?? null
    : null;
  const typeLabel = workProductTypeLabel(
    workProduct?.type ?? (typeof details?.type === "string" ? details.type : null),
  );
  const workflowAction = typeof details?.workflowAction === "string" ? details.workflowAction : null;
  const codingWorkflowHandoff =
    typeof details?.codingWorkflowHandoff === "string" ? details.codingWorkflowHandoff : null;

  if (event.action === "issue.work_product_created") {
    return {
      badge: typeLabel,
      title: `Created ${typeLabel.toLowerCase()}`,
      workProduct,
    };
  }

  if (event.action === "issue.work_product_deleted") {
    return {
      badge: typeLabel,
      title: `Removed ${typeLabel.toLowerCase()}`,
      workProduct,
    };
  }

  if (event.action === "issue.updated") {
    if (codingWorkflowHandoff === "request_review") {
      return {
        badge: "Workflow",
        title: "Handed work to the reviewer",
        workProduct,
      };
    }
    if (codingWorkflowHandoff === "changes_requested") {
      return {
        badge: "Workflow",
        title: "Sent changes back for fixes",
        workProduct,
      };
    }
    if (workflowAction === "approve") {
      return {
        badge: "Workflow",
        title: "Marked the issue done from review",
        workProduct,
      };
    }
    return {
      badge: "Workflow",
      title: "Synced issue state from a linked work product",
      workProduct,
    };
  }

  if (workflowAction === "request_review") {
    return {
      badge: typeLabel,
      title: `${typeLabel} is ready for review`,
      workProduct,
    };
  }
  if (workflowAction === "changes_requested") {
    return {
      badge: typeLabel,
      title: `${typeLabel} requested changes`,
      workProduct,
    };
  }
  if (workflowAction === "approve") {
    return {
      badge: typeLabel,
      title: `${typeLabel} was approved`,
      workProduct,
    };
  }
  if (workflowAction === "continue") {
    return {
      badge: typeLabel,
      title: `${typeLabel} returned to active work`,
      workProduct,
    };
  }

  return {
    badge: typeLabel,
    title: `Updated ${typeLabel.toLowerCase()}`,
    workProduct,
  };
}

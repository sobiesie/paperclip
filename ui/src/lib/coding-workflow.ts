import type { Issue, IssueCommentWorkflowAction, IssueWorkProduct } from "@paperclipai/shared";

const WORKFLOW_FALLBACK_TYPES = new Set<IssueWorkProduct["type"]>([
  "pull_request",
  "branch",
  "commit",
  "preview_url",
  "document",
]);

export type IssueCodingWorkflowPhase =
  | "building"
  | "review"
  | "changes_requested"
  | "approved";

export interface IssueCodingWorkflowSummary {
  phase: IssueCodingWorkflowPhase;
  label: string;
  shortLabel: string;
  description: string;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  recommendedActions: IssueCommentWorkflowAction[];
}

export function selectIssueCodingWorkProducts(
  workProducts: IssueWorkProduct[] | null | undefined,
): IssueWorkProduct[] {
  const products = workProducts ?? [];
  const primary = products.filter(
    (workProduct) => workProduct.isPrimary && WORKFLOW_FALLBACK_TYPES.has(workProduct.type),
  );
  if (primary.length > 0) return primary;
  const anyPrimary = products.filter((workProduct) => workProduct.isPrimary);
  if (anyPrimary.length > 0) return anyPrimary;
  return products.filter((workProduct) => WORKFLOW_FALLBACK_TYPES.has(workProduct.type));
}

export function getPrimaryIssueCodingWorkProduct(
  issue: Pick<Issue, "workProducts">,
): IssueWorkProduct | null {
  return selectIssueCodingWorkProducts(issue.workProducts)[0] ?? null;
}

export function getIssueCodingWorkflowPhase(
  issue: Pick<Issue, "status" | "assigneeAgentId" | "codingWorkflowState" | "workProducts">,
): IssueCodingWorkflowPhase | null {
  const primaryWorkProduct = getPrimaryIssueCodingWorkProduct(issue);
  const workProductStatus = primaryWorkProduct?.status ?? null;
  const reviewState = primaryWorkProduct?.reviewState ?? null;
  const builderAgentId = issue.codingWorkflowState?.builderAgentId ?? null;
  const reviewerAgentId = issue.codingWorkflowState?.reviewerAgentId ?? null;
  const hasWorkflowContext = Boolean(
    primaryWorkProduct ||
    builderAgentId ||
    reviewerAgentId ||
    issue.status === "in_review",
  );

  if (!hasWorkflowContext) return null;

  if (issue.status === "done" || workProductStatus === "approved" || reviewState === "approved") {
    return "approved";
  }

  if (
    workProductStatus === "changes_requested" ||
    reviewState === "changes_requested"
  ) {
    return "changes_requested";
  }

  if (
    issue.status === "in_review" ||
    workProductStatus === "ready_for_review" ||
    reviewState === "needs_board_review" ||
    (reviewerAgentId && issue.assigneeAgentId === reviewerAgentId)
  ) {
    return "review";
  }

  if (builderAgentId && reviewerAgentId && issue.assigneeAgentId === builderAgentId) {
    return "changes_requested";
  }

  return "building";
}

export function getIssueCodingWorkflowSummary(
  issue: Pick<Issue, "status" | "assigneeAgentId" | "codingWorkflowState" | "workProducts">,
): IssueCodingWorkflowSummary | null {
  const phase = getIssueCodingWorkflowPhase(issue);
  if (!phase) return null;

  switch (phase) {
    case "building":
      return {
        phase,
        label: "Implementation",
        shortLabel: "Building",
        description: "The current builder is still implementing or iterating on the change.",
        badgeVariant: "secondary",
        recommendedActions: ["continue", "request_review"],
      };
    case "review":
      return {
        phase,
        label: "Review",
        shortLabel: "Review",
        description: "The issue is in the review lane and can be approved or sent back with requested changes.",
        badgeVariant: "outline",
        recommendedActions: ["approve", "changes_requested"],
      };
    case "changes_requested":
      return {
        phase,
        label: "Changes requested",
        shortLabel: "Fixing",
        description: "Review found follow-up work, so the implementation lane is active again.",
        badgeVariant: "destructive",
        recommendedActions: ["continue", "request_review"],
      };
    case "approved":
      return {
        phase,
        label: "Approved",
        shortLabel: "Approved",
        description: "The latest linked output is approved and the issue is effectively in a done state.",
        badgeVariant: "default",
        recommendedActions: ["continue"],
      };
    default:
      return null;
  }
}

export function formatIssueWorkProductTypeLabel(type: IssueWorkProduct["type"]): string {
  switch (type) {
    case "pull_request":
      return "Pull request";
    case "preview_url":
      return "Preview";
    case "runtime_service":
      return "Runtime service";
    default:
      return type.replace(/_/g, " ");
  }
}

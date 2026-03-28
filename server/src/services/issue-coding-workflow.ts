import type {
  IssueCodingWorkflowState,
  IssueCommentWorkflowAction,
  IssueStatus,
  IssueWorkProduct,
  ProjectCodingWorkflowPolicy,
} from "@paperclipai/shared";

type AssignableAgentReader = {
  getById(agentId: string): Promise<{
    id: string;
    companyId: string;
    status: string;
  } | null>;
};

type ProjectWorkflowReader = {
  getById(projectId: string): Promise<{
    executionWorkspacePolicy?: {
      codingWorkflowPolicy?: ProjectCodingWorkflowPolicy | null;
    } | null;
  } | null>;
};

export type CommentWorkflowHandoff = {
  assigneeAgentId: string;
  codingWorkflowState: IssueCodingWorkflowState;
  wakeReason: string | null;
  kind: "request_review" | "changes_requested" | "continue";
};

export function isClosedIssueStatus(status: string) {
  return status === "done" || status === "cancelled";
}

export function getCommentWorkflowIssueStatus(
  workflowAction: IssueCommentWorkflowAction | undefined,
  currentStatus: string,
): IssueStatus | null {
  switch (workflowAction) {
    case "continue":
      return currentStatus === "in_review" || isClosedIssueStatus(currentStatus) ? "todo" : null;
    case "request_review":
      return currentStatus === "in_review" ? null : "in_review";
    case "changes_requested":
      return currentStatus === "todo" ? null : "todo";
    case "approve":
      return currentStatus === "done" ? null : "done";
    default:
      return null;
  }
}

export function getCommentWorkflowWakeReason(
  workflowAction: IssueCommentWorkflowAction | undefined,
) {
  switch (workflowAction) {
    case "continue":
      return "issue_continue_requested";
    case "changes_requested":
      return "issue_changes_requested";
    default:
      return null;
  }
}

export function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseIssueCodingWorkflowState(raw: unknown): IssueCodingWorkflowState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const builderAgentId =
    typeof (raw as Record<string, unknown>).builderAgentId === "string"
      ? ((raw as Record<string, unknown>).builderAgentId as string)
      : null;
  const reviewerAgentId =
    typeof (raw as Record<string, unknown>).reviewerAgentId === "string"
      ? ((raw as Record<string, unknown>).reviewerAgentId as string)
      : null;
  if (!builderAgentId && !reviewerAgentId) return null;
  return { builderAgentId, reviewerAgentId };
}

async function resolveAssignableAgentId(
  companyId: string,
  agentId: string | null | undefined,
  agentsSvc: AssignableAgentReader,
) {
  if (!agentId) return null;
  const agent = await agentsSvc.getById(agentId);
  if (!agent || agent.companyId !== companyId) return null;
  if (agent.status === "pending_approval" || agent.status === "terminated") return null;
  return agent.id;
}

export async function resolveCommentWorkflowHandoff(input: {
  issue: {
    companyId: string;
    projectId: string | null;
    assigneeAgentId: string | null;
    codingWorkflowState?: IssueCodingWorkflowState | Record<string, unknown> | null;
  };
  workflowAction: IssueCommentWorkflowAction | undefined;
  projectsSvc: ProjectWorkflowReader;
  agentsSvc: AssignableAgentReader;
}): Promise<CommentWorkflowHandoff | null> {
  if (!input.issue.assigneeAgentId || !input.issue.projectId) return null;
  if (
    input.workflowAction !== "request_review" &&
    input.workflowAction !== "changes_requested" &&
    input.workflowAction !== "continue"
  ) {
    return null;
  }

  const project = await input.projectsSvc.getById(input.issue.projectId);
  const policy = project?.executionWorkspacePolicy?.codingWorkflowPolicy as ProjectCodingWorkflowPolicy | null | undefined;
  const currentState = parseIssueCodingWorkflowState(input.issue.codingWorkflowState);

  if (input.workflowAction === "request_review") {
    const reviewerAgentId = await resolveAssignableAgentId(
      input.issue.companyId,
      policy?.reviewerAgentId,
      input.agentsSvc,
    );
    if (!reviewerAgentId || reviewerAgentId === input.issue.assigneeAgentId) return null;
    return {
      assigneeAgentId: reviewerAgentId,
      codingWorkflowState: {
        builderAgentId: input.issue.assigneeAgentId,
        reviewerAgentId,
      },
      wakeReason: "issue_review_requested",
      kind: "request_review",
    };
  }

  const preferredFixerAgentId =
    input.workflowAction === "changes_requested"
      ? await resolveAssignableAgentId(
        input.issue.companyId,
        policy?.fixerAgentId,
        input.agentsSvc,
      )
      : null;
  const builderAgentId = await resolveAssignableAgentId(
    input.issue.companyId,
    currentState?.builderAgentId,
    input.agentsSvc,
  );
  const nextAssigneeAgentId = preferredFixerAgentId ?? builderAgentId;
  if (!nextAssigneeAgentId || nextAssigneeAgentId === input.issue.assigneeAgentId) return null;

  return {
    assigneeAgentId: nextAssigneeAgentId,
    codingWorkflowState: {
      builderAgentId: nextAssigneeAgentId,
      reviewerAgentId: input.issue.assigneeAgentId,
    },
    wakeReason: null,
    kind: input.workflowAction,
  };
}

export function inferWorkProductWorkflowAction(
  previous: Pick<IssueWorkProduct, "type" | "status" | "reviewState">,
  next: Pick<IssueWorkProduct, "type" | "status" | "reviewState">,
): IssueCommentWorkflowAction | undefined {
  if (next.type !== "pull_request") return undefined;

  if (next.reviewState !== previous.reviewState) {
    if (next.reviewState === "needs_board_review") return "request_review";
    if (next.reviewState === "changes_requested") return "changes_requested";
    if (next.reviewState === "approved") return "approve";
  }

  if (next.status !== previous.status) {
    if (next.status === "ready_for_review") return "request_review";
    if (next.status === "changes_requested") return "changes_requested";
    if (next.status === "approved") return "approve";
  }

  if (
    next.reviewState === "none" &&
    next.status === "active" &&
    (previous.reviewState !== next.reviewState || previous.status !== next.status)
  ) {
    return "continue";
  }
  return undefined;
}

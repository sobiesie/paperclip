import type { Agent, Issue, IssueCommentWorkflowAction, IssueWorkProduct, Project } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { ArrowRight, Check, ExternalLink, FileText, GitBranch, Globe, Hammer, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIssueWorkProductTypeLabel, getIssueCodingWorkflowSummary, selectIssueCodingWorkProducts } from "../lib/coding-workflow";
import { agentUrl, cn, relativeTime } from "../lib/utils";
import { Identity } from "./Identity";
import { StatusBadge } from "./StatusBadge";

const ACTION_LABELS: Record<IssueCommentWorkflowAction, string> = {
  continue: "Continue",
  request_review: "Request review",
  changes_requested: "Request changes",
  approve: "Approve",
};

const ACTION_BODY: Record<IssueCommentWorkflowAction, string> = {
  continue: "/continue",
  request_review: "/review",
  changes_requested: "/fix",
  approve: "/approve",
};

function workProductIcon(type: IssueWorkProduct["type"]) {
  switch (type) {
    case "preview_url":
      return Globe;
    case "document":
      return FileText;
    case "artifact":
      return Package;
    default:
      return GitBranch;
  }
}

function resolveAgent(
  agentId: string | null | undefined,
  agentMap?: Map<string, Agent>,
): Agent | null {
  if (!agentId) return null;
  return agentMap?.get(agentId) ?? null;
}

function AgentLane({
  label,
  agentId,
  agentMap,
  subtle = false,
}: {
  label: string;
  agentId: string | null;
  agentMap?: Map<string, Agent>;
  subtle?: boolean;
}) {
  const agent = resolveAgent(agentId, agentMap);

  return (
    <div className={cn(
      "rounded-lg border px-3 py-2",
      subtle ? "border-border/70 bg-muted/20" : "border-border bg-card",
    )}>
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      {agentId ? (
        agent ? (
          <Link to={agentUrl(agent)} className="mt-2 inline-flex max-w-full hover:underline">
            <Identity name={agent.name} size="sm" className="min-w-0" />
          </Link>
        ) : (
          <div className="mt-2 font-mono text-xs text-muted-foreground">{agentId.slice(0, 8)}</div>
        )
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">Not set</div>
      )}
    </div>
  );
}

export function IssueCodingWorkflowCard({
  issue,
  project,
  agentMap,
  onWorkflowAction,
  pendingWorkflowAction = null,
}: {
  issue: Issue;
  project?: Project | null;
  agentMap?: Map<string, Agent>;
  onWorkflowAction?: (action: IssueCommentWorkflowAction) => Promise<void>;
  pendingWorkflowAction?: IssueCommentWorkflowAction | null;
}) {
  const summary = getIssueCodingWorkflowSummary(issue);
  const workflowProducts = selectIssueCodingWorkProducts(issue.workProducts).slice(0, 4);
  const codingWorkflowPolicy = project?.executionWorkspacePolicy?.codingWorkflowPolicy ?? null;
  const builderAgentId = issue.codingWorkflowState?.builderAgentId ?? issue.assigneeAgentId;
  const reviewerAgentId = issue.codingWorkflowState?.reviewerAgentId ?? codingWorkflowPolicy?.reviewerAgentId ?? null;
  const fixerAgentId = codingWorkflowPolicy?.fixerAgentId ?? null;

  if (!summary && workflowProducts.length === 0 && !codingWorkflowPolicy) {
    return null;
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="gap-3 px-4 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Coding Workflow</CardTitle>
            <CardDescription>
              Builder, reviewer, and fixer routing for this issue’s code-change loop.
            </CardDescription>
          </div>
          {summary ? (
            <Badge variant={summary.badgeVariant} className="px-2.5 py-1 text-[11px]">
              {summary.label}
            </Badge>
          ) : null}
        </div>
        {summary ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Hammer className="h-3.5 w-3.5" />
            <span>{summary.description}</span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 pt-0">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <AgentLane label="Current" agentId={issue.assigneeAgentId} agentMap={agentMap} />
          <AgentLane label="Builder" agentId={builderAgentId} agentMap={agentMap} subtle />
          <AgentLane label="Reviewer" agentId={reviewerAgentId} agentMap={agentMap} subtle />
          <AgentLane label="Fixer" agentId={fixerAgentId} agentMap={agentMap} subtle />
        </div>

        {summary && onWorkflowAction ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {summary.recommendedActions.map((action) => (
                <Button
                  key={action}
                  type="button"
                  size="xs"
                  variant={action === "changes_requested" ? "destructive" : "outline"}
                  disabled={pendingWorkflowAction !== null}
                  onClick={() => void onWorkflowAction(action)}
                >
                  {pendingWorkflowAction === action ? (
                    <>
                      <Check className="h-3 w-3" />
                      Posting…
                    </>
                  ) : (
                    ACTION_LABELS[action]
                  )}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Quick actions post a structured workflow comment such as <code>{ACTION_BODY[summary.recommendedActions[0]!]}</code>.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            Linked outputs
          </div>
          {workflowProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
              No linked PRs, branches, commits, previews, or documents are attached yet.
            </div>
          ) : (
            <div className="space-y-2">
              {workflowProducts.map((workProduct) => {
                const Icon = workProductIcon(workProduct.type);
                return (
                  <div
                    key={workProduct.id}
                    className="flex flex-col gap-2 rounded-lg border border-border/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {formatIssueWorkProductTypeLabel(workProduct.type)}
                        </span>
                        {workProduct.isPrimary ? (
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            Primary
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        {workProduct.url ? (
                          <a
                            href={workProduct.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-w-0 items-center gap-1 text-sm font-medium hover:underline"
                          >
                            <span className="truncate">{workProduct.title}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="truncate text-sm font-medium">{workProduct.title}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{workProduct.provider}</span>
                        <span>updated {relativeTime(workProduct.updatedAt)}</span>
                        {workProduct.summary ? (
                          <span className="truncate sm:max-w-[420px]">{workProduct.summary}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={workProduct.status} />
                      {workProduct.reviewState !== "none" && workProduct.reviewState !== workProduct.status ? (
                        <Badge variant="outline" className="px-2 py-0.5">
                          {workProduct.reviewState.replace(/_/g, " ")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

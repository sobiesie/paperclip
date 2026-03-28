import type { ReactNode } from "react";
import type { Project } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FolderOpen, Github, GitBranch, Globe, Hammer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { executionWorkspacesApi } from "../api/execution-workspaces";
import { queryKeys } from "../lib/queryKeys";
import {
  getExecutionWorkspaceLocation,
  getProjectCodebaseCheckout,
  getProjectCodebaseRef,
  selectVisibleExecutionWorkspaces,
} from "../lib/codebase-visibility";
import { relativeTime } from "../lib/utils";
import { StatusBadge } from "./StatusBadge";

function isSafeExternalUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function formatRepoUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.pathname.replace(/^\/+/, "").replace(/\.git$/i, "") || value;
  } catch {
    return value;
  }
}

function DetailTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/40 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 min-w-0 text-sm">{children}</div>
    </div>
  );
}

export function ProjectCodebaseOperationsCard({ project }: { project: Project }) {
  const primaryWorkspace = project.primaryWorkspace ?? project.workspaces.find((workspace) => workspace.isPrimary) ?? null;
  const runtimeServices = primaryWorkspace?.runtimeServices ?? [];
  const primaryCheckout = getProjectCodebaseCheckout(project);
  const primaryRef = getProjectCodebaseRef(project);

  const { data: executionWorkspaces, error } = useQuery({
    queryKey: queryKeys.executionWorkspaces.list(project.companyId, {
      projectId: project.id,
      status: "active,idle,in_review",
    }),
    queryFn: () =>
      executionWorkspacesApi.list(project.companyId, {
        projectId: project.id,
        status: "active,idle,in_review",
      }),
    enabled: Boolean(project.companyId) && Boolean(project.id),
    refetchInterval: 5000,
  });

  const recentExecutionWorkspaces = selectVisibleExecutionWorkspaces(executionWorkspaces, 5);
  const workspaceCounts = {
    active: (executionWorkspaces ?? []).filter((workspace) => workspace.status === "active").length,
    inReview: (executionWorkspaces ?? []).filter((workspace) => workspace.status === "in_review").length,
    idle: (executionWorkspaces ?? []).filter((workspace) => workspace.status === "idle").length,
  };

  return (
    <Card className="border-border/80">
      <CardHeader className="gap-3 px-4 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Codebase Operations</CardTitle>
            <CardDescription>
              Repo, primary checkout, runtime services, and recent execution workspaces for this project.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {workspaceCounts.active > 0 ? <Badge variant="secondary">{workspaceCounts.active} active</Badge> : null}
            {workspaceCounts.inReview > 0 ? <Badge variant="outline">{workspaceCounts.inReview} in review</Badge> : null}
            {workspaceCounts.idle > 0 ? <Badge variant="outline">{workspaceCounts.idle} idle</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 pt-0">
        <div className="grid gap-3 md:grid-cols-3">
          <DetailTile label="Source repo">
            {project.codebase.repoUrl ? (
              isSafeExternalUrl(project.codebase.repoUrl) ? (
                <a
                  href={project.codebase.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1.5 hover:underline"
                >
                  <Github className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{formatRepoUrl(project.codebase.repoUrl)}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </a>
              ) : (
                <div className="inline-flex min-w-0 items-center gap-1.5">
                  <Github className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="break-all font-mono text-xs">{project.codebase.repoUrl}</span>
                </div>
              )
            ) : (
              <span className="text-muted-foreground">No repo URL configured yet.</span>
            )}
          </DetailTile>

          <DetailTile label="Default ref">
            {primaryRef ? (
              <div className="inline-flex min-w-0 items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="break-all font-mono text-xs">{primaryRef}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Uses the current workspace HEAD.</span>
            )}
          </DetailTile>

          <DetailTile label="Primary checkout">
            <div className="space-y-2">
              {primaryCheckout ? (
                <div className="inline-flex min-w-0 items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="break-all font-mono text-xs">{primaryCheckout}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">No local checkout configured yet.</span>
              )}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {project.codebase.origin === "managed_checkout" ? "Paperclip-managed checkout" : "Local folder"}
                </Badge>
                {primaryWorkspace?.sourceType ? (
                  <Badge variant="outline">{primaryWorkspace.sourceType.replace(/_/g, " ")}</Badge>
                ) : null}
              </div>
            </div>
          </DetailTile>
        </div>

        {runtimeServices.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Runtime services
            </div>
            <div className="space-y-2">
              {runtimeServices.map((service) => (
                <div
                  key={service.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">{service.serviceName}</span>
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {service.lifecycle}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {service.url ? (
                        <a
                          href={service.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-w-0 items-center gap-1 hover:text-foreground hover:underline"
                        >
                          <span className="truncate">{service.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : service.command ? (
                        <span className="break-all font-mono">{service.command}</span>
                      ) : (
                        <span>No URL or command reported.</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={service.status} />
                    {service.healthStatus !== "unknown" ? (
                      <Badge variant="outline">{service.healthStatus}</Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Hammer className="h-4 w-4 text-muted-foreground" />
            Recent execution workspaces
          </div>
          {error ? (
            <div className="rounded-lg border border-dashed border-destructive/40 px-3 py-3 text-sm text-destructive">
              Failed to load execution workspaces.
            </div>
          ) : recentExecutionWorkspaces.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
              No active or reusable execution workspaces yet. New issue runs will start from the primary checkout above.
            </div>
          ) : (
            <div className="space-y-2">
              {recentExecutionWorkspaces.map((workspace) => {
                const location = getExecutionWorkspaceLocation(workspace);
                return (
                  <div
                    key={workspace.id}
                    className="rounded-lg border border-border/80 px-3 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/execution-workspaces/${workspace.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {workspace.name}
                          </Link>
                          <Badge variant="outline">{workspace.mode.replace(/_/g, " ")}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>last used {relativeTime(workspace.lastUsedAt)}</span>
                          {workspace.sourceIssueId ? (
                            <Link to={`/issues/${workspace.sourceIssueId}`} className="hover:text-foreground hover:underline">
                              linked issue
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      <StatusBadge status={workspace.status} />
                    </div>
                    {(workspace.branchName || location) ? (
                      <div className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
                        {workspace.branchName ? (
                          <div className="inline-flex min-w-0 items-center gap-1.5">
                            <GitBranch className="h-3.5 w-3.5 shrink-0" />
                            <span className="break-all font-mono">{workspace.branchName}</span>
                          </div>
                        ) : null}
                        {location ? (
                          <div className="inline-flex min-w-0 items-center gap-1.5">
                            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                            <span className="break-all font-mono">{location}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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

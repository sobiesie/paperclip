import type { Goal } from "@paperclipai/shared";
import {
  deriveWorkspaceNameFromPath,
  deriveWorkspaceNameFromRepo,
} from "./project-workspace-input";

export const ONBOARDING_PROJECT_NAME = "Onboarding";
export const CODEBASE_ONBOARDING_PROJECT_NAME = "Codebase";

function goalCreatedAt(goal: Goal) {
  const createdAt = goal.createdAt instanceof Date ? goal.createdAt : new Date(goal.createdAt);
  return Number.isNaN(createdAt.getTime()) ? 0 : createdAt.getTime();
}

function pickEarliestGoal(goals: Goal[]) {
  return [...goals].sort((a, b) => goalCreatedAt(a) - goalCreatedAt(b))[0] ?? null;
}

export function selectDefaultCompanyGoalId(goals: Goal[]): string | null {
  const companyGoals = goals.filter((goal) => goal.level === "company");
  const rootGoals = companyGoals.filter((goal) => !goal.parentId);
  const activeRootGoals = rootGoals.filter((goal) => goal.status === "active");

  return (
    pickEarliestGoal(activeRootGoals)?.id ??
    pickEarliestGoal(rootGoals)?.id ??
    pickEarliestGoal(companyGoals)?.id ??
    null
  );
}

export function buildOnboardingProjectPayload(
  goalId: string | null,
  options?: {
    name?: string | null;
    mode?: "company" | "codebase";
    workspaceLocalPath?: string;
    workspaceRepoUrl?: string;
  },
) {
  const mode = options?.mode ?? "company";
  const workspaceLocalPath = options?.workspaceLocalPath?.trim() ?? "";
  const workspaceRepoUrl = options?.workspaceRepoUrl?.trim() ?? "";
  const workspaceName = workspaceLocalPath
    ? deriveWorkspaceNameFromPath(workspaceLocalPath)
    : workspaceRepoUrl
      ? deriveWorkspaceNameFromRepo(workspaceRepoUrl)
      : CODEBASE_ONBOARDING_PROJECT_NAME;
  const name =
    options?.name?.trim()
    || (mode === "codebase" ? workspaceName : ONBOARDING_PROJECT_NAME);
  return {
    name,
    status: "in_progress" as const,
    ...(goalId ? { goalIds: [goalId] } : {}),
    ...(
      workspaceLocalPath || workspaceRepoUrl
        ? {
            workspace: {
              name: workspaceName,
              isPrimary: true,
              sourceType: workspaceRepoUrl ? "git_repo" : "local_path",
              ...(workspaceLocalPath ? { cwd: workspaceLocalPath } : {}),
              ...(workspaceRepoUrl ? { repoUrl: workspaceRepoUrl } : {}),
            },
          }
        : {}
    ),
  };
}

export function buildOnboardingIssuePayload(input: {
  title: string;
  description: string;
  assigneeAgentId: string;
  projectId: string;
  goalId: string | null;
}) {
  const title = input.title.trim();
  const description = input.description.trim();

  return {
    title,
    ...(description ? { description } : {}),
    assigneeAgentId: input.assigneeAgentId,
    projectId: input.projectId,
    ...(input.goalId ? { goalId: input.goalId } : {}),
    status: "todo" as const,
  };
}

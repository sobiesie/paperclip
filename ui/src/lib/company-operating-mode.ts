import {
  AGENT_INSTRUCTION_PRESETS,
  type Company,
  type CompanyOperatingMode,
  type Agent,
  type AgentInstructionPreset,
  type Project,
} from "@paperclipai/shared";

export function isCodingInstructionPreset(
  value: string | AgentInstructionPreset | null | undefined,
): value is AgentInstructionPreset {
  return (
    typeof value === "string"
    && AGENT_INSTRUCTION_PRESETS.includes(value as AgentInstructionPreset)
  );
}

export function projectLooksCodebaseConnected(
  project: Pick<Project, "codebase" | "primaryWorkspace" | "workspaces">,
): boolean {
  return Boolean(
    project.codebase.workspaceId
    || project.codebase.repoUrl
    || project.codebase.localFolder
    || project.primaryWorkspace
    || project.workspaces.length > 0
  );
}

export function inferCompanyOperatingMode(input: {
  agents?: Array<Pick<Agent, "instructionPreset">> | null;
  projects?: Array<Pick<Project, "codebase" | "primaryWorkspace" | "workspaces">> | null;
}): CompanyOperatingMode {
  if ((input.projects ?? []).some(projectLooksCodebaseConnected)) {
    return "codebase";
  }

  if ((input.agents ?? []).some((agent) => isCodingInstructionPreset(agent.instructionPreset))) {
    return "codebase";
  }

  return "company";
}

export function resolveCompanyOperatingMode(input: {
  company?: Pick<Company, "operatingMode"> | null;
  agents?: Array<Pick<Agent, "instructionPreset">> | null;
  projects?: Array<Pick<Project, "codebase" | "primaryWorkspace" | "workspaces">> | null;
}): CompanyOperatingMode {
  if (input.company?.operatingMode) {
    return input.company.operatingMode;
  }

  return inferCompanyOperatingMode(input);
}

import { DEFAULT_CODEX_LOCAL_MODEL } from "@paperclipai/adapter-codex-local";
import type { AgentInstructionPreset, AgentRole } from "@paperclipai/shared";
import { getAgentInstructionPresetOption } from "./agent-instruction-presets";
import {
  buildCodingIssueTemplateSeed,
  getCodingIssueTemplateOption,
  type CodingIssueTemplateId,
} from "./coding-issue-templates";

export type OnboardingMode = "company" | "codebase";

export type OnboardingTaskTemplateId =
  | "company_hiring_plan"
  | "company_strategy_breakdown"
  | "codebase_map_first_change"
  | "codebase_refactor"
  | "codebase_review"
  | "codebase_fix_review_findings"
  | "codebase_parallel_implementation";

export interface OnboardingTaskTemplate {
  id: OnboardingTaskTemplateId;
  label: string;
  summary: string;
  title: string;
  description: string;
}

export interface OnboardingModeDefaults {
  agentName: string;
  adapterType: "claude_local" | "codex_local";
  model: string;
  instructionPreset: AgentInstructionPreset | null;
  agentRole: AgentRole;
  agentTitle: string | null;
  agentCapabilities: string | null;
  projectName: string;
  defaultTaskTemplateId: OnboardingTaskTemplateId;
}

const COMPANY_HIRING_PLAN_DESCRIPTION = `You are the CEO. You set the direction for the company.

- hire a founding engineer
- write a hiring plan
- break the roadmap into concrete tasks and start delegating work`;

const COMPANY_STRATEGY_DESCRIPTION = `Set the initial direction for the company.

- define the first concrete milestones
- break the mission into near-term work
- create follow-up tasks with clear owners and sequencing`;

const CODEBASE_MAP_DESCRIPTION = `Start by understanding the codebase and the current highest-leverage work.

- map the main app, services, and workflows
- identify one concrete change worth shipping first
- create follow-up issues if you find cleanly separable next steps
- leave the repo in a reviewable state with clear verification notes`;

function taskTemplate(input: OnboardingTaskTemplate): OnboardingTaskTemplate {
  return input;
}

function codingTemplateTask(
  id: OnboardingTaskTemplateId,
  templateId: CodingIssueTemplateId,
): OnboardingTaskTemplate {
  const option = getCodingIssueTemplateOption(templateId);
  const seed = buildCodingIssueTemplateSeed(templateId);
  return taskTemplate({
    id,
    label: option.label,
    summary: option.description,
    title: seed.title,
    description: seed.description,
  });
}

const TASK_TEMPLATES: Record<OnboardingMode, OnboardingTaskTemplate[]> = {
  company: [
    taskTemplate({
      id: "company_hiring_plan",
      label: "Hiring plan",
      summary: "Start with team formation and the first delegation plan.",
      title: "Hire your first engineer and create a hiring plan",
      description: COMPANY_HIRING_PLAN_DESCRIPTION,
    }),
    taskTemplate({
      id: "company_strategy_breakdown",
      label: "Strategy breakdown",
      summary: "Turn the mission into concrete milestones and first tasks.",
      title: "Write the initial strategy and break it into tasks",
      description: COMPANY_STRATEGY_DESCRIPTION,
    }),
  ],
  codebase: [
    taskTemplate({
      id: "codebase_map_first_change",
      label: "Map codebase",
      summary: "Orient to the repo and pick the first high-leverage change.",
      title: "Map the codebase and pick the first high-leverage change",
      description: CODEBASE_MAP_DESCRIPTION,
    }),
    codingTemplateTask("codebase_refactor", "refactor"),
    codingTemplateTask("codebase_review", "review"),
    codingTemplateTask("codebase_fix_review_findings", "fix_review_findings"),
    codingTemplateTask("codebase_parallel_implementation", "parallel_implementation"),
  ],
};

const COMPANY_DEFAULTS: OnboardingModeDefaults = {
  agentName: "CEO",
  adapterType: "claude_local",
  model: "",
  instructionPreset: null,
  agentRole: "ceo",
  agentTitle: "CEO",
  agentCapabilities: null,
  projectName: "Onboarding",
  defaultTaskTemplateId: "company_hiring_plan",
};

const codebasePreset = getAgentInstructionPresetOption("coding_builder");

const CODEBASE_DEFAULTS: OnboardingModeDefaults = {
  agentName: codebasePreset.defaultName,
  adapterType: "codex_local",
  model: DEFAULT_CODEX_LOCAL_MODEL,
  instructionPreset: codebasePreset.id,
  agentRole: codebasePreset.role,
  agentTitle: codebasePreset.defaultTitle,
  agentCapabilities: codebasePreset.capabilities,
  projectName: "Codebase Setup",
  defaultTaskTemplateId: "codebase_map_first_change",
};

export function getOnboardingModeDefaults(mode: OnboardingMode): OnboardingModeDefaults {
  return mode === "codebase" ? CODEBASE_DEFAULTS : COMPANY_DEFAULTS;
}

export function listOnboardingTaskTemplates(mode: OnboardingMode): OnboardingTaskTemplate[] {
  return TASK_TEMPLATES[mode];
}

export function getOnboardingTaskTemplate(
  mode: OnboardingMode,
  templateId: OnboardingTaskTemplateId,
): OnboardingTaskTemplate {
  const matched = TASK_TEMPLATES[mode].find((template) => template.id === templateId);
  return matched ?? TASK_TEMPLATES[mode][0]!;
}

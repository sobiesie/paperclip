import {
  AGENT_INSTRUCTION_PRESETS,
  AGENT_INSTRUCTION_PRESET_LABELS,
  type AgentInstructionPreset,
  type AgentRole,
} from "@paperclipai/shared";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@paperclipai/adapter-codex-local";
import { defaultCreateValues } from "../components/agent-config-defaults";

export interface AgentInstructionPresetOption {
  id: AgentInstructionPreset;
  label: string;
  description: string;
  role: AgentRole;
  defaultName: string;
  defaultTitle: string;
  capabilities: string;
}

const PRESET_OPTIONS: Record<AgentInstructionPreset, AgentInstructionPresetOption> = {
  coding_builder: {
    id: "coding_builder",
    label: AGENT_INSTRUCTION_PRESET_LABELS.coding_builder,
    description: "Implements code changes, runs focused checks, and hands work off for review.",
    role: "engineer",
    defaultName: "Builder",
    defaultTitle: "Code Builder",
    capabilities: "Implements code changes, refactors, tests, and migration work in isolated repo workspaces.",
  },
  coding_reviewer: {
    id: "coding_reviewer",
    label: AGENT_INSTRUCTION_PRESET_LABELS.coding_reviewer,
    description: "Reviews diffs, looks for regressions, and requests changes or approves.",
    role: "qa",
    defaultName: "Reviewer",
    defaultTitle: "Code Reviewer",
    capabilities: "Performs code review, regression checks, and release-readiness review for active codebase work.",
  },
  coding_fixer: {
    id: "coding_fixer",
    label: AGENT_INSTRUCTION_PRESET_LABELS.coding_fixer,
    description: "Picks up bugs and review feedback and closes the loop quickly.",
    role: "engineer",
    defaultName: "Fixer",
    defaultTitle: "Bug Fixer",
    capabilities: "Fixes regressions, addresses review feedback, and stabilizes in-flight code changes.",
  },
};

export const AGENT_INSTRUCTION_PRESET_OPTIONS = AGENT_INSTRUCTION_PRESETS.map(
  (id) => PRESET_OPTIONS[id],
);

export function isAgentInstructionPreset(
  value: string | null | undefined,
): value is AgentInstructionPreset {
  return typeof value === "string" && AGENT_INSTRUCTION_PRESETS.includes(value as AgentInstructionPreset);
}

export function getAgentInstructionPresetOption(preset: AgentInstructionPreset): AgentInstructionPresetOption {
  return PRESET_OPTIONS[preset];
}

export function buildCreateValuesForInstructionPreset(
  preset: AgentInstructionPreset,
): CreateConfigValues {
  const baseValues: CreateConfigValues = {
    ...defaultCreateValues,
    adapterType: "codex_local",
    model: DEFAULT_CODEX_LOCAL_MODEL,
    thinkingEffort: "high",
    dangerouslyBypassSandbox: DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
    workspaceStrategyType: "git_worktree",
    workspaceBranchTemplate: "{{issue.identifier}}-{{slug}}",
    worktreeParentDir: ".paperclip/worktrees",
    maxTurnsPerRun: preset === "coding_reviewer" ? 180 : 300,
  };
  return baseValues;
}

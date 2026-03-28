import fs from "node:fs/promises";
import { getAgentInstructionPreset } from "./agent-instruction-presets.js";

const DEFAULT_AGENT_BUNDLE_FILES = {
  default: ["AGENTS.md"],
  ceo: ["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"],
  coding_builder: ["AGENTS.md"],
  coding_reviewer: ["AGENTS.md"],
  coding_fixer: ["AGENTS.md"],
} as const;

type DefaultAgentBundleRole = keyof typeof DEFAULT_AGENT_BUNDLE_FILES;

const DEFAULT_AGENT_BUNDLE_DIRECTORIES: Record<DefaultAgentBundleRole, string> = {
  default: "default",
  ceo: "ceo",
  coding_builder: "coding-builder",
  coding_reviewer: "coding-reviewer",
  coding_fixer: "coding-fixer",
};

function resolveDefaultAgentBundleUrl(role: DefaultAgentBundleRole, fileName: string) {
  return new URL(`../onboarding-assets/${DEFAULT_AGENT_BUNDLE_DIRECTORIES[role]}/${fileName}`, import.meta.url);
}

export async function loadDefaultAgentInstructionsBundle(role: DefaultAgentBundleRole): Promise<Record<string, string>> {
  const fileNames = DEFAULT_AGENT_BUNDLE_FILES[role];
  const entries = await Promise.all(
    fileNames.map(async (fileName) => {
      const content = await fs.readFile(resolveDefaultAgentBundleUrl(role, fileName), "utf8");
      return [fileName, content] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export function resolveDefaultAgentInstructionsBundleRole(
  role: string,
  metadata?: unknown,
): DefaultAgentBundleRole {
  if (role === "ceo") return "ceo";

  const instructionPreset = getAgentInstructionPreset(metadata);
  if (instructionPreset && instructionPreset in DEFAULT_AGENT_BUNDLE_FILES) {
    return instructionPreset as DefaultAgentBundleRole;
  }
  return "default";
}

import { AGENT_INSTRUCTION_PRESETS, type AgentInstructionPreset } from "@paperclipai/shared";

const AGENT_INSTRUCTION_PRESET_SET = new Set<string>(AGENT_INSTRUCTION_PRESETS);
const PAPERCLIP_METADATA_KEY = "paperclip";
const INSTRUCTION_PRESET_KEY = "instructionPreset";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeInstructionPreset(value: unknown): AgentInstructionPreset | null {
  if (typeof value !== "string") return null;
  return AGENT_INSTRUCTION_PRESET_SET.has(value)
    ? (value as AgentInstructionPreset)
    : null;
}

export function getAgentInstructionPreset(metadata: unknown): AgentInstructionPreset | null {
  if (!isPlainRecord(metadata)) return null;

  const scopedValue = isPlainRecord(metadata[PAPERCLIP_METADATA_KEY])
    ? normalizeInstructionPreset(metadata[PAPERCLIP_METADATA_KEY][INSTRUCTION_PRESET_KEY])
    : null;
  if (scopedValue) return scopedValue;

  return normalizeInstructionPreset(metadata[INSTRUCTION_PRESET_KEY]);
}

export function applyAgentInstructionPresetMetadata(
  metadata: unknown,
  instructionPreset: AgentInstructionPreset | null | undefined,
): Record<string, unknown> | null {
  const baseMetadata = isPlainRecord(metadata) ? { ...metadata } : {};
  const nextPaperclipMetadata = isPlainRecord(baseMetadata[PAPERCLIP_METADATA_KEY])
    ? { ...(baseMetadata[PAPERCLIP_METADATA_KEY] as Record<string, unknown>) }
    : {};

  if (instructionPreset) {
    nextPaperclipMetadata[INSTRUCTION_PRESET_KEY] = instructionPreset;
  } else {
    delete nextPaperclipMetadata[INSTRUCTION_PRESET_KEY];
  }

  if (Object.keys(nextPaperclipMetadata).length > 0) {
    baseMetadata[PAPERCLIP_METADATA_KEY] = nextPaperclipMetadata;
  } else {
    delete baseMetadata[PAPERCLIP_METADATA_KEY];
  }

  return Object.keys(baseMetadata).length > 0 ? baseMetadata : null;
}

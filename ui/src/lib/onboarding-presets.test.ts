import { describe, expect, it } from "vitest";
import {
  getOnboardingModeDefaults,
  getOnboardingTaskTemplate,
  listOnboardingTaskTemplates,
} from "./onboarding-presets";

describe("onboarding presets", () => {
  it("keeps company onboarding CEO-oriented by default", () => {
    expect(getOnboardingModeDefaults("company")).toMatchObject({
      agentName: "CEO",
      adapterType: "claude_local",
      agentRole: "ceo",
      instructionPreset: null,
      projectName: "Onboarding",
      defaultTaskTemplateId: "company_hiring_plan",
    });
  });

  it("switches codebase onboarding to the coding builder preset", () => {
    expect(getOnboardingModeDefaults("codebase")).toMatchObject({
      agentName: "Builder",
      adapterType: "codex_local",
      agentRole: "engineer",
      instructionPreset: "coding_builder",
      projectName: "Codebase Setup",
      defaultTaskTemplateId: "codebase_map_first_change",
    });
  });

  it("exposes codebase starter templates for review and fix loops", () => {
    expect(listOnboardingTaskTemplates("codebase").map((template) => template.id)).toEqual([
      "codebase_map_first_change",
      "codebase_refactor",
      "codebase_review",
      "codebase_fix_review_findings",
      "codebase_parallel_implementation",
    ]);

    expect(getOnboardingTaskTemplate("codebase", "codebase_review")).toMatchObject({
      label: "Review",
      summary: expect.stringContaining("review"),
      title: "Review: <change or PR>",
    });
  });
});

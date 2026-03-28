import { describe, expect, it } from "vitest";
import type { Agent, Project } from "@paperclipai/shared";
import {
  inferCompanyOperatingMode,
  isCodingInstructionPreset,
  projectLooksCodebaseConnected,
  resolveCompanyOperatingMode,
} from "./company-operating-mode";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    companyId: "company-1",
    name: "Agent",
    urlKey: "agent",
    role: "general",
    title: null,
    icon: null,
    status: "active",
    reportsTo: null,
    capabilities: null,
    adapterType: "claude_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    instructionPreset: null,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: true },
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z"),
    updatedAt: new Date("2026-03-28T00:00:00.000Z"),
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    companyId: "company-1",
    urlKey: "project-1",
    goalId: null,
    goalIds: [],
    goals: [],
    name: "Project",
    description: null,
    status: "planned",
    leadAgentId: null,
    targetDate: null,
    color: null,
    pauseReason: null,
    pausedAt: null,
    executionWorkspacePolicy: null,
    codebase: {
      workspaceId: null,
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
      repoName: null,
      localFolder: null,
      managedFolder: "/tmp/paperclip/project-1",
      effectiveLocalFolder: "/tmp/paperclip/project-1",
      origin: "managed_checkout",
    },
    workspaces: [],
    primaryWorkspace: null,
    archivedAt: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z"),
    updatedAt: new Date("2026-03-28T00:00:00.000Z"),
    ...overrides,
  };
}

describe("company operating mode", () => {
  it("treats coding presets as a codebase signal", () => {
    expect(isCodingInstructionPreset("coding_builder")).toBe(true);
    expect(isCodingInstructionPreset("ceo")).toBe(false);
    expect(isCodingInstructionPreset(null)).toBe(false);
  });

  it("recognizes projects with a linked workspace as codebase-connected", () => {
    expect(
      projectLooksCodebaseConnected(
        makeProject({
          codebase: {
            workspaceId: "workspace-1",
            repoUrl: null,
            repoRef: null,
            defaultRef: null,
            repoName: null,
            localFolder: null,
            managedFolder: "/tmp/paperclip/project-1",
            effectiveLocalFolder: "/tmp/paperclip/project-1",
            origin: "managed_checkout",
          },
        }),
      ),
    ).toBe(true);
  });

  it("defaults to company mode without codebase signals", () => {
    expect(
      inferCompanyOperatingMode({
        agents: [makeAgent()],
        projects: [makeProject()],
      }),
    ).toBe("company");
  });

  it("switches to codebase mode when a project has codebase metadata", () => {
    expect(
      inferCompanyOperatingMode({
        projects: [
          makeProject({
            codebase: {
              workspaceId: null,
              repoUrl: "https://github.com/paperclipai/paperclip",
              repoRef: "main",
              defaultRef: "main",
              repoName: "paperclip",
              localFolder: null,
              managedFolder: "/tmp/paperclip/project-1",
              effectiveLocalFolder: "/tmp/paperclip/project-1",
              origin: "managed_checkout",
            },
          }),
        ],
      }),
    ).toBe("codebase");
  });

  it("switches to codebase mode when an agent uses a coding preset", () => {
    expect(
      inferCompanyOperatingMode({
        agents: [makeAgent({ instructionPreset: "coding_reviewer" })],
      }),
    ).toBe("codebase");
  });

  it("prefers a persisted company operating mode over heuristics", () => {
    expect(
      resolveCompanyOperatingMode({
        company: { operatingMode: "codebase" },
        agents: [makeAgent()],
        projects: [makeProject()],
      }),
    ).toBe("codebase");
  });
});

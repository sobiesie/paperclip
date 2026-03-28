import { describe, expect, it } from "vitest";
import {
  deriveWorkspaceNameFromPath,
  deriveWorkspaceNameFromRepo,
  isAbsoluteLocalPath,
  isGitHubRepoUrl,
} from "./project-workspace-input";

describe("project workspace input helpers", () => {
  it("recognizes unix and windows absolute paths", () => {
    expect(isAbsoluteLocalPath("/Users/me/repo")).toBe(true);
    expect(isAbsoluteLocalPath("C:\\Users\\me\\repo")).toBe(true);
    expect(isAbsoluteLocalPath("./repo")).toBe(false);
  });

  it("accepts GitHub repo URLs and rejects other hosts", () => {
    expect(isGitHubRepoUrl("https://github.com/paperclipai/paperclip")).toBe(true);
    expect(isGitHubRepoUrl("https://github.com/paperclipai/paperclip.git")).toBe(true);
    expect(isGitHubRepoUrl("https://gitlab.com/paperclipai/paperclip")).toBe(false);
  });

  it("derives workspace names from local paths and repo urls", () => {
    expect(deriveWorkspaceNameFromPath("/Users/me/src/paperclip/")).toBe("paperclip");
    expect(deriveWorkspaceNameFromRepo("https://github.com/paperclipai/paperclip.git")).toBe("paperclip");
  });
});

import { describe, expect, it } from "vitest";
import type { PaperclipPluginManifestV1 } from "@paperclipai/shared";
import { createTestHarness } from "./testing.js";

const manifest: PaperclipPluginManifestV1 = {
  id: "test.work-products",
  apiVersion: 1,
  version: "1.0.0",
  displayName: "Test Work Products",
  description: "Test manifest for plugin SDK work products",
  author: "Paperclip",
  categories: ["automation"],
  capabilities: ["issues.create", "issues.read", "issues.update"],
  entrypoints: {
    worker: "dist/worker.js",
  },
};

describe("createTestHarness issue work products", () => {
  it("creates, lists, updates, and deletes issue work products", async () => {
    const harness = createTestHarness({ manifest });
    const issue = await harness.ctx.issues.create({
      companyId: "company-1",
      title: "Add coding sync",
      projectId: "project-1",
    });

    const created = await harness.ctx.issues.workProducts.create(issue.id, {
      type: "pull_request",
      provider: "github",
      title: "PR #12",
      status: "draft",
      reviewState: "none",
      isPrimary: false,
      healthStatus: "unknown",
    }, issue.companyId);

    expect(created.issueId).toBe(issue.id);
    expect(created.projectId).toBe("project-1");
    expect(created.status).toBe("draft");

    const listed = await harness.ctx.issues.workProducts.list(issue.id, issue.companyId);
    expect(listed.map((item) => item.id)).toEqual([created.id]);

    const updated = await harness.ctx.issues.workProducts.update(created.id, {
      status: "ready_for_review",
      reviewState: "needs_board_review",
    }, issue.companyId);
    expect(updated.status).toBe("ready_for_review");
    expect(updated.reviewState).toBe("needs_board_review");

    const removed = await harness.ctx.issues.workProducts.delete(created.id, issue.companyId);
    expect(removed.id).toBe(created.id);
    await expect(harness.ctx.issues.workProducts.list(issue.id, issue.companyId)).resolves.toEqual([]);
  });

  it("keeps only one primary work product per issue and type", async () => {
    const harness = createTestHarness({ manifest });
    const issue = await harness.ctx.issues.create({
      companyId: "company-1",
      title: "Track PRs",
    });

    const first = await harness.ctx.issues.workProducts.create(issue.id, {
      type: "pull_request",
      provider: "github",
      title: "PR #1",
      status: "active",
      reviewState: "none",
      isPrimary: true,
      healthStatus: "unknown",
    }, issue.companyId);

    const second = await harness.ctx.issues.workProducts.create(issue.id, {
      type: "pull_request",
      provider: "github",
      title: "PR #2",
      status: "active",
      reviewState: "none",
      isPrimary: true,
      healthStatus: "unknown",
    }, issue.companyId);

    const listed = await harness.ctx.issues.workProducts.list(issue.id, issue.companyId);

    expect(listed.map((item) => item.id)).toEqual([second.id, first.id]);
    expect(listed[0]?.isPrimary).toBe(true);
    expect(listed[1]?.isPrimary).toBe(false);
  });
});

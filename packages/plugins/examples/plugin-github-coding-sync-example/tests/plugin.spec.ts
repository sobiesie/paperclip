import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { ENTITY_TYPES, WEBHOOK_KEYS } from "../src/constants.js";

describe("github coding sync example", () => {
  it("indexes pull request work products and syncs approved reviews", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: [...manifest.capabilities, "issues.create"],
    });
    await plugin.definition.setup(harness.ctx);

    const issue = await harness.ctx.issues.create({
      companyId: "company-1",
      title: "Sync GitHub review",
    });
    const workProduct = await harness.ctx.issues.workProducts.create(issue.id, {
      type: "pull_request",
      provider: "github",
      title: "PR #12",
      url: "https://github.com/acme/repo/pull/12",
      externalId: "PR_node_12",
      status: "active",
      reviewState: "none",
      isPrimary: true,
      healthStatus: "unknown",
      metadata: {
        githubRepoFullName: "acme/repo",
        githubPullRequestNumber: 12,
        githubNodeId: "PR_node_12",
      },
    }, issue.companyId);

    await harness.emit(
      "issue.work_product_created",
      {
        workProductId: workProduct.id,
        type: workProduct.type,
        provider: workProduct.provider,
      },
      {
        companyId: issue.companyId,
        entityId: issue.id,
        entityType: "issue",
      },
    );

    const mappings = await harness.ctx.entities.list({
      entityType: ENTITY_TYPES.pullRequestNodeId,
      externalId: "PR_node_12",
    });
    expect(mappings).toHaveLength(1);

    const payload = {
      action: "submitted",
      repository: {
        full_name: "acme/repo",
      },
      pull_request: {
        id: 101,
        node_id: "PR_node_12",
        number: 12,
        html_url: "https://github.com/acme/repo/pull/12",
        title: "PR #12",
        head: {
          sha: "abc123",
        },
      },
      review: {
        state: "approved",
      },
    };

    await plugin.definition.onWebhook?.({
      endpointKey: WEBHOOK_KEYS.github,
      headers: {
        "x-github-event": "pull_request_review",
      },
      rawBody: JSON.stringify(payload),
      parsedBody: payload,
      requestId: "req-1",
    });

    const [updated] = await harness.ctx.issues.workProducts.list(issue.id, issue.companyId);
    expect(updated?.status).toBe("approved");
    expect(updated?.reviewState).toBe("approved");
    expect(updated?.metadata).toMatchObject({
      githubRepoFullName: "acme/repo",
      githubPullRequestNumber: 12,
      githubPullRequestId: 101,
      githubNodeId: "PR_node_12",
      lastGithubEvent: "pull_request_review",
      lastGithubReviewState: "approved",
    });
  });

  it("verifies the GitHub webhook signature when configured", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: [...manifest.capabilities, "issues.create"],
      config: {
        webhookSecretRef: "github-secret",
      },
    });
    await plugin.definition.setup(harness.ctx);

    const issue = await harness.ctx.issues.create({
      companyId: "company-1",
      title: "Require signatures",
    });
    const workProduct = await harness.ctx.issues.workProducts.create(issue.id, {
      type: "pull_request",
      provider: "github",
      title: "PR #15",
      url: "https://github.com/acme/repo/pull/15",
      externalId: "PR_node_15",
      status: "active",
      reviewState: "none",
      isPrimary: true,
      healthStatus: "unknown",
      metadata: {
        githubRepoFullName: "acme/repo",
        githubPullRequestNumber: 15,
        githubNodeId: "PR_node_15",
      },
    }, issue.companyId);

    await harness.emit(
      "issue.work_product_created",
      {
        workProductId: workProduct.id,
        type: workProduct.type,
        provider: workProduct.provider,
      },
      {
        companyId: issue.companyId,
        entityId: issue.id,
        entityType: "issue",
      },
    );

    const payload = {
      action: "ready_for_review",
      number: 15,
      repository: {
        full_name: "acme/repo",
      },
      pull_request: {
        id: 115,
        node_id: "PR_node_15",
        number: 15,
        html_url: "https://github.com/acme/repo/pull/15",
        title: "PR #15",
        merged: false,
        head: {
          sha: "def456",
        },
      },
    };
    const rawBody = JSON.stringify(payload);
    const validSignature = `sha256=${createHmac("sha256", "resolved:github-secret").update(rawBody).digest("hex")}`;

    await expect(plugin.definition.onWebhook?.({
      endpointKey: WEBHOOK_KEYS.github,
      headers: {
        "x-github-event": "pull_request",
        "x-hub-signature-256": "sha256=deadbeef",
      },
      rawBody,
      parsedBody: payload,
      requestId: "req-2",
    })).rejects.toThrow("GitHub webhook signature verification failed");

    await plugin.definition.onWebhook?.({
      endpointKey: WEBHOOK_KEYS.github,
      headers: {
        "x-github-event": "pull_request",
        "x-hub-signature-256": validSignature,
      },
      rawBody,
      parsedBody: payload,
      requestId: "req-3",
    });

    const [updated] = await harness.ctx.issues.workProducts.list(issue.id, issue.companyId);
    expect(updated?.status).toBe("ready_for_review");
    expect(updated?.reviewState).toBe("needs_board_review");
    expect(updated?.metadata).toMatchObject({
      githubRepoFullName: "acme/repo",
      githubPullRequestNumber: 15,
      githubPullRequestId: 115,
      githubNodeId: "PR_node_15",
      githubState: null,
      lastGithubEvent: "pull_request",
      lastGithubAction: "ready_for_review",
    });
  });
});

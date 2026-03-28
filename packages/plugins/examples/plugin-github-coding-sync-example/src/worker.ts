import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  definePlugin,
  runWorker,
  type PluginContext,
  type PluginEntityRecord,
  type PluginEvent,
  type PluginHealthDiagnostics,
  type PluginWebhookInput,
} from "@paperclipai/plugin-sdk";
import type { IssueWorkProduct, UpdateIssueWorkProduct } from "@paperclipai/shared";
import { ENTITY_TYPES, WEBHOOK_KEY } from "./constants.js";

const PAGE_SIZE = 200;

type GithubCodingSyncConfig = {
  webhookSecretRef?: string;
  allowedRepositories: string[];
};

type GithubPullRequest = {
  id?: number;
  node_id?: string;
  number?: number;
  title?: string;
  html_url?: string;
  body?: string | null;
  draft?: boolean;
  merged?: boolean;
  state?: string;
  head?: { ref?: string };
  base?: { ref?: string };
};

type GithubRepository = {
  full_name?: string;
};

type GithubPullRequestPayload = {
  action?: string;
  repository?: GithubRepository;
  pull_request?: GithubPullRequest;
};

type GithubPullRequestReviewPayload = {
  action?: string;
  repository?: GithubRepository;
  pull_request?: GithubPullRequest;
  review?: {
    state?: string;
    html_url?: string;
    body?: string | null;
    submitted_at?: string;
  };
};

type TrackingReference = {
  entityType: (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];
  externalId: string;
};

type TrackedPullRequest = {
  companyId: string;
  issueId: string;
  workProductId: string;
};

type PullRequestIdentity = {
  repoFullName: string | null;
  pullRequestNumber: number | null;
  pullRequestId: number | null;
  pullRequestNodeId: string | null;
  trackingReferences: TrackingReference[];
};

const stats = {
  indexedMappings: 0,
  handledWebhooks: 0,
  matchedWebhooks: 0,
  unmatchedWebhooks: 0,
  lastEventType: null as string | null,
  lastWebhookAt: null as string | null,
  lastError: null as string | null,
};

let currentContext: PluginContext | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function summarizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeRepositoryName(repository: string | null): string | null {
  return repository ? repository.trim().toLowerCase() : null;
}

function getHeader(headers: Record<string, string | string[]>, name: string): string | null {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    if (Array.isArray(value)) return readString(value[0]);
    return readString(value);
  }
  return null;
}

function parseGithubPullRequestUrl(url: string | null): { repoFullName: string; pullRequestNumber: number } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length < 4 || parts[2] !== "pull") return null;
    const pullRequestNumber = readNumber(parts[3]);
    if (!pullRequestNumber) return null;
    return {
      repoFullName: `${parts[0]}/${parts[1]}`.toLowerCase(),
      pullRequestNumber,
    };
  } catch {
    return null;
  }
}

function buildRepoNumberExternalId(repoFullName: string, pullRequestNumber: number): string {
  return `${repoFullName}#${pullRequestNumber}`;
}

function buildTrackingReferences(input: {
  repoFullName: string | null;
  pullRequestNumber: number | null;
  pullRequestId: number | null;
  pullRequestNodeId: string | null;
}): TrackingReference[] {
  const references: TrackingReference[] = [];
  if (input.pullRequestId != null) {
    references.push({
      entityType: ENTITY_TYPES.pullRequestId,
      externalId: String(input.pullRequestId),
    });
  }
  if (input.pullRequestNodeId) {
    references.push({
      entityType: ENTITY_TYPES.pullRequestNodeId,
      externalId: input.pullRequestNodeId,
    });
  }
  if (input.repoFullName && input.pullRequestNumber != null) {
    references.push({
      entityType: ENTITY_TYPES.pullRequestRepoNumber,
      externalId: buildRepoNumberExternalId(input.repoFullName, input.pullRequestNumber),
    });
  }
  return references;
}

function getPullRequestIdentityFromWorkProduct(workProduct: IssueWorkProduct): PullRequestIdentity | null {
  if (workProduct.type !== "pull_request") return null;

  const metadata = asRecord(workProduct.metadata);
  const parsedUrl = parseGithubPullRequestUrl(workProduct.url);
  const repoFullName = normalizeRepositoryName(
    readString(metadata?.githubRepoFullName) ?? parsedUrl?.repoFullName ?? null,
  );
  const pullRequestNumber =
    readNumber(metadata?.githubPullRequestNumber) ?? parsedUrl?.pullRequestNumber ?? null;
  const externalId = readString(workProduct.externalId);
  const pullRequestId =
    readNumber(metadata?.githubPullRequestId) ?? (externalId && /^\d+$/.test(externalId) ? Number(externalId) : null);
  const pullRequestNodeId =
    readString(metadata?.githubNodeId) ?? (externalId && !/^\d+$/.test(externalId) ? externalId : null);
  const trackingReferences = buildTrackingReferences({
    repoFullName,
    pullRequestNumber,
    pullRequestId,
    pullRequestNodeId,
  });

  if (trackingReferences.length === 0) return null;
  return {
    repoFullName,
    pullRequestNumber,
    pullRequestId,
    pullRequestNodeId,
    trackingReferences,
  };
}

function getPullRequestIdentityFromWebhook(
  pullRequest: GithubPullRequest | undefined,
  repository: GithubRepository | undefined,
): PullRequestIdentity | null {
  if (!pullRequest) return null;
  const repoFullName = normalizeRepositoryName(readString(repository?.full_name));
  const pullRequestNumber = readNumber(pullRequest.number);
  const pullRequestId = readNumber(pullRequest.id);
  const pullRequestNodeId = readString(pullRequest.node_id);
  const trackingReferences = buildTrackingReferences({
    repoFullName,
    pullRequestNumber,
    pullRequestId,
    pullRequestNodeId,
  });
  if (trackingReferences.length === 0) return null;
  return {
    repoFullName,
    pullRequestNumber,
    pullRequestId,
    pullRequestNodeId,
    trackingReferences,
  };
}

async function getConfig(ctx: PluginContext): Promise<GithubCodingSyncConfig> {
  const config = await ctx.config.get();
  const rawAllowedRepositories = Array.isArray(config.allowedRepositories)
    ? config.allowedRepositories
    : [];
  return {
    webhookSecretRef: readString(config.webhookSecretRef) ?? undefined,
    allowedRepositories: rawAllowedRepositories
      .map((value) => normalizeRepositoryName(readString(value)) ?? "")
      .filter((value) => value.length > 0),
  };
}

async function verifyGithubWebhookSignature(
  ctx: PluginContext,
  input: PluginWebhookInput,
  config: GithubCodingSyncConfig,
): Promise<void> {
  if (!config.webhookSecretRef) return;

  const provided = getHeader(input.headers, "x-hub-signature-256");
  if (!provided?.startsWith("sha256=")) {
    throw new Error("Missing GitHub x-hub-signature-256 header");
  }

  const secret = await ctx.secrets.resolve(config.webhookSecretRef);
  const expected = createHmac("sha256", secret)
    .update(input.rawBody, "utf8")
    .digest("hex");
  const providedDigest = provided.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(providedDigest, "utf8");

  if (
    expectedBuffer.length !== providedBuffer.length
    || !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new Error("GitHub webhook signature verification failed");
  }
}

async function listAllCompanies(ctx: PluginContext): Promise<Array<{ id: string }>> {
  const companies: Array<{ id: string }> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await ctx.companies.list({ limit: PAGE_SIZE, offset });
    companies.push(...page.map((company) => ({ id: company.id })));
    if (page.length < PAGE_SIZE) break;
  }
  return companies;
}

async function listAllIssues(ctx: PluginContext, companyId: string): Promise<Array<{ id: string }>> {
  const issues: Array<{ id: string }> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await ctx.issues.list({ companyId, limit: PAGE_SIZE, offset });
    issues.push(...page.map((issue) => ({ id: issue.id })));
    if (page.length < PAGE_SIZE) break;
  }
  return issues;
}

async function indexPullRequestWorkProductsForIssue(
  ctx: PluginContext,
  companyId: string,
  issueId: string,
): Promise<void> {
  const workProducts = await ctx.issues.workProducts.list(issueId, companyId);
  for (const workProduct of workProducts) {
    const identity = getPullRequestIdentityFromWorkProduct(workProduct);
    if (!identity) continue;
    for (const reference of identity.trackingReferences) {
      await ctx.entities.upsert({
        entityType: reference.entityType,
        scopeKind: "issue",
        scopeId: issueId,
        externalId: reference.externalId,
        title: workProduct.title,
        status: workProduct.status,
        data: {
          companyId,
          issueId,
          workProductId: workProduct.id,
          repoFullName: identity.repoFullName,
          pullRequestNumber: identity.pullRequestNumber,
          githubPullRequestId: identity.pullRequestId,
          githubNodeId: identity.pullRequestNodeId,
          url: workProduct.url,
        },
      });
      stats.indexedMappings += 1;
    }
  }
}

async function reindexTrackedPullRequests(ctx: PluginContext): Promise<void> {
  const companies = await listAllCompanies(ctx);
  for (const company of companies) {
    const issues = await listAllIssues(ctx, company.id);
    for (const issue of issues) {
      await indexPullRequestWorkProductsForIssue(ctx, company.id, issue.id);
    }
  }
}

async function markDeletedMappings(
  ctx: PluginContext,
  issueId: string,
  workProductId: string,
): Promise<void> {
  const records = await ctx.entities.list({
    scopeKind: "issue",
    scopeId: issueId,
    limit: 100,
  });
  for (const record of records) {
    const data = asRecord(record.data);
    if (readString(data?.workProductId) !== workProductId) continue;
    await ctx.entities.upsert({
      entityType: record.entityType,
      scopeKind: record.scopeKind,
      scopeId: record.scopeId ?? undefined,
      externalId: record.externalId ?? undefined,
      title: record.title ?? "Deleted GitHub PR mapping",
      status: "deleted",
      data: {
        ...(data ?? {}),
        deleted: true,
      },
    });
  }
}

async function findTrackedPullRequest(
  ctx: PluginContext,
  identity: PullRequestIdentity | null,
): Promise<TrackedPullRequest | null> {
  if (!identity) return null;

  for (const reference of identity.trackingReferences) {
    const records = await ctx.entities.list({
      entityType: reference.entityType,
      externalId: reference.externalId,
      limit: 1,
    });
    const record = records[0];
    if (!record) continue;
    const tracked = getTrackedPullRequestFromEntity(record);
    if (tracked) return tracked;
  }

  return null;
}

function getTrackedPullRequestFromEntity(record: PluginEntityRecord): TrackedPullRequest | null {
  const data = asRecord(record.data);
  const companyId = readString(data?.companyId);
  const issueId = readString(data?.issueId);
  const workProductId = readString(data?.workProductId);
  if (!companyId || !issueId || !workProductId) return null;
  return { companyId, issueId, workProductId };
}

function buildPullRequestPatch(payload: GithubPullRequestPayload): UpdateIssueWorkProduct | null {
  const pullRequest = payload.pull_request;
  if (!pullRequest) return null;

  const repoFullName = normalizeRepositoryName(readString(payload.repository?.full_name));
  const patch: UpdateIssueWorkProduct = {
    ...(pullRequest.title ? { title: pullRequest.title } : {}),
    ...(pullRequest.html_url ? { url: pullRequest.html_url } : {}),
    ...(pullRequest.id != null
      ? { externalId: String(pullRequest.id) }
      : pullRequest.node_id
        ? { externalId: pullRequest.node_id }
        : {}),
    metadata: {
      githubRepoFullName: repoFullName,
      githubPullRequestNumber: readNumber(pullRequest.number),
      githubPullRequestId: readNumber(pullRequest.id),
      githubNodeId: readString(pullRequest.node_id),
      githubHeadRef: readString(pullRequest.head?.ref),
      githubBaseRef: readString(pullRequest.base?.ref),
      githubState: readString(pullRequest.state),
      githubMerged: pullRequest.merged === true,
      githubDraft: pullRequest.draft === true,
      lastGithubEvent: "pull_request",
      lastGithubAction: readString(payload.action),
    },
  };

  if (pullRequest.merged === true) {
    patch.status = "merged";
    patch.reviewState = "approved";
    return patch;
  }

  if (payload.action === "closed") {
    patch.status = "closed";
    patch.reviewState = "none";
    return patch;
  }

  if (pullRequest.draft === true || payload.action === "converted_to_draft") {
    patch.status = "draft";
    patch.reviewState = "none";
    return patch;
  }

  if (payload.action === "ready_for_review") {
    patch.status = "ready_for_review";
    patch.reviewState = "needs_board_review";
    return patch;
  }

  if (
    payload.action === "opened"
    || payload.action === "reopened"
    || payload.action === "synchronize"
  ) {
    patch.status = "active";
    patch.reviewState = "none";
  }

  return patch;
}

function buildPullRequestReviewPatch(payload: GithubPullRequestReviewPayload): UpdateIssueWorkProduct | null {
  const review = asRecord(payload.review);
  if (!review) return null;

  const state = readString(review.state)?.toLowerCase() ?? null;
  const patch: UpdateIssueWorkProduct = {
    metadata: {
      githubRepoFullName: normalizeRepositoryName(readString(payload.repository?.full_name)),
      githubPullRequestNumber: readNumber(payload.pull_request?.number),
      githubPullRequestId: readNumber(payload.pull_request?.id),
      githubNodeId: readString(payload.pull_request?.node_id),
      lastGithubEvent: "pull_request_review",
      lastGithubAction: readString(payload.action),
      lastGithubReviewState: state,
      lastGithubReviewUrl: readString(review.html_url),
      lastGithubReviewedAt: readString(review.submitted_at),
    },
  };

  if (state === "approved") {
    patch.status = "approved";
    patch.reviewState = "approved";
  } else if (state === "changes_requested") {
    patch.status = "changes_requested";
    patch.reviewState = "changes_requested";
  }

  return patch;
}

async function handleWorkProductEvent(ctx: PluginContext, event: PluginEvent): Promise<void> {
  if (event.entityType !== "issue" || !event.entityId || !event.companyId) return;

  if (event.eventType === "issue.work_product_deleted") {
    const payload = asRecord(event.payload);
    const workProductId = readString(payload?.workProductId);
    if (workProductId) {
      await markDeletedMappings(ctx, event.entityId, workProductId);
    }
    return;
  }

  await indexPullRequestWorkProductsForIssue(ctx, event.companyId, event.entityId);
}

async function handleGithubWebhook(input: PluginWebhookInput): Promise<void> {
  const ctx = currentContext;
  if (!ctx) throw new Error("Plugin context has not been initialized");
  if (input.endpointKey !== WEBHOOK_KEY) {
    throw new Error(`Unsupported webhook endpoint "${input.endpointKey}"`);
  }

  const config = await getConfig(ctx);
  await verifyGithubWebhookSignature(ctx, input, config);

  const eventType = getHeader(input.headers, "x-github-event");
  if (!eventType) throw new Error("Missing x-github-event header");

  stats.handledWebhooks += 1;
  stats.lastEventType = eventType;
  stats.lastWebhookAt = new Date().toISOString();

  if (eventType === "pull_request") {
    const payload = asRecord(input.parsedBody) as GithubPullRequestPayload | null;
    const repoFullName = normalizeRepositoryName(readString(payload?.repository?.full_name));
    if (config.allowedRepositories.length > 0 && repoFullName && !config.allowedRepositories.includes(repoFullName)) {
      ctx.logger.info("Ignoring GitHub webhook for non-allowed repository", { eventType, repoFullName });
      return;
    }
    const tracked = await findTrackedPullRequest(
      ctx,
      getPullRequestIdentityFromWebhook(payload?.pull_request, payload?.repository),
    );
    if (!tracked) {
      stats.unmatchedWebhooks += 1;
      ctx.logger.info("No tracked Paperclip work product matched GitHub pull_request webhook", {
        repoFullName,
        pullRequestId: payload?.pull_request?.id,
        pullRequestNumber: payload?.pull_request?.number,
      });
      return;
    }

    const patch = buildPullRequestPatch(payload ?? {});
    if (!patch) return;
    await ctx.issues.workProducts.update(tracked.workProductId, patch, tracked.companyId);
    stats.matchedWebhooks += 1;
    return;
  }

  if (eventType === "pull_request_review") {
    const payload = asRecord(input.parsedBody) as GithubPullRequestReviewPayload | null;
    const repoFullName = normalizeRepositoryName(readString(payload?.repository?.full_name));
    if (config.allowedRepositories.length > 0 && repoFullName && !config.allowedRepositories.includes(repoFullName)) {
      ctx.logger.info("Ignoring GitHub review webhook for non-allowed repository", { eventType, repoFullName });
      return;
    }
    const tracked = await findTrackedPullRequest(
      ctx,
      getPullRequestIdentityFromWebhook(payload?.pull_request, payload?.repository),
    );
    if (!tracked) {
      stats.unmatchedWebhooks += 1;
      ctx.logger.info("No tracked Paperclip work product matched GitHub pull_request_review webhook", {
        repoFullName,
        pullRequestId: payload?.pull_request?.id,
        pullRequestNumber: payload?.pull_request?.number,
      });
      return;
    }

    const patch = buildPullRequestReviewPatch(payload ?? {});
    if (!patch) return;
    await ctx.issues.workProducts.update(tracked.workProductId, patch, tracked.companyId);
    stats.matchedWebhooks += 1;
    return;
  }

  ctx.logger.debug("Ignoring unsupported GitHub webhook event", { eventType });
}

const plugin = definePlugin({
  async setup(ctx) {
    currentContext = ctx;
    ctx.logger.info("github coding sync plugin setup");

    ctx.events.on("issue.work_product_created", async (event) => {
      await handleWorkProductEvent(ctx, event);
    });

    ctx.events.on("issue.work_product_updated", async (event) => {
      await handleWorkProductEvent(ctx, event);
    });

    ctx.events.on("issue.work_product_deleted", async (event) => {
      await handleWorkProductEvent(ctx, event);
    });

    await reindexTrackedPullRequests(ctx).catch((error) => {
      stats.lastError = summarizeError(error);
      ctx.logger.warn("Initial GitHub pull request reindex failed", { error: stats.lastError });
    });
  },

  async onWebhook(input) {
    try {
      await handleGithubWebhook(input);
    } catch (error) {
      stats.lastError = summarizeError(error);
      throw error;
    }
  },

  async onHealth(): Promise<PluginHealthDiagnostics> {
    return {
      status: stats.lastError ? "degraded" : "ok",
      message: stats.lastError ? "GitHub coding sync worker has recent errors" : "GitHub coding sync worker ready",
      details: { ...stats },
    };
  },

  async onShutdown() {
    currentContext = null;
  },
});

export default plugin;
runWorker(plugin, import.meta.url);

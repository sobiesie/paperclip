import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
  addComment: vi.fn(),
  findMentionedAgents: vi.fn(),
}));

const mockWorkProductService = vi.hoisted(() => ({
  listForIssue: vi.fn(),
  update: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn(async () => undefined),
  reportRunActivity: vi.fn(async () => undefined),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  goalService: () => ({}),
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => ({}),
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  projectService: () => ({}),
  routineService: () => ({
    syncRunStatusForIssue: vi.fn(async () => undefined),
  }),
  workProductService: () => mockWorkProductService,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

function makeIssue(status: string) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "company-1",
    status,
    assigneeAgentId: "22222222-2222-4222-8222-222222222222",
    assigneeUserId: null,
    createdByUserId: "local-board",
    identifier: "PAP-580",
    title: "Comment reopen default",
  };
}

function makeWorkProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "work-product-1",
    companyId: "company-1",
    issueId: "11111111-1111-4111-8111-111111111111",
    projectId: null,
    executionWorkspaceId: null,
    runtimeServiceId: null,
    type: "pull_request",
    provider: "github",
    externalId: null,
    title: "PR 1",
    url: "https://example.com/pr/1",
    status: "active",
    reviewState: "none",
    isPrimary: true,
    healthStatus: "unknown",
    summary: null,
    metadata: null,
    createdByRunId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("issue comment reopen routes", () => {
  let workProducts: Array<ReturnType<typeof makeWorkProduct>> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    workProducts = [];
    mockIssueService.addComment.mockResolvedValue({
      id: "comment-1",
      issueId: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      body: "hello",
      createdAt: new Date(),
      updatedAt: new Date(),
      authorAgentId: null,
      authorUserId: "local-board",
    });
    mockIssueService.findMentionedAgents.mockResolvedValue([]);
    mockWorkProductService.listForIssue.mockImplementation(async () => workProducts);
    mockWorkProductService.update.mockImplementation(async (id: string, patch: Record<string, unknown>) => {
      const existing = workProducts.find((workProduct) => workProduct.id === id) ?? null;
      if (!existing) return null;
      return { ...existing, ...patch };
    });
  });

  it("treats reopen=true as a no-op when the issue is already open", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue("todo"));
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...makeIssue("todo"),
      ...patch,
    }));

    const res = await request(createApp())
      .patch("/api/issues/11111111-1111-4111-8111-111111111111")
      .send({ comment: "hello", reopen: true, assigneeAgentId: "33333333-3333-4333-8333-333333333333" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      assigneeAgentId: "33333333-3333-4333-8333-333333333333",
    });
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.updated",
        details: expect.not.objectContaining({ reopened: true }),
      }),
    );
  });

  it("reopens closed issues via the PATCH comment path", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue("done"));
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...makeIssue("done"),
      ...patch,
    }));

    const res = await request(createApp())
      .patch("/api/issues/11111111-1111-4111-8111-111111111111")
      .send({ comment: "hello", reopen: true, assigneeAgentId: "33333333-3333-4333-8333-333333333333" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      assigneeAgentId: "33333333-3333-4333-8333-333333333333",
      status: "todo",
    });
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.updated",
        details: expect.objectContaining({
          reopened: true,
          reopenedFrom: "done",
          status: "todo",
        }),
      }),
    );
  });

  it("moves coding work into review from an issue comment action", async () => {
    let currentIssue = makeIssue("in_progress");
    workProducts = [
      makeWorkProduct(),
      makeWorkProduct({ id: "work-product-2", isPrimary: false }),
    ];
    mockIssueService.getById.mockResolvedValue(currentIssue);
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
      currentIssue = { ...currentIssue, ...patch };
      return currentIssue;
    });

    const res = await request(createApp())
      .post("/api/issues/11111111-1111-4111-8111-111111111111/comments")
      .send({ body: "ready for review", workflowAction: "request_review" });

    expect(res.status).toBe(201);
    expect(mockIssueService.update).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      status: "in_review",
    });
    expect(mockWorkProductService.update).toHaveBeenCalledTimes(1);
    expect(mockWorkProductService.update).toHaveBeenCalledWith("work-product-1", {
      status: "ready_for_review",
      reviewState: "needs_board_review",
    });
    expect(mockHeartbeatService.wakeup).not.toHaveBeenCalled();
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.updated",
        details: expect.objectContaining({
          status: "in_review",
          workflowAction: "request_review",
        }),
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.work_product_updated",
        details: expect.objectContaining({
          workProductId: "work-product-1",
          workflowAction: "request_review",
        }),
      }),
    );
  });

  it("sends work back for changes and wakes the assignee", async () => {
    let currentIssue = makeIssue("in_review");
    workProducts = [
      makeWorkProduct({
        status: "ready_for_review",
        reviewState: "needs_board_review",
      }),
    ];
    mockIssueService.getById.mockResolvedValue(currentIssue);
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
      currentIssue = { ...currentIssue, ...patch };
      return currentIssue;
    });

    const res = await request(createApp())
      .post("/api/issues/11111111-1111-4111-8111-111111111111/comments")
      .send({ body: "Please address the review comments", workflowAction: "changes_requested" });

    expect(res.status).toBe(201);
    expect(mockIssueService.update).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      status: "todo",
    });
    expect(mockWorkProductService.update).toHaveBeenCalledWith("work-product-1", {
      status: "changes_requested",
      reviewState: "changes_requested",
    });
    expect(mockHeartbeatService.wakeup).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      expect.objectContaining({
        reason: "issue_changes_requested",
        payload: expect.objectContaining({
          workflowAction: "changes_requested",
        }),
      }),
    );
  });

  it("continues work from review and clears review state on the primary work product", async () => {
    let currentIssue = makeIssue("in_review");
    workProducts = [
      makeWorkProduct({
        status: "changes_requested",
        reviewState: "changes_requested",
      }),
    ];
    mockIssueService.getById.mockResolvedValue(currentIssue);
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
      currentIssue = { ...currentIssue, ...patch };
      return currentIssue;
    });

    const res = await request(createApp())
      .post("/api/issues/11111111-1111-4111-8111-111111111111/comments")
      .send({ body: "continue with the refactor", workflowAction: "continue" });

    expect(res.status).toBe(201);
    expect(mockIssueService.update).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      status: "todo",
    });
    expect(mockWorkProductService.update).toHaveBeenCalledWith("work-product-1", {
      status: "active",
      reviewState: "none",
    });
    expect(mockHeartbeatService.wakeup).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      expect.objectContaining({
        reason: "issue_continue_requested",
        payload: expect.objectContaining({
          workflowAction: "continue",
        }),
      }),
    );
  });

  it("approves coding work and closes the issue", async () => {
    let currentIssue = makeIssue("in_review");
    workProducts = [
      makeWorkProduct({
        status: "ready_for_review",
        reviewState: "needs_board_review",
      }),
    ];
    mockIssueService.getById.mockResolvedValue(currentIssue);
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
      currentIssue = { ...currentIssue, ...patch };
      return currentIssue;
    });

    const res = await request(createApp())
      .post("/api/issues/11111111-1111-4111-8111-111111111111/comments")
      .send({ body: "Looks good to me", workflowAction: "approve" });

    expect(res.status).toBe(201);
    expect(mockIssueService.update).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      status: "done",
    });
    expect(mockWorkProductService.update).toHaveBeenCalledWith("work-product-1", {
      status: "approved",
      reviewState: "approved",
    });
    expect(mockHeartbeatService.wakeup).not.toHaveBeenCalled();
  });

  it("infers request_review from a /review comment without an explicit workflow action", async () => {
    let currentIssue = makeIssue("in_progress");
    workProducts = [makeWorkProduct()];
    mockIssueService.getById.mockResolvedValue(currentIssue);
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
      currentIssue = { ...currentIssue, ...patch };
      return currentIssue;
    });

    const res = await request(createApp())
      .post("/api/issues/11111111-1111-4111-8111-111111111111/comments")
      .send({ body: "/review" });

    expect(res.status).toBe(201);
    expect(mockIssueService.update).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      status: "in_review",
    });
    expect(mockWorkProductService.update).toHaveBeenCalledWith("work-product-1", {
      status: "ready_for_review",
      reviewState: "needs_board_review",
    });
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.comment_added",
        details: expect.objectContaining({
          workflowAction: "request_review",
        }),
      }),
    );
  });

  it("infers changes_requested from a /fix comment and wakes the assignee", async () => {
    let currentIssue = makeIssue("in_review");
    workProducts = [
      makeWorkProduct({
        status: "ready_for_review",
        reviewState: "needs_board_review",
      }),
    ];
    mockIssueService.getById.mockResolvedValue(currentIssue);
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
      currentIssue = { ...currentIssue, ...patch };
      return currentIssue;
    });

    const res = await request(createApp())
      .post("/api/issues/11111111-1111-4111-8111-111111111111/comments")
      .send({ body: "/fix parser regression from review" });

    expect(res.status).toBe(201);
    expect(mockIssueService.update).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      status: "todo",
    });
    expect(mockWorkProductService.update).toHaveBeenCalledWith("work-product-1", {
      status: "changes_requested",
      reviewState: "changes_requested",
    });
    expect(mockHeartbeatService.wakeup).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      expect.objectContaining({
        reason: "issue_changes_requested",
        payload: expect.objectContaining({
          workflowAction: "changes_requested",
        }),
      }),
    );
  });
});

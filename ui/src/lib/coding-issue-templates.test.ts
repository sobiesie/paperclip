import { describe, expect, it } from "vitest";
import {
  CODING_ISSUE_TEMPLATE_OPTIONS,
  buildCodingIssueTemplateSeed,
  getCodingIssueTemplateOption,
} from "./coding-issue-templates";

describe("coding issue templates", () => {
  it("exposes the expected starter templates", () => {
    expect(CODING_ISSUE_TEMPLATE_OPTIONS.map((option) => option.id)).toEqual([
      "refactor",
      "review",
      "fix_review_findings",
      "parallel_implementation",
    ]);
  });

  it("builds a review seed with review-oriented defaults", () => {
    expect(buildCodingIssueTemplateSeed("review")).toEqual({
      title: "Review: <change or PR>",
      description: expect.stringContaining("findings first"),
      status: "in_review",
      priority: "medium",
    });
  });

  it("returns the fix-findings template metadata", () => {
    expect(getCodingIssueTemplateOption("fix_review_findings")).toMatchObject({
      label: "Fix findings",
      description: expect.stringContaining("review feedback"),
      seed: {
        title: "Fix review findings: <change or PR>",
        status: "todo",
        priority: "high",
      },
    });
  });
});

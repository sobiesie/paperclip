export const CODING_ISSUE_TEMPLATE_IDS = [
  "refactor",
  "review",
  "fix_review_findings",
  "parallel_implementation",
] as const;

export type CodingIssueTemplateId = (typeof CODING_ISSUE_TEMPLATE_IDS)[number];

export interface CodingIssueTemplateSeed {
  title: string;
  description: string;
  status: "todo" | "in_review";
  priority: "medium" | "high";
}

export interface CodingIssueTemplateOption {
  id: CodingIssueTemplateId;
  label: string;
  description: string;
  seed: CodingIssueTemplateSeed;
}

const TEMPLATE_OPTIONS: Record<CodingIssueTemplateId, CodingIssueTemplateOption> = {
  refactor: {
    id: "refactor",
    label: "Refactor",
    description: "Restructure an area safely without changing intended behavior.",
    seed: {
      title: "Refactor: <target area>",
      description: `Refactor the targeted area while preserving behavior.

Goals
- simplify the implementation and reduce duplication
- keep public interfaces stable unless a change is explicitly required
- leave the code easier to extend and review

Deliverables
- concise summary of what changed structurally
- focused verification results
- follow-up notes for anything intentionally deferred`,
      status: "todo",
      priority: "medium",
    },
  },
  review: {
    id: "review",
    label: "Review",
    description: "Create a dedicated review task with findings-first output expectations.",
    seed: {
      title: "Review: <change or PR>",
      description: `Review this change with a code-review mindset.

Look for
- bugs and behavioral regressions
- missing tests or weak coverage
- risky migrations, config changes, or edge cases

Output
- findings first, ordered by severity
- a clear approve or changes-requested recommendation`,
      status: "in_review",
      priority: "medium",
    },
  },
  fix_review_findings: {
    id: "fix_review_findings",
    label: "Fix findings",
    description: "Turn review feedback into a focused follow-up task.",
    seed: {
      title: "Fix review findings: <change or PR>",
      description: `Address the outstanding review findings for this work.

Goals
- fix the reported bugs or regressions
- preserve intended behavior outside the requested changes
- rerun focused verification for the touched area

Output
- summary of each finding addressed
- note any remaining follow-ups that should be separate work`,
      status: "todo",
      priority: "high",
    },
  },
  parallel_implementation: {
    id: "parallel_implementation",
    label: "Parallel slice",
    description: "Scope work so it can move in parallel with nearby implementation.",
    seed: {
      title: "Parallel implementation: <slice>",
      description: `Implement a clearly scoped slice in parallel with related work.

Constraints
- stay within the agreed boundaries for this slice
- avoid unnecessary overlap with nearby workstreams
- call out merge risks or integration points early

Output
- what shipped in this slice
- what remains for adjacent work
- focused verification results`,
      status: "todo",
      priority: "medium",
    },
  },
};

export const CODING_ISSUE_TEMPLATE_OPTIONS = CODING_ISSUE_TEMPLATE_IDS.map(
  (id) => TEMPLATE_OPTIONS[id],
);

export function getCodingIssueTemplateOption(id: CodingIssueTemplateId): CodingIssueTemplateOption {
  return TEMPLATE_OPTIONS[id];
}

export function buildCodingIssueTemplateSeed(id: CodingIssueTemplateId): CodingIssueTemplateSeed {
  return TEMPLATE_OPTIONS[id].seed;
}

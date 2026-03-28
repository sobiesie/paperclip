# Coding-Agent Pivot Investigation

Date: 2026-03-28
Status: exploratory product and architecture investigation

## Progress update

The first implementation slices are now underway in the product:

- issue comments support explicit coding workflow actions and slash-command inference for `continue`, `review`, `fix`, and `approve`
- issue comments persist their workflow action so review handoffs are durable in the timeline
- new agent creation now has coding-oriented presets for builder, reviewer, and fixer agents with coding-specific bundled instructions
- projects can now declare reviewer and fixer routing so `review` can hand work to a reviewer agent and `fix` can route changes back to a builder or dedicated fixer
- issue detail now shows a coding workflow card with builder / reviewer / fixer visibility, linked outputs, and one-click workflow transitions
- issue rows and inbox surfaces now badge coding workflow state so review and fix loops are scannable at a glance
- onboarding now includes an explicit codebase path that seeds coding-builder defaults, codebase-oriented starter project naming, and starter templates for refactor, review, fix-from-review, and parallel implementation loops
- pull request work-product review-state changes now feed the same coding workflow loop, so external PR sync can move issues into review, request fixes, or mark approval without relying on a manual comment first
- a first-party GitHub coding-sync example plugin now indexes tracked pull requests from `issue.work_product_*` events and translates `pull_request` / `pull_request_review` webhooks into work-product updates that drive the same review-fix loop automatically
- onboarding can now start in either company mode or codebase mode, with codebase onboarding defaulting to a coding-builder setup and coding-first launch copy
- new issue creation now includes coding starter templates for refactor, review, fix-review-findings, and parallel implementation flows

That means the repo now has a real foundation for the loop this investigation described:

- implement
- request review
- fix requested changes
- continue until done

## Question

Can Paperclip be converted from a control plane for AI companies into a control plane for coding agents that manage one or more codebases, especially around loops like:

- continue work on an existing refactor
- run or request review
- fix bugs found in review
- keep parallel agent work isolated and visible

## Short answer

Yes.

Paperclip is already much closer to a coding-agent control plane than a normal business app:

- it has issue assignment and comment-driven wakeups
- it has local coding adapters including `codex_local`
- it has project workspaces and issue-scoped execution workspaces
- it can realize git-worktree-backed isolated execution
- it has work-product types for `branch`, `commit`, `pull_request`, `preview_url`, and `artifact`
- it has explicit `in_review` issue state
- it has plugins, runtime service tracking, and durable run/activity logs

The main obstacle is not the runtime architecture.
The main obstacle is the product framing and a lot of first-class vocabulary:

- company
- board
- CEO / CTO / org chart
- hire approvals
- company goals

So this is best understood as a product pivot and workflow retargeting effort, not a ground-up orchestration rewrite.

## Strong signals already in the repo

### 1. The core loop already looks like a coding-agent loop

Issues already support:

- single assignee ownership
- checkout / release semantics
- comments
- reopen from comments
- interrupt active runs from comments
- wake assignee on comment or assignment
- `in_review` state

This is already a strong base for:

- "continue"
- "please review this"
- "fix the bugs from review"

### 2. Workspaces are already modeled the right way

The repo already distinguishes:

- `project_workspaces`: durable codebase or root workspace
- `execution_workspaces`: the actual runtime workspace used for a run

That is the right abstraction for coding workflows.
It cleanly supports:

- shared repo roots
- isolated git worktrees
- long-lived operator branches
- remote sandboxes later

### 3. Git-worktree execution is already implemented

`workspace-runtime.ts` already supports:

- `git_worktree` workspace strategy
- deterministic branch naming from issue context
- worktree creation and reuse
- provision and teardown commands
- cleanup of derived worktrees and branches

This is a major part of an agentic coding system already solved.

### 4. Codex support is already serious, not superficial

`codex_local` already has:

- managed `CODEX_HOME`
- model selection
- skill injection
- workspace-aware env wiring
- issue / comment wake context passed into the runtime

This means Paperclip can already launch a coding agent with structured task context in an isolated workspace.

### 5. The repo already has an explicit work-product model

The `issue_work_products` model already fits engineering workflows:

- `pull_request`
- `branch`
- `commit`
- `preview_url`
- `runtime_service`
- `artifact`
- `document`

That is exactly the right way to model coding outputs without making PRs the planning primitive.

### 6. Internal planning docs already point in this direction

Existing plan docs already argue for:

- project execution policies
- workspace isolation
- PRs as work products
- Paperclip managing issue -> workspace -> preview/PR handoff
- not turning the product into a built-in code review tool

So this pivot is not fighting the architecture.
It is mostly accelerating one branch of it.

## The biggest mismatch today

The runtime fits coding work better than the product surface does.

### What feels aligned

- issue lifecycle
- run lifecycle
- workspaces
- work products
- adapters
- project-scoped codebase configuration
- comment-triggered wakeups
- skill distribution

### What feels misaligned

- company-first onboarding
- CEO / org-chart mental model
- approval types like `hire_agent` and `approve_ceo_strategy`
- company-goal hierarchy as the main top-down frame
- board/operator language everywhere
- UI navigation centered on company/org structure rather than codebase workflow

## Mapping the current model to a coding-agent product

The easiest path is not to throw away the current model.
It is to reinterpret it.

### Recommended reinterpretation

- `company` -> workspace, account, or engineering org
- `project` -> repo, service, package, app, or initiative
- `project_workspace` -> canonical codebase root
- `execution_workspace` -> issue-specific checkout or sandbox
- `issue` -> task / ticket / work item / change request
- `agent` -> coding agent or specialist
- `work_product` -> PR, branch, commit, preview, artifact
- `board` -> operator / maintainer / repo owner

### What should stay internal at first

It is not necessary to rename the database immediately.

The fastest route is:

1. keep the current storage model
2. change product copy and onboarding
3. add engineering-first presets and policies
4. only rename deeper schema concepts later if the product direction proves out

## Your target workflow and how close the repo already is

## 1. "Continue"

This is already very close.

Current support:

- issue comments can wake the assignee
- issue comments can reopen closed work
- active runs can be interrupted from comments
- wake context includes issue id, comment id, and wake reason

Needed polish:

- explicit UI action for `Continue with agent`
- fresh-session vs same-session policy per comment
- richer comment templates like `continue`, `resume`, `pick up where you left off`

## 2. "/review"

This is partially there.

Current support:

- `in_review` issue state exists
- work products can be marked `ready_for_review`
- work products have review state fields including `changes_requested`

Missing product pieces:

- a first-class reviewer role or review policy
- automatic routing from `in_progress` -> `in_review`
- review work product summaries
- review checklists / structured findings
- external review integration for PR comments and CI status

## 3. "Fix bug from review"

This is also close.

Current support:

- comments can reopen work
- comments can wake assignee
- work can be interrupted and resumed
- issues can have parent/child structure

Missing product pieces:

- a cleaner "changes requested" workflow
- sync from PR review comments / CI failures into issue comments or child issues
- dedicated retry / patch / follow-up automation rules

## Where the current product should go if coding becomes the main use case

## Recommendation

Do not pivot into "GitHub replacement" or "built-in code review tool."

Do pivot into:

**A control plane for coding-agent work across real codebases.**

That means Paperclip should own:

- task routing
- run orchestration
- workspace isolation
- review handoff state
- artifact / preview / PR visibility
- interrupt / resume / retry flows

And Paperclip should not try to own:

- full diff review UI
- merge queue
- complete Git host replacement
- every source-control operation as a core feature

## Gaps to close for a coding-agent-first product

### P0: Product framing

- Add an engineering-first onboarding path:
  - connect a repo or local folder
  - choose a coding adapter like `codex_local`
  - configure isolated issue workspaces
  - create starter agents like builder, reviewer, fixer
- Add engineering-first naming in UI copy:
  - repo / workspace / maintainer wording instead of company / CEO wording
- Add starter templates for:
  - refactor
  - review
  - fix review findings
  - parallel implementation

### P1: Workflow automation

- Add review policies at the project level:
  - who reviews
  - when review starts
  - whether fresh execution workspace is required
- Add first-class review handoff:
  - mark issue ready for review
  - request review
  - changes requested
  - approved
- Add GitHub or provider integration as a plugin:
  - PR creation / linking
  - PR review comment sync
  - CI failure sync

### P2: Codebase operations visibility

- Make repo health and workspace state primary:
  - branch
  - worktree path
  - dirty state
  - preview URL
  - PR URL
  - CI status
- Add issue-centric coding timeline:
  - task comment
  - run
  - commit
  - PR
  - review
  - fix follow-up

### P3: Deeper product cleanup

- Deprecate or hide org-chart-heavy flows in engineering mode
- Replace CEO-centric default instructions bundles
- Introduce coding-team presets instead of company hierarchy presets
- Optionally rename top-level user-facing object away from `company`

## Recommended implementation strategy

## Option A: Full hard pivot now

Replace company language, org charts, approvals, and onboarding everywhere.

Pros:

- clean story
- less conceptual drag later

Cons:

- high-cost rewrite across docs, UI, routes, and default behaviors
- risks breaking the broader "AI company" vision before the coding-agent direction is validated

## Option B: Add an engineering mode

Keep the underlying architecture and data model.
Add a first-class product mode or template layer for coding workflows.

Pros:

- fastest path
- lowest migration risk
- uses existing workspaces and issue/run machinery immediately
- validates demand before large naming/schema changes

Cons:

- some conceptual duality remains
- internal and external vocabulary will diverge for a while

## Recommendation

Choose Option B first.

Specifically:

1. Keep the current backend object model.
2. Add a repo-first onboarding and preset system.
3. Make coding workflow surfaces primary for those presets.
4. Use plugins and work products for PR / review / CI integration.
5. Reassess deeper renaming after the engineering-mode workflow feels obviously better than the company-mode workflow.

## Concrete product concept for your idea

One strong packaging would be:

### Paperclip for codebases

- One Paperclip instance manages many repos or services.
- Each repo is a `project` with one or more configured codebase roots.
- Agents are coding specialists:
  - builder
  - reviewer
  - bug fixer
  - release agent
  - repo triager
- Every task runs in a shared or isolated execution workspace.
- Outputs show up as:
  - commits
  - branches
  - previews
  - PRs
  - artifacts
- Human feedback arrives as issue comments and automatically wakes the right agent.

That directly supports:

- "continue"
- "review this"
- "fix what review found"
- "keep parallel work isolated"

## Bottom line

Paperclip can absolutely become a strong agentic system for managing codebases.

The repo already contains most of the hard technical pieces:

- issue/run orchestration
- comment-driven wake loops
- isolated execution workspaces
- Codex integration
- work-product modeling
- project-scoped workspace policy

The major work is product-level:

- make repos and coding workflows the default mental model
- add explicit review and follow-up automation
- integrate external PR / CI systems through plugins
- reduce or hide the CEO/company/org-chart framing in engineering mode

If this direction is taken, the best near-term move is not a rewrite.
It is an engineering-first mode built on top of the current control-plane core.

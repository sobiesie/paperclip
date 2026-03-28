# GitHub Coding Sync Example

This first-party example plugin shows how to:

- index tracked GitHub pull requests from Paperclip issue work products
- receive GitHub webhooks through `onWebhook`
- map PR and review events back to Paperclip work products
- let Paperclip's coding workflow automation handle review, approve, and changes-requested handoffs

It is intentionally worker-only. The example focuses on the server-side sync loop rather than UI.

## What it expects

- Paperclip issues already have `pull_request` work products for the PRs you want to track
- those work products either:
  - use a GitHub PR URL like `https://github.com/owner/repo/pull/123`
  - or store a GitHub PR id / node id in `externalId`

On startup the worker scans existing issues and indexes any matching PR work products into plugin entities. After that it keeps the mapping fresh from `issue.work_product_*` events and applies incoming GitHub webhook updates through `ctx.issues.workProducts.update(...)`.

## Config

- `webhookSecretRef`: optional secret ref used to verify `x-hub-signature-256`
- `allowedRepositories`: optional allow-list of `owner/repo` names

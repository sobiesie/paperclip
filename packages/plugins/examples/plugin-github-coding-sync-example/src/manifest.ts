import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclipai.github-coding-sync-example",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "GitHub Coding Sync (Example)",
  description: "Syncs GitHub pull request and review webhooks into Paperclip issue work products so coding workflow automation can react automatically.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "companies.read",
    "issues.read",
    "issues.update",
    "events.subscribe",
    "webhooks.receive",
    "secrets.read-ref",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      webhookSecretRef: {
        type: "string",
        title: "GitHub webhook secret ref",
        description: "Optional Paperclip secret ref used to verify x-hub-signature-256.",
      },
      allowedRepositories: {
        type: "array",
        title: "Allowed repositories",
        description: "Optional allow-list of owner/repo names. Webhooks for other repositories are ignored.",
        items: {
          type: "string",
        },
      },
    },
  },
  webhooks: [
    {
      endpointKey: "github",
      displayName: "GitHub webhook",
      description: "Accepts pull_request and pull_request_review events from GitHub.",
    },
  ],
};

export default manifest;

export const PLUGIN_ID = "paperclipai.plugin-github-coding-sync-example";
export const PLUGIN_VERSION = "0.1.0";
export const WEBHOOK_KEY = "github";

export const WEBHOOK_KEYS = {
  github: WEBHOOK_KEY,
} as const;

export const ENTITY_TYPES = {
  pullRequestId: "github-pull-request-id",
  pullRequestNodeId: "github-pull-request-node-id",
  pullRequestRepoNumber: "github-pull-request-repo-number",
} as const;

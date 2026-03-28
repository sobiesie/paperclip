export function isAbsoluteLocalPath(value: string) {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

export function isGitHubRepoUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return false;
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.length >= 2;
  } catch {
    return false;
  }
}

export function deriveWorkspaceNameFromPath(value: string) {
  const normalized = value.trim().replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? "Local folder";
}

export function deriveWorkspaceNameFromRepo(value: string) {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const repo = segments[segments.length - 1]?.replace(/\.git$/i, "") ?? "";
    return repo || "GitHub repo";
  } catch {
    return "GitHub repo";
  }
}

import path from "node:path";
import type { Dirent } from "node:fs";

// ─── Dangerous Property Keys ─────────────────────────────────────────────────

/**
 * Keys that must never be spread from untrusted JSON into objects.
 * Covers prototype pollution vectors across all known JS engines.
 */
const POISONED_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

// ─── Config JSON Sanitization ─────────────────────────────────────────────────

/**
 * Strips prototype-pollution keys from a parsed JSON object.
 * Returns a shallow copy with only safe own-properties.
 *
 * Accepts `unknown` to handle malformed JSON gracefully —
 * non-object inputs are collapsed to an empty record.
 */
export function sanitizeConfigJson(parsed: unknown): Record<string, unknown> {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};

  for (const key of Object.keys(parsed as Record<string, unknown>)) {
    if (!POISONED_KEYS.has(key)) {
      sanitized[key] = (parsed as Record<string, unknown>)[key];
    }
  }

  return sanitized;
}

// ─── Path Boundary Checks ─────────────────────────────────────────────────────

/**
 * Asserts that a resolved absolute path resides within the project root.
 * Throws a descriptive error if the path escapes the boundary.
 *
 * @param resolvedPath - The fully resolved (absolute) path to validate.
 * @param label        - A human-readable name for the config field (used in error messages).
 * @param projectRoot  - The project root to validate against. Defaults to `process.cwd()`.
 */
export function assertPathWithinProject(
  resolvedPath: string,
  label: string,
  projectRoot: string = process.cwd(),
): void {
  const normalizedRoot = path.resolve(projectRoot) + path.sep;
  const normalizedTarget = path.resolve(resolvedPath);

  // Allow exact match (e.g. outputPath = projectRoot/file.ts)
  // or nested paths (must start with root + separator)
  if (
    normalizedTarget !== path.resolve(projectRoot) &&
    !normalizedTarget.startsWith(normalizedRoot)
  ) {
    throw new Error(
      `Security: "${label}" resolves to "${normalizedTarget}" which is outside the project root "${path.resolve(projectRoot)}". Aborting.`,
    );
  }
}

// ─── Base Path Validation ─────────────────────────────────────────────────────

/**
 * Validates that a basePath value is safe to use as a URL path prefix.
 *
 * Rules (mirrors Next.js basePath constraints):
 * - Must start with `/`
 * - Must not end with `/` (unless it is exactly `/`)
 * - Must contain only URL-safe characters: alphanumeric, hyphens, underscores, slashes
 * - Must not contain path traversal sequences (`..`)
 *
 * Returns the basePath unchanged if valid, or an empty string if invalid.
 */
export function validateBasePath(raw: string): string {
  if (raw === "") return "";

  if (!raw.startsWith("/")) return "";
  if (raw !== "/" && raw.endsWith("/")) return "";
  if (raw.includes("..")) return "";
  if (!/^[a-zA-Z0-9/_-]+$/.test(raw)) return "";

  return raw;
}

// ─── Symlink Detection ────────────────────────────────────────────────────────

/**
 * Returns `true` if a directory entry is a symbolic link.
 * Used to skip symlinks during traversal to prevent
 * following links that escape the project boundary.
 */
export function isSymbolicLink(entry: Dirent): boolean {
  return entry.isSymbolicLink();
}

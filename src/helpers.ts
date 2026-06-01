/**
 * Creates a debounced version of a function that delays invocation
 * until `waitMs` milliseconds have elapsed since the last call.
 */
export function debounce<T extends (...args: never[]) => void>(
  func: T,
  waitMs: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitMs);
  };
}

/**
 * Converts a single path segment to a SCREAMING_SNAKE_CASE key.
 * Strips dynamic brackets `[slug]` and catch-all dots `[...slug]`.
 *
 * @example
 * segmentToKey("dashboard")       // "DASHBOARD"
 * segmentToKey("[id]")            // "ID"
 * segmentToKey("[...slug]")       // "SLUG"
 * segmentToKey("forgot-password") // "FORGOT_PASSWORD"
 */
export function segmentToKey(segment: string): string {
  if (segment.startsWith("[") && segment.endsWith("]")) {
    return segment
      .replace(/^\[+|\]+$/g, "")
      .replace(/^\.\.\./, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_");
  }
  return segment.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

/**
 * Builds a dot-separated nested key from a route path.
 *
 * @example
 * generateKey("/")                         // "HOME"
 * generateKey("/dashboard/analytics")      // "DASHBOARD.ANALYTICS"
 * generateKey("/catalog/tracks/[id]")      // "CATALOG.TRACKS.ID"
 */
export function generateKey(routePath: string): string {
  if (routePath === "/" || routePath === "") return "HOME";
  return routePath.split("/").filter(Boolean).map(segmentToKey).join(".");
}

/** Default folder prefixes that should always be skipped during traversal. */
const IGNORED_PREFIXES = [
  "_", // private folders
  "@", // parallel routes
  "node_modules",
];

/**
 * Determines if a folder should be excluded from route scanning.
 * Skips private folders, parallel routes, dotfiles, API routes,
 * intercepting routes, and user-specified ignore patterns.
 */
export function shouldIgnoreFolder(
  folderName: string,
  extraIgnore: string[],
): boolean {
  if (
    IGNORED_PREFIXES.some((prefix) => folderName.startsWith(prefix)) ||
    folderName.startsWith(".") ||
    folderName === "api" ||
    // Intercepting routes: (.), (..), (...), (.)(..)
    /^\(\.*\)/.test(folderName)
  ) {
    return true;
  }

  return extraIgnore.includes(folderName);
}

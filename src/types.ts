// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * User-facing configuration for the route generator.
 * All fields are optional — sensible defaults are auto-detected.
 */
export interface RouteGenConfig {
  /** Custom path to the App Router directory (e.g. "src/app"). */
  appDir?: string;
  /** Custom path to the Pages Router directory (e.g. "src/pages"). */
  pagesDir?: string;
  /** Target file path for the generated TypeScript output. */
  outputPath?: string;
  /** Prepends a base path prefix to all routes (mirrors next.config basePath). */
  basePath?: string;
  /** Extra folder names to skip during directory scanning. */
  ignore?: string[];
  /** Restricts parsing to a specific router pattern. */
  routerType?: "app" | "pages" | "both" | "auto";
}

/**
 * Fully resolved internal config — no optionals.
 * Produced by merging user config + auto-detection defaults.
 */
export interface ResolvedConfig {
  appDir: string | null;
  pagesDir: string | null;
  outputPath: string;
  basePath: string;
  ignore: string[];
  routerType: "app" | "pages" | "both" | "auto";
}

// ─── Route Tree Nodes ─────────────────────────────────────────────────────────

/** Represents a dynamic route segment with typed parameters. */
export interface DynamicNode {
  __isDynamic: true;
  path: string;
  params: DynamicParam[];
}

export interface DynamicParam {
  name: string;
  isCatchAll: boolean;
}

/** Recursive union type for the nested route tree. */
export type RouteNode = string | DynamicNode | { [key: string]: RouteNode };

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isDynamicNode(node: unknown): node is DynamicNode {
  return (
    typeof node === "object" &&
    node !== null &&
    "__isDynamic" in node &&
    (node as Record<string, unknown>).__isDynamic === true
  );
}

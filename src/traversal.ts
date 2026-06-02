import fs from "node:fs";
import path from "node:path";
import { shouldIgnoreFolder, generateKey } from "./helpers.js";
import { isSymbolicLink } from "./security.js";

// ─── App Router Traversal ─────────────────────────────────────────────────────

/**
 * Recursively scans an App Router directory (src/app or app).
 * Returns a flat record mapping dot-separated keys to URL paths.
 *
 * Handles:
 * - Route groups `(group)` — transparent in URL, traversed for children
 * - Dynamic segments `[slug]` — preserved in path string
 * - Catch-all segments `[...slug]` — preserved in path string
 * - Intercepting routes `(.)`, `(..)`, `(...)` — skipped
 */
export function traverseAppDir(
  dir: string,
  basePath: string,
  extraIgnore: string[],
  routeSegment: string = "",
): Record<string, string> {
  const routes: Record<string, string> = {};
  if (!fs.existsSync(dir)) return routes;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  let hasPage = false;

  for (const item of items) {
    if (!item.isDirectory()) {
      if (/^page\.(tsx|jsx|js|ts)$/.test(item.name)) hasPage = true;
      continue;
    }

    const folderName = item.name;
    if (shouldIgnoreFolder(folderName, extraIgnore)) continue;
    if (isSymbolicLink(item)) continue;

    // Route group — transparent in URL, pass through without adding to segment
    const isRouteGroup =
      /^\(.+\)$/.test(folderName) && !/^\(\.*\)/.test(folderName);

    if (isRouteGroup) {
      Object.assign(
        routes,
        traverseAppDir(
          path.join(dir, folderName),
          basePath,
          extraIgnore,
          routeSegment,
        ),
      );
    } else {
      const nextSegment =
        routeSegment === ""
          ? `/${folderName}`
          : `${routeSegment}/${folderName}`;

      Object.assign(
        routes,
        traverseAppDir(
          path.join(dir, folderName),
          basePath,
          extraIgnore,
          nextSegment,
        ),
      );
    }
  }

  if (hasPage) {
    const finalPath = basePath + (routeSegment || "/");
    const key = generateKey(routeSegment || "/");
    routes[key] = finalPath;
  }

  return routes;
}

// ─── Pages Router Traversal ───────────────────────────────────────────────────

/** Next.js special files that should be excluded from Pages Router scanning. */
const PAGES_SPECIAL_FILES = ["_app", "_document", "_error", "_middleware"];

/**
 * Recursively scans a Pages Router directory (src/pages or pages).
 * Returns a flat record mapping dot-separated keys to URL paths.
 *
 * Handles:
 * - `index.tsx` → maps to the directory's route segment
 * - Named files → treated as individual routes
 * - Dynamic filenames `[id].tsx` — preserved in path string
 * - Skips _app, _document, _error, _middleware, and api/
 */
export function traversePagesDir(
  dir: string,
  basePath: string,
  extraIgnore: string[],
  routeSegment: string = "",
): Record<string, string> {
  const routes: Record<string, string> = {};
  if (!fs.existsSync(dir)) return routes;

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const name = item.name;

    if (item.isDirectory()) {
      if (shouldIgnoreFolder(name, extraIgnore)) continue;
      if (isSymbolicLink(item)) continue;

      const nextSegment =
        routeSegment === "" ? `/${name}` : `${routeSegment}/${name}`;

      Object.assign(
        routes,
        traversePagesDir(
          path.join(dir, name),
          basePath,
          extraIgnore,
          nextSegment,
        ),
      );
    } else {
      // Only process page files
      if (!/\.(tsx|jsx|js|ts)$/.test(name)) continue;

      // Strip extension to get the base name
      const base = name.replace(/\.(tsx|jsx|js|ts)$/, "");

      // Skip Next.js special files
      if (PAGES_SPECIAL_FILES.includes(base)) continue;

      const segment =
        base === "index"
          ? routeSegment || "/"
          : routeSegment === ""
            ? `/${base}`
            : `${routeSegment}/${base}`;

      const finalPath = basePath + (segment === "/" ? "/" : segment);
      const key = generateKey(segment);
      routes[key] = finalPath;
    }
  }

  return routes;
}

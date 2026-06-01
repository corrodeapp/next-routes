import type { RouteNode } from "./types.js";

/**
 * Transforms a flat route map (dot-separated keys → path strings)
 * into a nested RouteNode tree.
 *
 * @example
 * Input:  { "HOME": "/", "AUTH.LOGIN": "/auth/login", "DASHBOARD": "/dashboard" }
 * Output: { HOME: "/", AUTH: { LOGIN: "/auth/login" }, DASHBOARD: "/dashboard" }
 *
 * Handles:
 * - Promoting leaf nodes to objects with ROOT when a parent also has a page
 * - Detecting dynamic segments `[slug]` and creating DynamicNode entries
 * - Parsing catch-all parameters `[...slug]`
 */
export function buildNestedRoutes(
  flatRoutes: Record<string, string>,
): RouteNode {
  const root: Record<string, unknown> = {};

  for (const [key, pathValue] of Object.entries(flatRoutes)) {
    if (key === "HOME") {
      root["HOME"] = pathValue;
      continue;
    }

    const parts = key.split(".");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;

      if (current[part] === undefined) {
        current[part] = {};
      }

      let nextNode = current[part];

      // A leaf was previously set — promote to object with ROOT
      if (
        typeof nextNode !== "object" ||
        nextNode === null ||
        (nextNode as Record<string, unknown>).__isDynamic === true
      ) {
        nextNode = { ROOT: nextNode };
        current[part] = nextNode;
      }

      if (i === parts.length - 1) {
        const nodeValue = createNodeValue(pathValue);
        const nextNodeObj = nextNode as Record<string, unknown>;

        if (Object.keys(nextNodeObj).length > 0) {
          nextNodeObj.ROOT = nodeValue;
        } else {
          current[part] = nodeValue;
        }
      }

      current = nextNode as Record<string, unknown>;
    }
  }

  return root as unknown as RouteNode;
}

/**
 * Creates either a static string node or a DynamicNode
 * depending on whether the path contains dynamic segments.
 */
function createNodeValue(pathValue: string): RouteNode {
  const dynamicMatches = [...pathValue.matchAll(/\[([^\]]+)\]/g)];

  if (dynamicMatches.length > 0) {
    const params = dynamicMatches.map((m) => ({
      name: m[1]!.replace(/^\.\.\./, ""),
      isCatchAll: m[1]!.startsWith("..."),
    }));
    return { __isDynamic: true, path: pathValue, params };
  }

  return pathValue;
}

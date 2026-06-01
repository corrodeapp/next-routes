import type { RouteNode } from "./types.js";
import { isDynamicNode } from "./types.js";

/**
 * Serializes a RouteNode tree into a TypeScript object literal string.
 *
 * Produces:
 * - Static routes  → `"path"`
 * - Dynamic routes → `(params: { id: string | number }) => \`/path/${params.id}\``
 * - Catch-all      → `(params: { slug: string[] }) => \`/path/${params.slug.join('/')}\``
 */
export function stringifyRoutes(obj: RouteNode, indent: number = 2): string {
  if (isDynamicNode(obj)) {
    return stringifyDynamicNode(obj);
  }

  if (typeof obj === "string") {
    return `"${obj}"`;
  }

  if (typeof obj === "object" && obj !== null) {
    const pad = " ".repeat(indent);
    const entries = Object.entries(obj).map(([key, value]) => {
      const safeKey = isValidIdentifier(key) ? key : `"${key}"`;
      return `${pad}  ${safeKey}: ${stringifyRoutes(value, indent + 2)}`;
    });
    return `{\n${entries.join(",\n")}\n${pad}}`;
  }

  return String(obj);
}

/**
 * Generates a TypeScript arrow function string for dynamic routes.
 *
 * @example
 * DynamicNode { path: "/tracks/[id]", params: [{ name: "id", isCatchAll: false }] }
 * → `(params: { id: string | number }) => \`/tracks/${params.id}\``
 */
function stringifyDynamicNode(node: {
  path: string;
  params: { name: string; isCatchAll: boolean }[];
}): string {
  const paramsType = node.params
    .map((p) =>
      p.isCatchAll ? `${p.name}: string[]` : `${p.name}: string | number`,
    )
    .join("; ");

  const pathTemplate = node.path.replace(
    /\[([^\]]+)\]/g,
    (_: string, paramName: string) => {
      const isCatchAll = paramName.startsWith("...");
      const cleanParam = paramName.replace(/^\.\.\./, "");
      return isCatchAll
        ? `\${params.${cleanParam}.join('/')}`
        : `\${params.${cleanParam}}`;
    },
  );

  return `(params: { ${paramsType} }) => \`${pathTemplate}\``;
}

/** Checks if a string is a valid JS identifier (safe to use without quotes). */
function isValidIdentifier(key: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
}

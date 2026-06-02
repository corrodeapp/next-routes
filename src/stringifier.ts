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
/**
 * Wraps JSON.stringify in a way that bundlers cannot tree-shake or inline.
 * Prevents tsup/esbuild from replacing `JSON.stringify(x)` with `"${x}"`,
 * which would lose escaping of quotes and backslashes in edge-case filenames.
 */
const _jsonStringify = JSON.stringify.bind(JSON);

export function stringifyRoutes(obj: RouteNode, indent: number = 2): string {
  if (isDynamicNode(obj)) {
    return stringifyDynamicNode(obj);
  }

  if (typeof obj === "string") {
    return _jsonStringify(obj);
  }

  if (typeof obj === "object" && obj !== null) {
    const pad = " ".repeat(indent);
    const entries = Object.entries(obj).map(([key, value]) => {
      const safeKey = isValidIdentifier(key) ? key : _jsonStringify(key);
      return `${pad}  ${safeKey}: ${stringifyRoutes(value, indent + 2)}`;
    });
    return `{\n${entries.join(",\n")}\n${pad}}`;
  }

  return String(obj);
}

/** Escapes characters that would prematurely close or evaluate a template literal */
function escapeTemplateString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
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

  let templateLiteral = "`";
  let lastIndex = 0;
  let paramIndex = 0;

  const regex = /\[([^\]]+)\]/g;
  let match;

  while ((match = regex.exec(node.path)) !== null) {
    const staticPart = node.path.substring(lastIndex, match.index);
    templateLiteral += escapeTemplateString(staticPart);

    const param = node.params[paramIndex++]!;
    if (param.isCatchAll) {
      templateLiteral += `\${params.${param.name}.join('/')}`;
    } else {
      templateLiteral += `\${params.${param.name}}`;
    }

    lastIndex = regex.lastIndex;
  }

  const finalStaticPart = node.path.substring(lastIndex);
  templateLiteral += escapeTemplateString(finalStaticPart);
  templateLiteral += "`";

  return `(params: { ${paramsType} }) => ${templateLiteral} as Route`;
}

/** Checks if a string is a valid JS identifier (safe to use without quotes). */
function isValidIdentifier(key: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
}

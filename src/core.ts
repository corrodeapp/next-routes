import fs from "node:fs";
import path from "node:path";
import type { RouteGenConfig } from "./types.js";
import { resolveConfig } from "./detection.js";
import { traverseAppDir, traversePagesDir } from "./traversal.js";
import { buildNestedRoutes } from "./builder.js";
import { stringifyRoutes } from "./stringifier.js";

// ─── File Header ──────────────────────────────────────────────────────────────

const FILE_HEADER = `/**
 * Auto-generated Route Paths By @corrodekit/next-routes
 * Docs: https://github.com/corrodeapp/next-routes
 * 
 * ──────────────────────────────────────────────────────────
 * ⚠️  DO NOT MANUALLY EDIT THIS FILE — IT IS AUTO-GENERATED
 * ──────────────────────────────────────────────────────────
 *
 */

import type { Route } from "next";

`;

// ─── Core Generator ───────────────────────────────────────────────────────────

/**
 * Scans the project's app/ and/or pages/ directories, builds a nested route
 * tree, and writes a statically-typed TypeScript file.
 *
 * Only writes the file if the content has structurally changed,
 * preventing Next.js dev server infinite recompilation loops.
 */
export function generateRoutes(userConfig: RouteGenConfig = {}): void {
  console.log("🔄 Scanning route structure...");

  try {
    const config = resolveConfig(userConfig);
    const flatRoutes = collectFlatRoutes(config);

    if (Object.keys(flatRoutes).length === 0) {
      console.warn(
        "⚠️  No routes found. Make sure your app or pages directory exists and contains page files.",
      );
      return;
    }

    const nested = buildNestedRoutes(flatRoutes);
    const routesString = stringifyRoutes(nested);
    const content = `${FILE_HEADER}export const ROUTES = ${routesString} as const;\n\nexport type RoutePath = typeof ROUTES;\n`;

    writeIfChanged(config.outputPath, content);
  } catch (error) {
    console.error("❌ Error generating routes:", (error as Error).message);
  }
}

// ─── Route Collection ─────────────────────────────────────────────────────────

/**
 * Collects flat routes from app and/or pages directories
 * based on the resolved routerType configuration.
 */
function collectFlatRoutes(config: {
  routerType: string;
  appDir: string | null;
  pagesDir: string | null;
  basePath: string;
  ignore: string[];
}): Record<string, string> {
  const flatRoutes: Record<string, string> = {};

  const useApp =
    config.routerType === "app" ||
    config.routerType === "both" ||
    (config.routerType === "auto" && config.appDir !== null);

  const usePages =
    config.routerType === "pages" ||
    config.routerType === "both" ||
    (config.routerType === "auto" &&
      config.pagesDir !== null &&
      config.appDir === null);

  if (useApp && config.appDir) {
    Object.assign(
      flatRoutes,
      traverseAppDir(config.appDir, config.basePath, config.ignore),
    );
  }

  if (usePages && config.pagesDir) {
    Object.assign(
      flatRoutes,
      traversePagesDir(config.pagesDir, config.basePath, config.ignore),
    );
  }

  return flatRoutes;
}

// ─── Change-Detection Writer ──────────────────────────────────────────────────

/**
 * Writes content to the output path only if it differs from existing content.
 * Creates parent directories as needed.
 */
function writeIfChanged(outputPath: string, content: string): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (fs.existsSync(outputPath)) {
    const existingContent = fs.readFileSync(outputPath, "utf-8");
    if (existingContent === content) {
      console.log(`ℹ️  Routes are up-to-date at: ${outputPath}`);
      return;
    }
  }

  fs.writeFileSync(outputPath, content, "utf-8");
  console.log(`✅ Routes generated at: ${outputPath}`);
}

import fs from "node:fs";
import path from "node:path";
import type { RouteGenConfig, ResolvedConfig } from "./types.js";

// ─── Directory Detection ──────────────────────────────────────────────────────

interface DetectedStructure {
  appDir: string | null;
  pagesDir: string | null;
  basePath: string;
}

/**
 * Scans the current working directory for Next.js app/ and pages/ directories.
 * Checks both `src/` and root-level variants, preferring `src/` when present.
 */
export function detectNextJsStructure(): DetectedStructure {
  const cwd = process.cwd();

  const appCandidates = ["src/app", "app"];
  const pagesCandidates = ["src/pages", "pages"];

  const appDir =
    appCandidates
      .map((d) => path.resolve(cwd, d))
      .find((d) => fs.existsSync(d)) ?? null;

  const pagesDir =
    pagesCandidates
      .map((d) => path.resolve(cwd, d))
      .find((d) => fs.existsSync(d)) ?? null;

  const basePath = detectBasePath(cwd);

  return { appDir, pagesDir, basePath };
}

// ─── Base Path Detection ──────────────────────────────────────────────────────

const NEXT_CONFIG_FILES = [
  "next.config.ts",
  "next.config.mjs",
  "next.config.js",
];

/**
 * Parses basePath from the project's next.config.* file via regex.
 * Returns an empty string if no basePath is configured.
 */
function detectBasePath(cwd: string): string {
  for (const configFile of NEXT_CONFIG_FILES) {
    const configPath = path.join(cwd, configFile);
    if (!fs.existsSync(configPath)) continue;

    try {
      const content = fs.readFileSync(configPath, "utf-8");
      const match = content.match(/basePath\s*:\s*["']([^"']+)["']/);
      if (match?.[1]) return match[1];
    } catch {
      // Silently skip unreadable config files
    }
  }

  return "";
}

// ─── Config Loading ───────────────────────────────────────────────────────────

/**
 * Merges configuration from three sources (lowest to highest priority):
 * 1. Auto-detected values (directory scanning)
 * 2. `routes.config.json` file in project root
 * 3. Programmatic overrides passed by the user
 */
export function loadConfig(userConfig: RouteGenConfig = {}): RouteGenConfig {
  const cwd = process.cwd();
  const configPath = path.join(cwd, "routes.config.json");
  let fileConfig: RouteGenConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      const fileContent = fs.readFileSync(configPath, "utf-8");
      fileConfig = JSON.parse(fileContent) as RouteGenConfig;
    } catch (error) {
      console.warn(
        "⚠️  Failed to parse routes.config.json:",
        (error as Error).message,
      );
    }
  }

  return {
    ...fileConfig,
    ...userConfig,
  };
}

// ─── Config Resolution ────────────────────────────────────────────────────────

/**
 * Resolves all config values into a fully concrete ResolvedConfig
 * by merging user overrides, file config, and auto-detected values.
 */
export function resolveConfig(userConfig: RouteGenConfig = {}): ResolvedConfig {
  const detected = detectNextJsStructure();
  const merged = loadConfig(userConfig);

  return {
    appDir: merged.appDir
      ? path.resolve(process.cwd(), merged.appDir)
      : detected.appDir,
    pagesDir: merged.pagesDir
      ? path.resolve(process.cwd(), merged.pagesDir)
      : detected.pagesDir,
    basePath: merged.basePath ?? detected.basePath,
    outputPath: merged.outputPath
      ? path.resolve(process.cwd(), merged.outputPath)
      : resolveOutputPath(detected),
    ignore: merged.ignore ?? [],
    routerType: merged.routerType ?? "auto",
  };
}

/**
 * Determines the default output file path based on detected directory structure.
 * Places the generated file alongside the router directory.
 */
export function resolveOutputPath(detected: {
  appDir: string | null;
  pagesDir: string | null;
}): string {
  if (detected.appDir) {
    return path.join(detected.appDir, "router-path.ts");
  }
  if (detected.pagesDir) {
    return path.join(path.dirname(detected.pagesDir), "router-path.ts");
  }
  return path.join(process.cwd(), "app", "router-path.ts");
}

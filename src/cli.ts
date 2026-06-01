#!/usr/bin/env node

import type { RouteGenConfig } from "./types.js";
import { generateRoutes } from "./core.js";
import { startRouteWatcher } from "./watcher.js";

// ─── Argument Parsing ─────────────────────────────────────────────────────────

const HELP_TEXT = `
@corrodekit/next-routes — Auto-generate type-safe route manifests for Next.js

Usage:
  corrode-routes [options]

Options:
  --watch              Watch for file changes and regenerate routes
  --output <path>      Custom output file path (default: auto-detected)
  --base-path <path>   Base path prefix for all routes
  --router-type <type> Router type: app, pages, both, auto (default: auto)
  --help               Show this help message

Examples:
  corrode-routes                          # One-shot generation
  corrode-routes --watch                  # Watch mode for development
  corrode-routes --output src/routes.ts   # Custom output path
  corrode-routes --router-type both       # Scan both app and pages dirs
`;

/** Reads the value immediately after a CLI flag, or undefined if missing. */
function getFlagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function parseArgs(argv: string[]): {
  isWatch: boolean;
  isHelp: boolean;
  config: RouteGenConfig;
} {
  const isWatch = argv.includes("--watch");
  const isHelp = argv.includes("--help") || argv.includes("-h");

  const config: RouteGenConfig = {};

  const outputPath = getFlagValue(argv, "--output");
  if (outputPath) config.outputPath = outputPath;

  const basePath = getFlagValue(argv, "--base-path");
  if (basePath) config.basePath = basePath;

  const routerType = getFlagValue(argv, "--router-type");
  if (routerType) {
    if (isValidRouterType(routerType)) {
      config.routerType = routerType;
    } else {
      console.warn(
        `⚠️  Invalid --router-type "${routerType}". Must be: app, pages, both, auto`,
      );
    }
  }

  return { isWatch, isHelp, config };
}

function isValidRouterType(
  value: string,
): value is "app" | "pages" | "both" | "auto" {
  return ["app", "pages", "both", "auto"].includes(value);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const { isWatch, isHelp, config } = parseArgs(process.argv.slice(2));

  if (isHelp) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (isWatch) {
    startRouteWatcher(config);
  } else {
    generateRoutes(config);
  }
}

main();

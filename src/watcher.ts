import path from "node:path";
import { watch } from "chokidar";
import type { RouteGenConfig } from "./types.js";
import { resolveConfig } from "./detection.js";
import { generateRoutes } from "./core.js";
import { debounce } from "./helpers.js";

// ─── Singleton Guard ──────────────────────────────────────────────────────────

/**
 * Symbol key used on globalThis to ensure only one watcher instance
 * exists across Next.js HMR reloads. Without this, each hot reload
 * of next.config.ts would spawn an additional watcher.
 */
const WATCHER_KEY = Symbol.for("CORRODE_NEXT_ROUTE_WATCHER");

// ─── Watcher ──────────────────────────────────────────────────────────────────

/**
 * Starts a file watcher that regenerates routes on directory changes.
 * Uses chokidar for reliable cross-platform watching (Windows, macOS, Linux).
 *
 * Safety guards:
 * - No-op in production (NODE_ENV !== "development")
 * - Singleton — won't spawn duplicate watchers during HMR
 * - Ignores changes to the generated output file itself
 * - Debounced — coalesces rapid filesystem events into a single regeneration
 */
export function startRouteWatcher(config: RouteGenConfig = {}): void {
  // Production guard: route files should be pre-generated at build time
  if (process.env.NODE_ENV !== "development") return;

  // Singleton guard: prevent duplicate watchers in Next.js HMR
  const globalStore = globalThis as typeof globalThis & {
    [key: symbol]: boolean | undefined;
  };
  if (globalStore[WATCHER_KEY]) return;
  globalStore[WATCHER_KEY] = true;

  const resolved = resolveConfig(config);

  const dirsToWatch = [resolved.appDir, resolved.pagesDir].filter(
    (dir): dir is string => dir !== null,
  );

  if (dirsToWatch.length === 0) {
    console.warn("⚠️  No app or pages directory found to watch.");
    return;
  }

  // Run initial generation before starting the watcher
  generateRoutes(config);

  const outputFilename = path.basename(resolved.outputPath);
  const debouncedGenerate = debounce(() => generateRoutes(config), 500);

  const watcher = watch(dirsToWatch, {
    persistent: true,
    ignoreInitial: true,
    ignored: [
      /(^|[/\\])\./, // dotfiles
      "**/node_modules/**", // dependencies
      `**/${outputFilename}`, // the generated file itself
    ],
  });

  watcher.on("all", (_event, changedPath) => {
    // Extra safety: skip if the changed file is the output file
    if (changedPath && path.basename(changedPath) === outputFilename) return;
    debouncedGenerate();
  });

  for (const dir of dirsToWatch) {
    console.log(`👀 Watching: ${dir}`);
  }
}

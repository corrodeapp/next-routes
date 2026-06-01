import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { traverseAppDir, traversePagesDir } from "../src/traversal.js";

// ─── Test Fixture Helpers ─────────────────────────────────────────────────────

let testDir: string;

function createDir(...segments: string[]): void {
  fs.mkdirSync(path.join(testDir, ...segments), { recursive: true });
}

function createFile(...segments: string[]): void {
  const filePath = path.join(testDir, ...segments);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "// test file", "utf-8");
}

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "corrode-test-"));
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

// ─── App Router Traversal ─────────────────────────────────────────────────────

describe("traverseAppDir", () => {
  it("detects root page.tsx", () => {
    createFile("page.tsx");

    const routes = traverseAppDir(testDir, "", []);
    expect(routes).toEqual({ HOME: "/" });
  });

  it("detects nested page files", () => {
    createFile("page.tsx");
    createFile("dashboard", "page.tsx");
    createFile("auth", "login", "page.tsx");

    const routes = traverseAppDir(testDir, "", []);
    expect(routes).toEqual({
      HOME: "/",
      DASHBOARD: "/dashboard",
      "AUTH.LOGIN": "/auth/login",
    });
  });

  it("handles route groups (transparent in URL)", () => {
    createFile("(auth)", "login", "page.tsx");
    createFile("(auth)", "register", "page.tsx");

    const routes = traverseAppDir(testDir, "", []);
    expect(routes).toEqual({
      LOGIN: "/login",
      REGISTER: "/register",
    });
  });

  it("handles dynamic segments", () => {
    createFile("users", "[id]", "page.tsx");

    const routes = traverseAppDir(testDir, "", []);
    expect(routes).toEqual({
      "USERS.ID": "/users/[id]",
    });
  });

  it("handles catch-all segments", () => {
    createFile("docs", "[...slug]", "page.tsx");

    const routes = traverseAppDir(testDir, "", []);
    expect(routes).toEqual({
      "DOCS.SLUG": "/docs/[...slug]",
    });
  });

  it("prepends basePath to all routes", () => {
    createFile("page.tsx");
    createFile("about", "page.tsx");

    const routes = traverseAppDir(testDir, "/app", []);
    expect(routes).toEqual({
      HOME: "/app/",
      ABOUT: "/app/about",
    });
  });

  it("ignores private folders (underscore prefix)", () => {
    createFile("_components", "page.tsx");
    createFile("dashboard", "page.tsx");

    const routes = traverseAppDir(testDir, "", []);
    expect(routes).toEqual({ DASHBOARD: "/dashboard" });
  });

  it("ignores parallel routes (@ prefix)", () => {
    createFile("@modal", "page.tsx");
    createFile("dashboard", "page.tsx");

    const routes = traverseAppDir(testDir, "", []);
    expect(routes).toEqual({ DASHBOARD: "/dashboard" });
  });

  it("ignores intercepting routes", () => {
    createFile("(.)", "page.tsx");
    createFile("(..)", "page.tsx");
    createFile("dashboard", "page.tsx");

    const routes = traverseAppDir(testDir, "", []);
    expect(routes).toEqual({ DASHBOARD: "/dashboard" });
  });

  it("ignores api folder", () => {
    createFile("api", "page.tsx");
    createFile("dashboard", "page.tsx");

    const routes = traverseAppDir(testDir, "", []);
    expect(routes).toEqual({ DASHBOARD: "/dashboard" });
  });

  it("respects extra ignore list", () => {
    createFile("components", "page.tsx");
    createFile("dashboard", "page.tsx");

    const routes = traverseAppDir(testDir, "", ["components"]);
    expect(routes).toEqual({ DASHBOARD: "/dashboard" });
  });

  it("skips directories without page files", () => {
    createDir("utils");
    createFile("utils", "helper.ts");
    createFile("dashboard", "page.tsx");

    const routes = traverseAppDir(testDir, "", []);
    expect(routes).toEqual({ DASHBOARD: "/dashboard" });
  });

  it("returns empty record for non-existent directory", () => {
    const routes = traverseAppDir("/nonexistent/path", "", []);
    expect(routes).toEqual({});
  });

  it("detects page.jsx, page.js, page.ts variants", () => {
    createFile("a", "page.jsx");
    createFile("b", "page.js");
    createFile("c", "page.ts");

    const routes = traverseAppDir(testDir, "", []);
    expect(Object.keys(routes)).toHaveLength(3);
    expect(routes.A).toBe("/a");
    expect(routes.B).toBe("/b");
    expect(routes.C).toBe("/c");
  });
});

// ─── Pages Router Traversal ──────────────────────────────────────────────────

describe("traversePagesDir", () => {
  it("detects index.tsx as root", () => {
    createFile("index.tsx");

    const routes = traversePagesDir(testDir, "", []);
    expect(routes).toEqual({ HOME: "/" });
  });

  it("detects named page files", () => {
    createFile("index.tsx");
    createFile("about.tsx");
    createFile("contact.tsx");

    const routes = traversePagesDir(testDir, "", []);
    expect(routes).toEqual({
      HOME: "/",
      ABOUT: "/about",
      CONTACT: "/contact",
    });
  });

  it("detects nested directory structure", () => {
    createFile("dashboard", "index.tsx");
    createFile("dashboard", "settings.tsx");

    const routes = traversePagesDir(testDir, "", []);
    expect(routes).toEqual({
      DASHBOARD: "/dashboard",
      "DASHBOARD.SETTINGS": "/dashboard/settings",
    });
  });

  it("skips _app, _document, _error, _middleware", () => {
    createFile("_app.tsx");
    createFile("_document.tsx");
    createFile("_error.tsx");
    createFile("_middleware.ts");
    createFile("index.tsx");

    const routes = traversePagesDir(testDir, "", []);
    expect(routes).toEqual({ HOME: "/" });
  });

  it("handles dynamic filenames", () => {
    createFile("users", "[id].tsx");

    const routes = traversePagesDir(testDir, "", []);
    expect(routes).toEqual({
      "USERS.ID": "/users/[id]",
    });
  });

  it("prepends basePath", () => {
    createFile("index.tsx");
    createFile("about.tsx");

    const routes = traversePagesDir(testDir, "/base", []);
    expect(routes).toEqual({
      HOME: "/base/",
      ABOUT: "/base/about",
    });
  });

  it("ignores non-page file extensions", () => {
    createFile("index.tsx");
    createFile("styles.css");
    createFile("data.json");

    const routes = traversePagesDir(testDir, "", []);
    expect(routes).toEqual({ HOME: "/" });
  });

  it("returns empty record for non-existent directory", () => {
    const routes = traversePagesDir("/nonexistent/path", "", []);
    expect(routes).toEqual({});
  });
});

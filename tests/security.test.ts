import { describe, it, expect } from "vitest";
import {
  sanitizeConfigJson,
  assertPathWithinProject,
  validateBasePath,
  isSymbolicLink,
} from "../src/security.js";
import type { Dirent } from "node:fs";

// ─── sanitizeConfigJson ───────────────────────────────────────────────────────

describe("sanitizeConfigJson", () => {
  it("preserves valid config keys", () => {
    const input = {
      outputPath: "routes.ts",
      basePath: "/app",
      ignore: ["api"],
    };
    expect(sanitizeConfigJson(input)).toEqual(input);
  });

  it("strips __proto__ key", () => {
    const malicious = JSON.parse(
      '{"__proto__": {"polluted": true}, "outputPath": "ok.ts"}',
    );
    const result = sanitizeConfigJson(malicious);
    expect(result).toEqual({ outputPath: "ok.ts" });
    expect(Object.hasOwn(result, "__proto__")).toBe(false);
  });

  it("strips constructor key", () => {
    const malicious = {
      constructor: { prototype: { polluted: true } },
      basePath: "/x",
    };
    const result = sanitizeConfigJson(malicious);
    expect(result).toEqual({ basePath: "/x" });
    expect(Object.hasOwn(result, "constructor")).toBe(false);
  });

  it("strips prototype key", () => {
    const malicious = { prototype: { evil: true }, outputPath: "safe.ts" };
    const result = sanitizeConfigJson(malicious);
    expect(result).toEqual({ outputPath: "safe.ts" });
    expect(Object.hasOwn(result, "prototype")).toBe(false);
  });

  it("strips all poisoned keys simultaneously", () => {
    const malicious = JSON.parse(
      '{"__proto__": {}, "constructor": {}, "prototype": {}, "outputPath": "good.ts"}',
    );
    const result = sanitizeConfigJson(malicious);
    expect(Object.keys(result)).toEqual(["outputPath"]);
  });

  it("does not pollute Object.prototype after sanitization", () => {
    const malicious = JSON.parse('{"__proto__": {"injected": true}}');
    sanitizeConfigJson(malicious);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((Object.prototype as any).injected).toBeUndefined();
  });

  it("returns empty object for null input", () => {
    expect(sanitizeConfigJson(null)).toEqual({});
  });

  it("returns empty object for array input", () => {
    expect(sanitizeConfigJson([1, 2, 3])).toEqual({});
  });

  it("returns empty object for primitive input", () => {
    expect(sanitizeConfigJson("string")).toEqual({});
    expect(sanitizeConfigJson(42)).toEqual({});
    expect(sanitizeConfigJson(true)).toEqual({});
  });
});

// ─── assertPathWithinProject ──────────────────────────────────────────────────

describe("assertPathWithinProject", () => {
  const projectRoot =
    process.platform === "win32"
      ? "C:\\Users\\test\\project"
      : "/home/test/project";

  it("allows paths inside the project root", () => {
    const insidePath =
      process.platform === "win32"
        ? "C:\\Users\\test\\project\\src\\app"
        : "/home/test/project/src/app";

    expect(() =>
      assertPathWithinProject(insidePath, "appDir", projectRoot),
    ).not.toThrow();
  });

  it("allows paths at the project root level (file in root)", () => {
    const rootFile =
      process.platform === "win32"
        ? "C:\\Users\\test\\project\\routes.ts"
        : "/home/test/project/routes.ts";

    expect(() =>
      assertPathWithinProject(rootFile, "outputPath", projectRoot),
    ).not.toThrow();
  });

  it("rejects paths that escape via ../", () => {
    const escapedPath =
      process.platform === "win32"
        ? "C:\\Users\\test\\other"
        : "/home/test/other";

    expect(() =>
      assertPathWithinProject(escapedPath, "outputPath", projectRoot),
    ).toThrow(/Security.*outside the project root/);
  });

  it("rejects paths in a sibling directory", () => {
    const siblingPath =
      process.platform === "win32"
        ? "C:\\Users\\test\\project-evil\\attack.ts"
        : "/home/test/project-evil/attack.ts";

    expect(() =>
      assertPathWithinProject(siblingPath, "outputPath", projectRoot),
    ).toThrow(/Security/);
  });

  it("rejects absolute paths to system directories", () => {
    const systemPath =
      process.platform === "win32"
        ? "C:\\Windows\\System32\\evil.ts"
        : "/etc/cron.d/evil";

    expect(() =>
      assertPathWithinProject(systemPath, "outputPath", projectRoot),
    ).toThrow(/Security/);
  });

  it("error message includes the label and resolved path", () => {
    const outsidePath =
      process.platform === "win32" ? "C:\\tmp\\attack.ts" : "/tmp/attack.ts";

    expect(() =>
      assertPathWithinProject(outsidePath, "outputPath", projectRoot),
    ).toThrow(/outputPath/);
  });

  it("prevents prefix-based bypass (e.g. /project-evil vs /project)", () => {
    // Ensures the check uses separator-aware comparison, not just startsWith
    const trickPath = projectRoot + "-evil";

    expect(() =>
      assertPathWithinProject(trickPath, "appDir", projectRoot),
    ).toThrow(/Security/);
  });
});

// ─── validateBasePath ─────────────────────────────────────────────────────────

describe("validateBasePath", () => {
  it("accepts empty string (no basePath)", () => {
    expect(validateBasePath("")).toBe("");
  });

  it("accepts valid basePath '/app'", () => {
    expect(validateBasePath("/app")).toBe("/app");
  });

  it("accepts nested basePath '/my/app'", () => {
    expect(validateBasePath("/my/app")).toBe("/my/app");
  });

  it("accepts basePath with hyphens '/my-app'", () => {
    expect(validateBasePath("/my-app")).toBe("/my-app");
  });

  it("accepts basePath with underscores '/my_app'", () => {
    expect(validateBasePath("/my_app")).toBe("/my_app");
  });

  it("rejects basePath not starting with /", () => {
    expect(validateBasePath("app")).toBe("");
  });

  it("rejects basePath ending with / (except root)", () => {
    expect(validateBasePath("/app/")).toBe("");
  });

  it("rejects basePath with traversal sequence '..'", () => {
    expect(validateBasePath("/app/../etc")).toBe("");
  });

  it("rejects basePath with special characters", () => {
    expect(validateBasePath("/app/<script>")).toBe("");
    expect(validateBasePath('/app/"test')).toBe("");
    expect(validateBasePath("/app/ space")).toBe("");
  });

  it("rejects basePath with backslashes", () => {
    expect(validateBasePath("/app\\evil")).toBe("");
  });

  it("rejects basePath containing only traversal", () => {
    expect(validateBasePath("/..")).toBe("");
  });
});

// ─── isSymbolicLink ───────────────────────────────────────────────────────────

describe("isSymbolicLink", () => {
  it("returns true for symlink entries", () => {
    const symlinkEntry = { isSymbolicLink: () => true } as unknown as Dirent;
    expect(isSymbolicLink(symlinkEntry)).toBe(true);
  });

  it("returns false for regular directory entries", () => {
    const regularEntry = { isSymbolicLink: () => false } as unknown as Dirent;
    expect(isSymbolicLink(regularEntry)).toBe(false);
  });
});

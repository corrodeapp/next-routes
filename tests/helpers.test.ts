import { describe, it, expect } from "vitest";
import { segmentToKey, generateKey, shouldIgnoreFolder } from "../src/helpers.js";

// ─── segmentToKey ─────────────────────────────────────────────────────────────

describe("segmentToKey", () => {
  it("converts a plain segment to SCREAMING_SNAKE_CASE", () => {
    expect(segmentToKey("dashboard")).toBe("DASHBOARD");
  });

  it("converts hyphenated segments", () => {
    expect(segmentToKey("forgot-password")).toBe("FORGOT_PASSWORD");
  });

  it("strips dynamic brackets", () => {
    expect(segmentToKey("[id]")).toBe("ID");
  });

  it("strips catch-all dots and brackets", () => {
    expect(segmentToKey("[...slug]")).toBe("SLUG");
  });

  it("handles multi-word dynamic segments", () => {
    expect(segmentToKey("[user-id]")).toBe("USER_ID");
  });
});

// ─── generateKey ──────────────────────────────────────────────────────────────

describe("generateKey", () => {
  it('returns "HOME" for root path', () => {
    expect(generateKey("/")).toBe("HOME");
  });

  it('returns "HOME" for empty string', () => {
    expect(generateKey("")).toBe("HOME");
  });

  it("generates dot-separated keys from path segments", () => {
    expect(generateKey("/dashboard/analytics")).toBe("DASHBOARD.ANALYTICS");
  });

  it("handles dynamic segments in paths", () => {
    expect(generateKey("/catalog/tracks/[id]")).toBe("CATALOG.TRACKS.ID");
  });

  it("handles catch-all segments", () => {
    expect(generateKey("/docs/[...slug]")).toBe("DOCS.SLUG");
  });

  it("handles deeply nested paths", () => {
    expect(generateKey("/a/b/c/d/e")).toBe("A.B.C.D.E");
  });
});

// ─── shouldIgnoreFolder ───────────────────────────────────────────────────────

describe("shouldIgnoreFolder", () => {
  it("ignores private folders (underscore prefix)", () => {
    expect(shouldIgnoreFolder("_components", [])).toBe(true);
    expect(shouldIgnoreFolder("_lib", [])).toBe(true);
  });

  it("ignores parallel routes (@ prefix)", () => {
    expect(shouldIgnoreFolder("@modal", [])).toBe(true);
  });

  it("ignores node_modules", () => {
    expect(shouldIgnoreFolder("node_modules", [])).toBe(true);
  });

  it("ignores dotfiles/dotfolders", () => {
    expect(shouldIgnoreFolder(".git", [])).toBe(true);
    expect(shouldIgnoreFolder(".next", [])).toBe(true);
  });

  it("ignores api folder", () => {
    expect(shouldIgnoreFolder("api", [])).toBe(true);
  });

  it("ignores intercepting routes", () => {
    expect(shouldIgnoreFolder("(.)", [])).toBe(true);
    expect(shouldIgnoreFolder("(..)", [])).toBe(true);
    expect(shouldIgnoreFolder("(...)", [])).toBe(true);
  });

  it("does NOT ignore regular route groups", () => {
    expect(shouldIgnoreFolder("(auth)", [])).toBe(false);
    expect(shouldIgnoreFolder("(marketing)", [])).toBe(false);
  });

  it("ignores user-specified extra folders", () => {
    expect(shouldIgnoreFolder("components", ["components"])).toBe(true);
  });

  it("allows normal folders", () => {
    expect(shouldIgnoreFolder("dashboard", [])).toBe(false);
    expect(shouldIgnoreFolder("auth", [])).toBe(false);
  });
});

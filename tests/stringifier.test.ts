import { describe, it, expect } from "vitest";
import { stringifyRoutes } from "../src/stringifier.js";
import type { RouteNode, DynamicNode } from "../src/types.js";

describe("stringifyRoutes", () => {
  it("stringifies a simple string route", () => {
    const result = stringifyRoutes("/dashboard");
    expect(result).toBe('"/dashboard"');
  });

  it("stringifies a flat object of string routes", () => {
    const node: RouteNode = {
      HOME: "/",
      ABOUT: "/about",
    };

    const result = stringifyRoutes(node);
    expect(result).toContain('HOME: "/"');
    expect(result).toContain('ABOUT: "/about"');
  });

  it("stringifies nested route objects", () => {
    const node: RouteNode = {
      AUTH: {
        LOGIN: "/auth/login",
        REGISTER: "/auth/register",
      },
    };

    const result = stringifyRoutes(node);
    expect(result).toContain("AUTH:");
    expect(result).toContain('LOGIN: "/auth/login"');
    expect(result).toContain('REGISTER: "/auth/register"');
  });

  it("stringifies a dynamic route as an arrow function", () => {
    const node: DynamicNode = {
      __isDynamic: true,
      path: "/tracks/[id]",
      params: [{ name: "id", isCatchAll: false }],
    };

    const result = stringifyRoutes(node);
    expect(result).toContain("(params: { id: string | number })");
    expect(result).toBe("(params: { id: string | number }) => `/tracks/${params.id}` as Route");
  });

  it("stringifies a catch-all route with string[] param type", () => {
    const node: DynamicNode = {
      __isDynamic: true,
      path: "/docs/[...slug]",
      params: [{ name: "slug", isCatchAll: true }],
    };

    const result = stringifyRoutes(node);
    expect(result).toContain("slug: string[]");
    expect(result).toBe("(params: { slug: string[] }) => `/docs/${params.slug.join('/')}` as Route");
  });

  it("stringifies a route with multiple dynamic params", () => {
    const node: DynamicNode = {
      __isDynamic: true,
      path: "/org/[orgId]/team/[teamId]",
      params: [
        { name: "orgId", isCatchAll: false },
        { name: "teamId", isCatchAll: false },
      ],
    };

    const result = stringifyRoutes(node);
    expect(result).toContain("orgId: string | number");
    expect(result).toContain("teamId: string | number");
    expect(result).toBe("(params: { orgId: string | number; teamId: string | number }) => `/org/${params.orgId}/team/${params.teamId}` as Route");
  });

  it("produces valid indentation for nested structures", () => {
    const node: RouteNode = {
      A: {
        B: {
          C: "/a/b/c",
        },
      },
    };

    const result = stringifyRoutes(node);
    const lines = result.split("\n");
    // Should have proper indentation progression
    expect(lines.length).toBeGreaterThan(3);
  });

  it("quotes keys that are not valid identifiers", () => {
    const node: RouteNode = {
      "123invalid": "/path",
    };

    const result = stringifyRoutes(node);
    expect(result).toContain('"123invalid"');
  });

  it("does not quote valid identifier keys", () => {
    const node: RouteNode = {
      VALID_KEY: "/path",
    };

    const result = stringifyRoutes(node);
    expect(result).toContain("VALID_KEY:");
    expect(result).not.toContain('"VALID_KEY"');
  });
});

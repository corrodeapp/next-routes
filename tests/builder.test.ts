import { describe, it, expect } from "vitest";
import { buildNestedRoutes } from "../src/builder.js";

describe("buildNestedRoutes", () => {
  it("places HOME at the root level", () => {
    const result = buildNestedRoutes({ HOME: "/" });
    expect(result).toEqual({ HOME: "/" });
  });

  it("nests single-level routes", () => {
    const result = buildNestedRoutes({
      HOME: "/",
      "AUTH.LOGIN": "/auth/login",
      "AUTH.REGISTER": "/auth/register",
    });

    expect(result).toEqual({
      HOME: "/",
      AUTH: {
        LOGIN: "/auth/login",
        REGISTER: "/auth/register",
      },
    });
  });

  it("promotes a leaf to ROOT when a parent also has children", () => {
    const result = buildNestedRoutes({
      DASHBOARD: "/dashboard",
      "DASHBOARD.ANALYTICS": "/dashboard/analytics",
    });

    expect(result).toEqual({
      DASHBOARD: {
        ROOT: "/dashboard",
        ANALYTICS: "/dashboard/analytics",
      },
    });
  });

  it("handles deeply nested routes", () => {
    const result = buildNestedRoutes({
      "DASHBOARD.CATALOG.TRACKS": "/dashboard/catalog/tracks",
    });

    expect(result).toEqual({
      DASHBOARD: {
        CATALOG: {
          TRACKS: "/dashboard/catalog/tracks",
        },
      },
    });
  });

  it("creates DynamicNode for routes with dynamic segments", () => {
    const result = buildNestedRoutes({
      "CATALOG.TRACKS.ID": "/catalog/tracks/[id]",
    });

    const node = (result as Record<string, unknown>).CATALOG as Record<string, unknown>;
    const tracks = node.TRACKS as Record<string, unknown>;
    const idNode = tracks.ID as Record<string, unknown>;

    expect(idNode.__isDynamic).toBe(true);
    expect(idNode.path).toBe("/catalog/tracks/[id]");
    expect(idNode.params).toEqual([{ name: "id", isCatchAll: false }]);
  });

  it("creates DynamicNode for catch-all routes", () => {
    const result = buildNestedRoutes({
      "DOCS.SLUG": "/docs/[...slug]",
    });

    const docs = (result as Record<string, unknown>).DOCS as Record<string, unknown>;
    const slugNode = docs.SLUG as Record<string, unknown>;

    expect(slugNode.__isDynamic).toBe(true);
    expect(slugNode.path).toBe("/docs/[...slug]");
    expect(slugNode.params).toEqual([{ name: "slug", isCatchAll: true }]);
  });

  it("promotes dynamic leaf to ROOT when parent also has children", () => {
    const result = buildNestedRoutes({
      "USER.ID": "/user/[id]",
      "USER.ID.SETTINGS": "/user/[id]/settings",
    });

    const user = (result as Record<string, unknown>).USER as Record<string, unknown>;
    const id = user.ID as Record<string, unknown>;

    // The /user/[id] route is promoted to ROOT
    expect(id.ROOT).toBeDefined();
    expect((id.ROOT as Record<string, unknown>).__isDynamic).toBe(true);

    // /user/[id]/settings also contains a dynamic segment, so it's a DynamicNode too
    const settings = id.SETTINGS as Record<string, unknown>;
    expect(settings.__isDynamic).toBe(true);
    expect(settings.path).toBe("/user/[id]/settings");
  });

  it("handles empty input", () => {
    const result = buildNestedRoutes({});
    expect(result).toEqual({});
  });

  it("handles multiple top-level routes", () => {
    const result = buildNestedRoutes({
      HOME: "/",
      ABOUT: "/about",
      CONTACT: "/contact",
    });

    expect(result).toEqual({
      HOME: "/",
      ABOUT: "/about",
      CONTACT: "/contact",
    });
  });

  it("sanitizes dynamic parameter names to prevent injection", () => {
    const result = buildNestedRoutes({
      "HACK.ID": "/hack/[id_any = console.log('HACKED_PARAM')]",
    });

    const hack = (result as Record<string, unknown>).HACK as Record<string, unknown>;
    const idNode = hack.ID as Record<string, unknown>;

    expect(idNode.__isDynamic).toBe(true);
    expect(idNode.params).toEqual([{ name: "id_anyconsolelogHACKED_PARAM", isCatchAll: false }]);
  });
});

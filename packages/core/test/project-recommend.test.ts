import { describe, expect, it } from "vitest";
import {
  CODEBASE_MEMORY_FILE_THRESHOLD,
  CODEBASE_MEMORY_MONOREPO_FILE_THRESHOLD,
  recommendCapabilities,
} from "../src/project/recommend.js";
import type { ProjectSignals } from "../src/project/signals.js";

/** A minimal, all-facts-false baseline so each test only sets what it means to test. */
function baseSignals(overrides: Partial<ProjectSignals> = {}): ProjectSignals {
  return {
    projectDir: "/project",
    packageJson: {
      present: true,
      valid: true,
      path: "/project/package.json",
      name: "fixture",
      packageManager: undefined,
      error: undefined,
    },
    packageManager: { name: undefined, source: undefined, lockfiles: [], ambiguous: false },
    typescript: { dependency: undefined, tsconfig: false },
    angular: undefined,
    testFrameworks: [],
    browserTesting: [],
    observability: [],
    dataTooling: [],
    accessibilityTooling: [],
    containers: { dockerfile: false, compose: false },
    ci: { githubActions: false },
    monorepo: { detected: false, markers: [] },
    repositorySize: { filesScanned: 0, capped: false },
    localTools: { rtkAvailable: false },
    ...overrides,
  };
}

function packNames(result: ReturnType<typeof recommendCapabilities>): readonly string[] {
  return result.packs.map((pack) => pack.name);
}

function capabilityNames(result: ReturnType<typeof recommendCapabilities>): readonly string[] {
  return result.capabilities.map((capability) => capability.name);
}

describe("recommendCapabilities", () => {
  it("recommends only technical for a bare package.json", () => {
    const result = recommendCapabilities(baseSignals());

    expect(packNames(result)).toEqual(["technical"]);
    expect(result.packs[0]).toMatchObject({ kind: "pack", confidence: "high" });
    expect(result.packs[0]?.reasons.length).toBeGreaterThan(0);
  });

  it("recommends nothing at all without a package.json and a small repository", () => {
    const result = recommendCapabilities(
      baseSignals({ packageJson: { ...baseSignals().packageJson, present: false } }),
    );

    expect(result.packs).toEqual([]);
    expect(result.capabilities).toEqual([]);
  });

  it("recommends typescript from a dependency and from tsconfig, deterministically", () => {
    const byDependency = recommendCapabilities(
      baseSignals({
        typescript: {
          dependency: { dependency: "typescript", field: "devDependencies" },
          tsconfig: false,
        },
      }),
    );
    const byTsconfig = recommendCapabilities(
      baseSignals({ typescript: { dependency: undefined, tsconfig: true } }),
    );

    expect(packNames(byDependency)).toEqual(["technical", "typescript"]);
    expect(packNames(byTsconfig)).toEqual(["technical", "typescript"]);
    expect(recommendCapabilities(baseSignals())).toEqual(recommendCapabilities(baseSignals()));
  });

  it("recommends angular only from @angular/core, and includes typescript alongside it", () => {
    const result = recommendCapabilities(
      baseSignals({
        angular: { dependency: "@angular/core", field: "dependencies" },
        typescript: {
          dependency: { dependency: "typescript", field: "devDependencies" },
          tsconfig: false,
        },
      }),
    );

    expect(packNames(result)).toEqual(["technical", "typescript", "angular"]);
  });

  it("recommends testing once for overlapping test-framework and browser-testing signals", () => {
    const result = recommendCapabilities(
      baseSignals({
        testFrameworks: [{ dependency: "vitest", field: "devDependencies" }],
        browserTesting: [{ dependency: "@playwright/test", field: "devDependencies" }],
      }),
    );

    const testing = result.packs.find((pack) => pack.name === "testing");

    expect(testing).toBeDefined();
    expect(testing?.reasons).toHaveLength(2);
  });

  it("recommends devops from Dockerfile or GitHub Actions independently", () => {
    const dockerOnly = recommendCapabilities(
      baseSignals({ containers: { dockerfile: true, compose: false } }),
    );
    const ciOnly = recommendCapabilities(baseSignals({ ci: { githubActions: true } }));

    expect(packNames(dockerOnly)).toContain("devops");
    expect(packNames(ciOnly)).toContain("devops");
  });

  it("recommends observability from Sentry and from OpenTelemetry", () => {
    const sentry = recommendCapabilities(
      baseSignals({ observability: [{ dependency: "@sentry/node", field: "dependencies" }] }),
    );
    const otel = recommendCapabilities(
      baseSignals({ observability: [{ dependency: "@opentelemetry/api", field: "dependencies" }] }),
    );

    expect(packNames(sentry)).toContain("observability");
    expect(packNames(otel)).toContain("observability");
  });

  it("recommends data from Supabase, Drizzle or Prisma", () => {
    for (const dependency of ["@supabase/supabase-js", "drizzle-orm", "@prisma/client"]) {
      const result = recommendCapabilities(
        baseSignals({ dataTooling: [{ dependency, field: "dependencies" }] }),
      );

      expect(packNames(result)).toContain("data");
    }
  });

  it("recommends accessibility only from an explicit accessibility dependency", () => {
    const result = recommendCapabilities(
      baseSignals({ accessibilityTooling: [{ dependency: "axe-core", field: "devDependencies" }] }),
    );

    expect(packNames(result)).toContain("accessibility");
  });

  it("never recommends workflow-preference packs from any signal", () => {
    const result = recommendCapabilities(
      baseSignals({
        angular: { dependency: "@angular/core", field: "dependencies" },
        testFrameworks: [{ dependency: "vitest", field: "devDependencies" }],
        containers: { dockerfile: true, compose: true },
        ci: { githubActions: true },
        observability: [{ dependency: "@sentry/node", field: "dependencies" }],
        dataTooling: [{ dependency: "prisma", field: "dependencies" }],
        accessibilityTooling: [{ dependency: "pa11y", field: "devDependencies" }],
        monorepo: { detected: true, markers: ["turbo.json"] },
      }),
    );

    for (const workflowPack of [
      "efficiency",
      "agentic",
      "refactoring",
      "documentation",
      "security",
      "performance",
      "git",
    ]) {
      expect(packNames(result)).not.toContain(workflowPack);
    }
  });

  it("recommends every pack name against the real built-in registry", async () => {
    const { builtInPackRegistry } = await import("../src/pack/registry.js");
    const result = recommendCapabilities(
      baseSignals({
        angular: { dependency: "@angular/core", field: "dependencies" },
        testFrameworks: [{ dependency: "vitest", field: "devDependencies" }],
        containers: { dockerfile: true, compose: false },
        observability: [{ dependency: "@sentry/node", field: "dependencies" }],
        dataTooling: [{ dependency: "prisma", field: "dependencies" }],
        accessibilityTooling: [{ dependency: "axe-core", field: "devDependencies" }],
      }),
    );

    for (const pack of result.packs) {
      expect(builtInPackRegistry.has(pack.name)).toBe(true);
    }
  });

  describe("optional capabilities", () => {
    it("recommends playwright only when testing is active and @playwright/test is present", () => {
      const withTesting = recommendCapabilities(
        baseSignals({
          browserTesting: [{ dependency: "@playwright/test", field: "devDependencies" }],
        }),
      );
      const withoutPlaywrightDependency = recommendCapabilities(
        baseSignals({ testFrameworks: [{ dependency: "vitest", field: "devDependencies" }] }),
      );

      expect(capabilityNames(withTesting)).toContain("playwright");
      expect(capabilityNames(withoutPlaywrightDependency)).not.toContain("playwright");

      const playwright = withTesting.capabilities.find(
        (capability) => capability.name === "playwright",
      );
      expect(playwright?.contributedBy).toEqual(["testing"]);
      expect(playwright?.reasons.length).toBeGreaterThan(0);
    });

    it("recommends sentry and supabase from dependencies alone, without gating on a pack", () => {
      const result = recommendCapabilities(
        baseSignals({
          observability: [{ dependency: "@sentry/angular", field: "dependencies" }],
          dataTooling: [{ dependency: "@supabase/supabase-js", field: "dependencies" }],
        }),
      );

      expect(capabilityNames(result)).toEqual(expect.arrayContaining(["sentry", "supabase"]));
      const sentry = result.capabilities.find((capability) => capability.name === "sentry");
      const supabase = result.capabilities.find((capability) => capability.name === "supabase");
      expect(sentry?.contributedBy).toEqual(["observability"]);
      expect(supabase?.contributedBy).toEqual(["data"]);
    });

    it("does not recommend sentry for an OpenTelemetry-only dependency", () => {
      const result = recommendCapabilities(
        baseSignals({
          observability: [{ dependency: "@opentelemetry/api", field: "dependencies" }],
        }),
      );

      expect(capabilityNames(result)).not.toContain("sentry");
    });

    it("recommends rtk only when efficiency is configured and rtk is on PATH", () => {
      const notConfigured = recommendCapabilities(
        baseSignals({ localTools: { rtkAvailable: true } }),
      );
      const notAvailable = recommendCapabilities(
        baseSignals({ localTools: { rtkAvailable: false } }),
        {
          configuredPacks: ["efficiency"],
        },
      );
      const both = recommendCapabilities(baseSignals({ localTools: { rtkAvailable: true } }), {
        configuredPacks: ["efficiency"],
      });

      expect(capabilityNames(notConfigured)).not.toContain("rtk");
      expect(capabilityNames(notAvailable)).not.toContain("rtk");
      expect(capabilityNames(both)).toContain("rtk");
      expect(
        both.capabilities.find((capability) => capability.name === "rtk")?.contributedBy,
      ).toEqual(["efficiency"]);
    });

    it("never enables a capability — it only ever appears as a recommendation", () => {
      const result = recommendCapabilities(
        baseSignals({
          browserTesting: [{ dependency: "@playwright/test", field: "devDependencies" }],
        }),
      );

      for (const capability of result.capabilities) {
        expect(capability.kind).toBe("capability");
        expect(capability).not.toHaveProperty("enabled");
        expect(capability).not.toHaveProperty("active");
      }
    });

    it("recommends codebase-memory only above the documented heuristic threshold", () => {
      const below = recommendCapabilities(
        baseSignals({
          repositorySize: { filesScanned: CODEBASE_MEMORY_FILE_THRESHOLD - 1, capped: false },
        }),
      );
      const atThreshold = recommendCapabilities(
        baseSignals({
          repositorySize: { filesScanned: CODEBASE_MEMORY_FILE_THRESHOLD, capped: false },
        }),
      );
      const capped = recommendCapabilities(
        baseSignals({ repositorySize: { filesScanned: 3, capped: true } }),
      );

      expect(capabilityNames(below)).not.toContain("codebase-memory");
      expect(capabilityNames(atThreshold)).toContain("codebase-memory");
      expect(capabilityNames(capped)).toContain("codebase-memory");

      const recommendation = atThreshold.capabilities.find(
        (capability) => capability.name === "codebase-memory",
      );
      expect(recommendation?.confidence).toBe("medium");
      expect(recommendation?.reasons[0]).toMatch(/heuristic/i);
      expect(recommendation?.contributedBy).toEqual(["efficiency"]);
    });

    it("lowers the codebase-memory threshold in a detected monorepo", () => {
      const result = recommendCapabilities(
        baseSignals({
          monorepo: { detected: true, markers: ["pnpm-workspace.yaml"] },
          repositorySize: { filesScanned: CODEBASE_MEMORY_MONOREPO_FILE_THRESHOLD, capped: false },
        }),
      );

      expect(capabilityNames(result)).toContain("codebase-memory");
    });

    it("does not recommend every workflow pack just because a monorepo was detected", () => {
      const result = recommendCapabilities(
        baseSignals({ monorepo: { detected: true, markers: ["nx.json", "turbo.json"] } }),
      );

      expect(packNames(result)).toEqual(["technical"]);
    });
  });
});

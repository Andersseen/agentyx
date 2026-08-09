import { describe, expect, it } from "vitest";
import { getOptimizationProfile, optimizationProfileNames } from "../src/optimization/profile.js";

describe("optimization profiles", () => {
  it("defines the documented profiles in order", () => {
    expect(optimizationProfileNames).toEqual(["lean", "balanced", "autonomous"]);
  });

  it("describes MCP levels included by each profile", () => {
    expect(getOptimizationProfile("lean").mcpLevels).toEqual(["essential"]);
    expect(getOptimizationProfile("balanced").mcpLevels).toEqual(["essential", "recommended"]);
    expect(getOptimizationProfile("autonomous").mcpLevels).toEqual([
      "essential",
      "recommended",
      "optional",
    ]);
  });
});

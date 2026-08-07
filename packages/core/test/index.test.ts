import { describe, expect, it } from "vitest";
import { agnoxCoreName, getCoreStatus } from "../src/index.js";

describe("@agnox/core", () => {
  it("exposes a minimal placeholder API", () => {
    expect(agnoxCoreName).toBe("agnox-core");
    expect(getCoreStatus()).toBe("ready");
  });
});

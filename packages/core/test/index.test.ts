import { describe, expect, it } from "vitest";
import { agentyxCoreName, getCoreStatus } from "../src/index.js";

describe("@agentyx/core", () => {
  it("exposes a minimal placeholder API", () => {
    expect(agentyxCoreName).toBe("agentyx-core");
    expect(getCoreStatus()).toBe("ready");
  });
});

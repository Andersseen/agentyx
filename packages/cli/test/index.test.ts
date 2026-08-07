import { describe, expect, it } from "vitest";
import { cliVersion, createAgnoxProgram } from "../src/index.js";

describe("@agnox/cli", () => {
  it("configures the basic CLI metadata", () => {
    const program = createAgnoxProgram();

    expect(program.name()).toBe("agnox");
    expect(program.description()).toBe("Agnox — provider-agnostic tooling for coding agents.");
    expect(program.version()).toBe(cliVersion);
  });
});

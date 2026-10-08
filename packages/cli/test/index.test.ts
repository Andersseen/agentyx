import { describe, expect, it } from "vitest";
import { cliVersion, createAgentyxProgram } from "../src/index.js";

describe("@agentyx/cli", () => {
  it("configures the basic CLI metadata", () => {
    const program = createAgentyxProgram();

    expect(program.name()).toBe("agentyx");
    expect(program.description()).toBe("Agentyx — provider-agnostic tooling for coding agents.");
    expect(program.version()).toBe(cliVersion);
    expect(program.commands.map((command) => command.name())).toContain("configure");
    expect(program.commands.map((command) => command.name())).toContain("sync");
    expect(program.commands.map((command) => command.name())).not.toContain("status");
  });
});

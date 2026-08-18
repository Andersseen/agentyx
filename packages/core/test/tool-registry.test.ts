import { describe, expect, it, vi } from "vitest";
import { builtInToolNames, builtInToolRegistry } from "../src/tool/built-in.js";
import { DuplicateToolError, InvalidToolError, UnknownToolError } from "../src/tool/errors.js";
import { createToolRegistry } from "../src/tool/registry.js";

const rtk = {
  name: "rtk",
  description: "Command-output proxy.",
  kind: "executable" as const,
  command: "rtk",
};

describe("built-in tool registry", () => {
  it("ships exactly the documented tools", () => {
    expect(builtInToolRegistry.names).toEqual(["rtk"]);
    expect(builtInToolNames).toEqual(["rtk"]);
  });

  it("describes every built-in tool", () => {
    for (const name of builtInToolNames) {
      const tool = builtInToolRegistry.get(name);

      expect(tool.name).toBe(name);
      expect(tool.description).not.toBe("");
      expect(tool.command).not.toBe("");
    }
  });

  it("reports metadata without the install hint", () => {
    expect(builtInToolRegistry.listMetadata()).toEqual([
      {
        name: "rtk",
        description:
          "Rust Token Killer command-output proxy for reducing coding-agent context noise.",
        kind: "executable",
        command: "rtk",
        optional: true,
      },
    ]);
  });
});

describe("createToolRegistry", () => {
  it("indexes sources by name", () => {
    const registry = createToolRegistry([{ name: "rtk", load: () => rtk }]);

    expect(registry.names).toEqual(["rtk"]);
    expect(registry.has("rtk")).toBe(true);
    expect(registry.has("nope")).toBe(false);
  });

  it("loads lazily and caches the result", () => {
    const load = vi.fn(() => rtk);
    const registry = createToolRegistry([{ name: "rtk", load }]);

    expect(load).not.toHaveBeenCalled();

    expect(registry.get("rtk")).toBe(registry.get("rtk"));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("rejects a source whose name is not a slug", () => {
    expect(() => createToolRegistry([{ name: "Not A Slug", load: () => rtk }])).toThrow(
      InvalidToolError,
    );
  });

  it("rejects duplicate tool names", () => {
    expect(() =>
      createToolRegistry([
        { name: "rtk", load: () => rtk },
        { name: "rtk", load: () => rtk },
      ]),
    ).toThrow(DuplicateToolError);
  });

  it("rejects a definition that does not match its source name", () => {
    const registry = createToolRegistry([{ name: "rtk", load: () => ({ ...rtk, name: "other" }) }]);

    expect(() => registry.get("rtk")).toThrow(InvalidToolError);
  });

  it("rejects an invalid definition when it is loaded, not when it is registered", () => {
    const registry = createToolRegistry([{ name: "rtk", load: () => ({ ...rtk, command: "" }) }]);

    expect(() => registry.get("rtk")).toThrow(InvalidToolError);
  });

  it("throws for an unknown tool and lists the known ones", () => {
    const registry = createToolRegistry([{ name: "rtk", load: () => rtk }]);

    expect(() => registry.get("nope")).toThrow(UnknownToolError);
    expect(() => registry.get("nope")).toThrow(/Known tools: rtk\./);
  });
});

import { describe, expect, it } from "vitest";
import { UnknownHookError } from "../src/hook/errors.js";
import { createHookRegistry } from "../src/hook/registry.js";
import {
  filterEffectiveHooks,
  resolvePackHookReferences,
  resolvePackHooks,
} from "../src/hook/resolver.js";
import { createPackRegistry } from "../src/pack/registry.js";

describe("resolvePackHooks", () => {
  it("collects hooks in selected pack order", () => {
    const packs = createPackRegistry([
      { name: "base", hooks: ["session-doctor-bootstrap"] },
      { name: "child", hooks: ["session-doctor-bootstrap"] },
    ]);
    const hooks = createHookRegistry([
      { name: "session-doctor-bootstrap", load: () => valid("session-doctor-bootstrap") },
    ]);

    expect(resolvePackHooks(["base", "child"], packs, hooks)).toEqual(["session-doctor-bootstrap"]);
    expect(resolvePackHookReferences(["base", "child"], packs, hooks)).toEqual([
      { name: "session-doctor-bootstrap", activation: "default" },
    ]);
  });

  it("fails clearly on unknown hook references", () => {
    const packs = createPackRegistry([{ name: "base", hooks: ["missing"] }]);
    const hooks = createHookRegistry([]);

    expect(() => resolvePackHooks(["base"], packs, hooks)).toThrow(UnknownHookError);
  });

  it("filters effective hooks by enabled optional capabilities", () => {
    const declared = [
      { name: "default-hook", activation: "default" as const },
      { name: "optional-hook", activation: "optional" as const },
    ];

    expect(filterEffectiveHooks(declared, [])).toEqual(["default-hook"]);
    expect(filterEffectiveHooks(declared, ["optional-hook"])).toEqual([
      "default-hook",
      "optional-hook",
    ]);
  });
});

function valid(name: string) {
  return {
    name,
    description: "Test.",
    event: "SessionStart" as const,
    command: "agentyx",
  };
}

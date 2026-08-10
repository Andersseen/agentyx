import { createToolRegistry, type ToolSource } from "./registry.js";

export const builtInToolSources: readonly ToolSource[] = [
  {
    name: "rtk",
    load: () => ({
      name: "rtk",
      description:
        "Rust Token Killer command-output proxy for reducing coding-agent context noise.",
      kind: "executable",
      command: "rtk",
      optional: true,
      installHint: "Install from the rtk-ai/rtk project if your local workflow benefits from it.",
    }),
  },
];

export const builtInToolRegistry = createToolRegistry(builtInToolSources);

export const builtInToolNames: readonly string[] = builtInToolRegistry.names;

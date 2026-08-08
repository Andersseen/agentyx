import type { AgentAdapter } from "./adapter.js";
import { type AdapterRegistry, createAdapterRegistry } from "./registry.js";
import {
  createSkillDirectoryAdapter,
  type SkillDirectoryAdapterDefinition,
} from "./skill-directory.js";

/**
 * The providers Agnox can install into, expressed as data.
 *
 * Both are project-local on purpose: Agnox never writes into `$HOME`, so an
 * installation is reviewable in the project's own diff and disappears with the
 * checkout.
 *
 * The destinations are the providers' documented conventions, not invented
 * ones:
 *
 * - **Codex** reads repository skills from `.agents/skills`, the vendor-neutral
 *   location shared with other agents, which is also why the Codex adapter does
 *   not use a `.codex` directory.
 * - **Claude Code** reads project skills from `.claude/skills`.
 *
 * Neither definition carries skill content: they are three fields and a
 * directory, and the instructions come from the Agnox skill registry.
 */
export const builtInAdapterDefinitions: readonly SkillDirectoryAdapterDefinition[] = [
  {
    id: "codex",
    name: "Codex",
    skillsDir: [".agents", "skills"],
    reference: "https://developers.openai.com/codex/skills",
  },
  {
    id: "claude",
    name: "Claude Code",
    skillsDir: [".claude", "skills"],
    reference: "https://code.claude.com/docs/en/skills",
  },
];

/** The adapters Agnox ships with, in listing order. */
export const builtInAdapters: readonly AgentAdapter[] = builtInAdapterDefinitions.map(
  createSkillDirectoryAdapter,
);

/** The registry used when no explicit registry is supplied. */
export const builtInAdapterRegistry: AdapterRegistry = createAdapterRegistry(builtInAdapters);

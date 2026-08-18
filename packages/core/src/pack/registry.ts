import { DuplicatePackError } from "./errors.js";
import { type PackDefinition, type PackDefinitionInput, packDefinitionSchema } from "./schema.js";

/**
 * A registry is a name lookup over pack definitions. Keeping it a plain map
 * means the resolver stays independent of where definitions come from, so
 * external registries can be added later without touching resolution.
 */
export type PackRegistry = ReadonlyMap<string, PackDefinition>;

/** Validates definitions and indexes them by name. */
export function createPackRegistry(definitions: Iterable<PackDefinitionInput>): PackRegistry {
  const registry = new Map<string, PackDefinition>();

  for (const definition of definitions) {
    const pack = packDefinitionSchema.parse(definition);

    if (registry.has(pack.name)) {
      throw new DuplicatePackError(pack.name);
    }

    registry.set(pack.name, pack);
  }

  return registry;
}

/**
 * The packs Agentyx ships with, expressed as data. Relationships live here, not
 * in the resolver.
 */
export const builtInPacks: readonly PackDefinitionInput[] = [
  {
    name: "technical",
    category: "engineering",
    description: "General software-engineering quality independent of language or framework.",
    skills: ["engineering-principles", "code-quality", "api-design", "code-review"],
  },
  {
    name: "typescript",
    category: "language",
    description: "TypeScript language conventions for strict, modern code.",
    skills: ["typescript-strict", "typescript-modeling", "typescript-modern"],
  },
  {
    name: "angular",
    category: "framework",
    description: "Modern Angular development environment.",
    skills: ["angular-modern", "angular-signals", "angular-architecture", "angular-testing"],
    mcpServers: ["context7"],
  },
  {
    name: "efficiency",
    category: "efficiency",
    description: "Reduce context and tool overhead without weakening verification.",
    skills: [
      "context-efficient-development",
      "concise-output",
      "targeted-exploration",
      "focused-verification",
    ],
    mcpServers: [{ name: "codebase-memory", activation: "optional" }],
    tools: [{ name: "rtk", activation: "optional" }],
  },
  {
    name: "agentic",
    category: "workflow",
    description: "Provider-neutral development workflows for substantial coding-agent work.",
    skills: [
      "brainstorming",
      "planning",
      "systematic-debugging",
      "verification",
      "parallel-work",
      "worktree-workflow",
      "subagent-driven-development",
      "requesting-code-review",
    ],
  },
  {
    name: "testing",
    category: "engineering",
    description: "Test design, isolation and stability at every level of the pyramid.",
    skills: ["test-strategy", "test-doubles", "e2e-testing", "flaky-tests"],
    mcpServers: [{ name: "playwright", activation: "optional" }],
  },
  {
    name: "security",
    category: "engineering",
    description: "Application security fundamentals for untrusted input, secrets and access.",
    skills: ["secure-coding", "secrets-handling", "dependency-security", "auth-patterns"],
  },
  {
    name: "performance",
    category: "engineering",
    description: "Measure before optimizing, across application, browser and database.",
    skills: ["performance-profiling", "web-vitals", "query-performance"],
    mcpServers: [{ name: "chrome-devtools", activation: "optional" }],
  },
  {
    name: "accessibility",
    category: "engineering",
    description: "Accessible markup, ARIA and keyboard interaction for web interfaces.",
    skills: ["semantic-html", "aria-patterns", "keyboard-navigation"],
    mcpServers: [{ name: "chrome-devtools", activation: "optional" }],
  },
  {
    name: "refactoring",
    category: "engineering",
    description: "Change structure safely, including in legacy code with weak tests.",
    skills: ["refactoring-safely", "legacy-code", "dependency-hygiene"],
  },
  {
    name: "documentation",
    category: "engineering",
    description: "Documentation, interface reference and decision records that stay useful.",
    skills: ["technical-writing", "api-documentation", "decision-records"],
  },
  {
    name: "observability",
    category: "engineering",
    description: "Logging, metrics, tracing and incident response for running systems.",
    skills: ["structured-logging", "metrics-and-tracing", "incident-response"],
    mcpServers: [{ name: "sentry", activation: "optional" }],
  },
  {
    name: "data",
    category: "engineering",
    description: "Schema design, migrations and transactional correctness.",
    skills: ["data-modeling", "schema-migrations", "transactions-and-consistency"],
    mcpServers: [{ name: "supabase", activation: "optional" }],
  },
  {
    name: "git",
    category: "workflow",
    description: "Commit, branch and pull-request practice for reviewable history.",
    skills: ["commit-hygiene", "branching-strategy", "pull-requests"],
    mcpServers: [{ name: "github", activation: "optional" }],
  },
  {
    name: "devops",
    category: "workflow",
    description: "Continuous integration, containers, deployment safety and infrastructure.",
    skills: ["ci-pipelines", "containerization", "deployment-safety", "infrastructure-as-code"],
  },
];

/** The registry used by default when no explicit registry is supplied. */
export const builtInPackRegistry: PackRegistry = createPackRegistry(builtInPacks);

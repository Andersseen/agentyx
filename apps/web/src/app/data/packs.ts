export interface Pack {
  name: string;
  category: "engineering" | "language" | "framework" | "workflow" | "efficiency" | "design";
  purpose: string;
  includes: string;
}

export const PACK_CATEGORIES = [
  "all",
  "engineering",
  "language",
  "framework",
  "workflow",
  "efficiency",
  "design",
] as const;

export type PackCategory = (typeof PACK_CATEGORIES)[number];

export const PACKS: readonly [Pack, ...Pack[]] = [
  {
    name: "technical",
    category: "engineering",
    purpose: "General engineering quality, API design and code review.",
    includes: "Engineering principles, code quality, API design and code review Skills.",
  },
  {
    name: "typescript",
    category: "language",
    purpose: "Strict, modeled and modern TypeScript.",
    includes: "Strict TypeScript, modeling and modern language Skills.",
  },
  {
    name: "rust",
    category: "language",
    purpose: "Idiomatic Rust, safe filesystem work and Cargo checks.",
    includes: "Idiomatic Rust, filesystem safety, portable tests and Cargo verification Skills.",
  },
  {
    name: "angular",
    category: "framework",
    purpose: "Modern Angular architecture, signals and tests.",
    includes: "Angular architecture, signals and testing Skills; Context7 MCP definition.",
  },
  {
    name: "efficiency",
    category: "efficiency",
    purpose: "Less context and tool overhead without weaker verification.",
    includes:
      "Focused exploration and verification Skills, observer hooks, plus optional RTK and codebase-memory.",
  },
  {
    name: "agentic",
    category: "workflow",
    purpose: "Planning, debugging, review and substantial agent work.",
    includes:
      "Planning, debugging, verification and collaboration Skills; optional project agents.",
  },
  {
    name: "testing",
    category: "engineering",
    purpose: "Choose test levels and keep end-to-end suites stable.",
    includes: "Test strategy, doubles, E2E and flaky-test Skills; optional Playwright MCP.",
  },
  {
    name: "ui-ux",
    category: "design",
    purpose: "Make product interfaces clearer, more coherent and easier to verify.",
    includes:
      "Visual design, usability, interaction, design-system, UX-writing and visual-verification Skills; optional Playwright MCP.",
  },
  {
    name: "security",
    category: "engineering",
    purpose: "Handle untrusted input, secrets and access safely.",
    includes: "Secure coding, secrets, dependency security and authorization Skills.",
  },
  {
    name: "performance",
    category: "engineering",
    purpose: "Profile before optimizing browsers, apps and queries.",
    includes: "Profiling, web vitals and query performance Skills; optional Chrome DevTools MCP.",
  },
  {
    name: "accessibility",
    category: "engineering",
    purpose: "Build usable markup and keyboard interactions.",
    includes: "Semantic HTML, ARIA and keyboard navigation Skills; optional Chrome DevTools MCP.",
  },
  {
    name: "refactoring",
    category: "engineering",
    purpose: "Restructure code safely, including legacy systems.",
    includes: "Safe refactoring, legacy-code and dependency hygiene Skills.",
  },
  {
    name: "documentation",
    category: "engineering",
    purpose: "Write useful technical docs and decisions.",
    includes: "Technical writing, API documentation and decision-record Skills.",
  },
  {
    name: "observability",
    category: "engineering",
    purpose: "Design logging, metrics, tracing and incident response.",
    includes: "Logging, metrics, tracing and incident response Skills; optional Sentry MCP.",
  },
  {
    name: "data",
    category: "engineering",
    purpose: "Model schemas, migrations and transactions.",
    includes: "Data modeling, schema migrations and consistency Skills; optional Supabase MCP.",
  },
  {
    name: "git",
    category: "workflow",
    purpose: "Keep commits, branches and pull requests reviewable.",
    includes: "Commit hygiene, branching and pull-request Skills; optional GitHub MCP.",
  },
  {
    name: "devops",
    category: "workflow",
    purpose: "Make CI, containers and deployment safer.",
    includes: "CI, containerization, deployment safety and infrastructure Skills.",
  },
];

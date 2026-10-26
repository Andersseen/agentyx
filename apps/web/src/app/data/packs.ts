export interface Pack {
  name: string;
  category: "engineering" | "language" | "framework" | "workflow" | "efficiency" | "design";
  purpose: string;
  includes: string;
  /** Built-in Skill names, in resolution order. Checked against the core registry by a test. */
  skills: readonly string[];
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
    skills: ["engineering-principles", "code-quality", "api-design", "code-review"],
  },
  {
    name: "typescript",
    category: "language",
    purpose: "Strict, modeled and modern TypeScript.",
    includes: "Strict TypeScript, modeling and modern language Skills.",
    skills: ["typescript-strict", "typescript-modeling", "typescript-modern"],
  },
  {
    name: "rust",
    category: "language",
    purpose: "Idiomatic Rust, safe filesystem work and Cargo checks.",
    includes: "Idiomatic Rust, filesystem safety, portable tests and Cargo verification Skills.",
    skills: [
      "rust-idiomatic-development",
      "rust-filesystem-safety",
      "rust-testing-portability",
      "cargo-project-verification",
    ],
  },
  {
    name: "angular",
    category: "framework",
    purpose: "Modern Angular architecture, signals and tests.",
    includes: "Angular architecture, signals and testing Skills; Context7 MCP definition.",
    skills: ["angular-modern", "angular-signals", "angular-architecture", "angular-testing"],
  },
  {
    name: "efficiency",
    category: "efficiency",
    purpose: "Less context and tool overhead without weaker verification.",
    includes:
      "Focused exploration and verification Skills, observer hooks, plus optional RTK and codebase-memory.",
    skills: [
      "context-efficient-development",
      "concise-output",
      "targeted-exploration",
      "focused-verification",
    ],
  },
  {
    name: "agentic",
    category: "workflow",
    purpose: "Planning, debugging, review and substantial agent work.",
    includes:
      "Planning, debugging, verification and collaboration Skills; optional project agents.",
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
    purpose: "Choose test levels and keep end-to-end suites stable.",
    includes: "Test strategy, doubles, E2E and flaky-test Skills; optional Playwright MCP.",
    skills: ["test-strategy", "test-doubles", "e2e-testing", "flaky-tests"],
  },
  {
    name: "ui-ux",
    category: "design",
    purpose: "Make product interfaces clearer, more coherent and easier to verify.",
    includes:
      "Visual design, usability, interaction, design-system, UX-writing and visual-verification Skills; optional Playwright MCP.",
    skills: [
      "ui-visual-design",
      "ux-usability",
      "interaction-design",
      "design-system-practice",
      "ux-writing",
      "visual-verification",
    ],
  },
  {
    name: "security",
    category: "engineering",
    purpose: "Handle untrusted input, secrets and access safely.",
    includes: "Secure coding, secrets, dependency security and authorization Skills.",
    skills: ["secure-coding", "secrets-handling", "dependency-security", "auth-patterns"],
  },
  {
    name: "performance",
    category: "engineering",
    purpose: "Profile before optimizing browsers, apps and queries.",
    includes: "Profiling, web vitals and query performance Skills; optional Chrome DevTools MCP.",
    skills: ["performance-profiling", "web-vitals", "query-performance"],
  },
  {
    name: "accessibility",
    category: "engineering",
    purpose: "Build usable markup and keyboard interactions.",
    includes: "Semantic HTML, ARIA and keyboard navigation Skills; optional Chrome DevTools MCP.",
    skills: ["semantic-html", "aria-patterns", "keyboard-navigation"],
  },
  {
    name: "refactoring",
    category: "engineering",
    purpose: "Restructure code safely, including legacy systems.",
    includes: "Safe refactoring, legacy-code and dependency hygiene Skills.",
    skills: ["refactoring-safely", "legacy-code", "dependency-hygiene"],
  },
  {
    name: "documentation",
    category: "engineering",
    purpose: "Write useful technical docs and decisions.",
    includes: "Technical writing, API documentation and decision-record Skills.",
    skills: ["technical-writing", "api-documentation", "decision-records"],
  },
  {
    name: "observability",
    category: "engineering",
    purpose: "Design logging, metrics, tracing and incident response.",
    includes: "Logging, metrics, tracing and incident response Skills; optional Sentry MCP.",
    skills: ["structured-logging", "metrics-and-tracing", "incident-response"],
  },
  {
    name: "data",
    category: "engineering",
    purpose: "Model schemas, migrations and transactions.",
    includes: "Data modeling, schema migrations and consistency Skills; optional Supabase MCP.",
    skills: ["data-modeling", "schema-migrations", "transactions-and-consistency"],
  },
  {
    name: "git",
    category: "workflow",
    purpose: "Keep commits, branches and pull requests reviewable.",
    includes: "Commit hygiene, branching and pull-request Skills; optional GitHub MCP.",
    skills: ["commit-hygiene", "branching-strategy", "pull-requests"],
  },
  {
    name: "devops",
    category: "workflow",
    purpose: "Make CI, containers and deployment safer.",
    includes: "CI, containerization, deployment safety and infrastructure Skills.",
    skills: ["ci-pipelines", "containerization", "deployment-safety", "infrastructure-as-code"],
  },
  {
    name: "creative-web",
    category: "design",
    purpose: "Give expressive websites a creative concept, composition, type and motion.",
    includes:
      "Creative direction, composition, typography, visual-storytelling, motion, critique and reference-research Skills, plus shared design-system and visual-verification Skills; optional Playwright MCP.",
    skills: [
      "creative-direction",
      "web-composition",
      "typographic-art-direction",
      "visual-storytelling",
      "motion-art-direction",
      "design-critique",
      "design-reference-research",
      "design-system-practice",
      "visual-verification",
    ],
  },
];

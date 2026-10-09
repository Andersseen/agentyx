import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const packages = ["packages/core", "packages/adapters", "packages/cli"];
const packageCacheDir = await mkdtemp(join(tmpdir(), "agentyx-package-cache-"));

await run("pnpm", ["build"], repoRoot);

const packDir = await mkdtemp(join(tmpdir(), "agentyx-pack-"));
const tarballs = [];

for (const packageDir of packages) {
  await run("pnpm", ["pack", "--pack-destination", packDir], join(repoRoot, packageDir));
}

for (const file of await readdir(packDir)) {
  if (file.endsWith(".tgz")) {
    tarballs.push(join(packDir, file));
  }
}

if (tarballs.length !== packages.length) {
  throw new Error(`Expected ${packages.length} tarballs, found ${tarballs.length}.`);
}

const coreTarball = findTarball(tarballs, "agentyx-core-");
const adaptersTarball = findTarball(tarballs, "agentyx-adapters-");
const cliTarball = findTarball(tarballs, "agentyx-cli-");
const projectDir = await mkdtemp(join(tmpdir(), "agentyx-external-"));
await writeFile(
  join(projectDir, "package.json"),
  `${JSON.stringify(
    {
      name: "agentyx-pack-smoke",
      private: true,
      dependencies: {
        "@agentyx/cli": `file:${cliTarball}`,
      },
      pnpm: {
        overrides: {
          "@agentyx/core": `file:${coreTarball}`,
          "@agentyx/adapters": `file:${adaptersTarball}`,
        },
      },
    },
    null,
    2,
  )}\n`,
);
await writeFile(join(projectDir, "tsconfig.json"), '{"compilerOptions":{"strict":true}}\n');

await run("pnpm", ["install", "--ignore-scripts", "--store-dir", packageCacheDir], projectDir);

const agentyx = process.platform === "win32" ? "agentyx.cmd" : "agentyx";

await run(join(projectDir, "node_modules", ".bin", agentyx), ["--version"], projectDir);
await run(join(projectDir, "node_modules", ".bin", agentyx), ["--help"], projectDir);
await run(
  join(projectDir, "node_modules", ".bin", agentyx),
  [
    "init",
    "--pack",
    "technical",
    "--pack",
    "typescript",
    "--pack",
    "efficiency",
    "--target",
    "codex",
    "--target",
    "claude",
    "--target",
    "kimi",
    "--yes",
  ],
  projectDir,
);
const configPath = join(projectDir, ".agentyx.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
config.project = { id: "smoke-web", name: "Smoke Web", owns: ["frontend"] };
config.relations = [
  {
    id: "smoke-api",
    name: "Smoke API",
    type: "consumes",
    role: "backend-api",
    owns: ["backend-api"],
  },
];
config.context = { constraints: ["Commands and graph metadata are descriptive."] };
config.skillDirectories = ["local-skills"];
config.localPacks = [
  {
    name: "local-smoke",
    skills: ["local-smoke-skill"],
    mcpServers: [{ name: "playwright", activation: "optional" }],
  },
];
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
await mkdir(join(projectDir, "local-skills", "local-smoke-skill"), { recursive: true });
await writeFile(
  join(projectDir, "local-skills", "local-smoke-skill", "SKILL.md"),
  "---\nname: local-smoke-skill\ndescription: Local pack smoke fixture.\n---\n\nUse the local fixture.\n",
);
await writeFile(
  join(projectDir, ".mcp.json"),
  JSON.stringify({ custom: true, mcpServers: { handWritten: { command: "local-tool" } } }),
);
await run("git", ["init", "--quiet"], projectDir);
await run(join(projectDir, "node_modules", ".bin", agentyx), ["resolve"], projectDir);
assertIncludes(
  await run(join(projectDir, "node_modules", ".bin", agentyx), ["graph"], projectDir),
  "consumes [backend-api]",
);
assertIncludes(
  await run(join(projectDir, "node_modules", ".bin", agentyx), ["graph", "--json"], projectDir),
  '"id": "smoke-api"',
);
assertIncludes(
  await run(
    join(projectDir, "node_modules", ".bin", agentyx),
    ["graph", "--format", "mermaid"],
    projectDir,
  ),
  "graph LR",
);
await run(
  join(projectDir, "node_modules", ".bin", agentyx),
  ["graph", "--format", "svg", "--output", "project-graph.svg"],
  projectDir,
);
assertIncludes(
  await run(
    join(projectDir, "node_modules", ".bin", agentyx),
    ["graph", "show", "smoke-api"],
    projectDir,
  ),
  "Smoke API",
);
assertIncludes(
  await run(
    join(projectDir, "node_modules", ".bin", agentyx),
    ["graph", "owner", "backend-api"],
    projectDir,
  ),
  "Smoke API",
);
const cli = join(projectDir, "node_modules", ".bin", agentyx);
await run(
  cli,
  ["configure", "--add-pack", "agentic", "--enable", "agentyx-reviewer", "--yes"],
  projectDir,
);
for (const [path, body] of [
  [".claude/agents/unrelated.md", "user Claude agent\n"],
  [".agents/agents/unrelated.md", "user Kimi agent\n"],
  [".codex/agents/unrelated.toml", 'name = "user_agent"\n'],
]) {
  await mkdir(dirname(join(projectDir, path)), { recursive: true });
  await writeFile(join(projectDir, path), body);
}
await mkdir(join(projectDir, ".claude", "agents"), { recursive: true });
await writeFile(join(projectDir, ".claude/agents/agentyx-reviewer.md"), "unmanaged conflict\n");
const agentConflict = JSON.parse(
  (await run(cli, ["sync", "--dry-run", "--json"], projectDir)).stdout,
);
if (!agentConflict.conflicts.includes(".claude/agents/agentyx-reviewer.md"))
  throw new Error("An unmanaged same-name project agent was not reported as a conflict.");
await rm(join(projectDir, ".claude/agents/agentyx-reviewer.md"));
await run(cli, ["sync", "--dry-run"], projectDir);
await run(cli, ["sync"], projectDir);
for (const path of [
  ".claude/agents/agentyx-reviewer.md",
  ".agents/agents/agentyx-reviewer.md",
  ".codex/agents/agentyx-reviewer.toml",
])
  await readFile(join(projectDir, path), "utf8");
const agentSecondSync = JSON.parse((await run(cli, ["sync", "--json"], projectDir)).stdout);
if (agentSecondSync.summary.create !== 0 || agentSecondSync.summary.update !== 0)
  throw new Error("A second sync with the reviewer enabled was not a no-op.");
const agentDoctor = JSON.parse((await run(cli, ["doctor", "--json"], projectDir)).stdout);
const installedReviewer = agentDoctor.resolution.agents.find(
  (agent) => agent.name === "agentyx-reviewer",
);
if (
  !installedReviewer?.active ||
  installedReviewer.targets.some((target) => target.state !== "installed")
)
  throw new Error("Doctor did not report the enabled reviewer as installed for every target.");
await run(cli, ["configure", "--disable", "agentyx-reviewer", "--yes", "--sync"], projectDir);
for (const path of [
  ".claude/agents/agentyx-reviewer.md",
  ".agents/agents/agentyx-reviewer.md",
  ".codex/agents/agentyx-reviewer.toml",
])
  if ((await readdir(dirname(join(projectDir, path)))).includes(path.split("/").at(-1)))
    throw new Error(`Managed agent was not pruned: ${path}`);
for (const path of [
  ".claude/agents/unrelated.md",
  ".agents/agents/unrelated.md",
  ".codex/agents/unrelated.toml",
])
  await readFile(join(projectDir, path), "utf8");
assertIncludes(await run(cli, ["configure", "--dry-run"], projectDir), "No configuration changes.");
assertIncludes(
  await run(
    cli,
    ["configure", "--add-pack", "local-smoke", "--enable", "playwright", "--dry-run", "--yes"],
    projectDir,
  ),
  "+ local-smoke",
);
await run(
  cli,
  ["configure", "--add-pack", "local-smoke", "--enable", "playwright", "--yes"],
  projectDir,
);
assertIncludes(await run(cli, ["doctor"], projectDir), "not yet installed");
await run(cli, ["sync", "--dry-run"], projectDir);
await run(cli, ["sync"], projectDir);
if (!(await readdir(join(projectDir, ".agents", "skills"))).includes("local-smoke-skill"))
  throw new Error("The local pack Skill did not install through the packaged CLI.");
const secondSync = JSON.parse((await run(cli, ["sync", "--json"], projectDir)).stdout);
if (
  secondSync.summary.create !== 0 ||
  secondSync.summary.update !== 0 ||
  secondSync.summary.delete !== 0
)
  throw new Error("A second packaged sync was not a no-op.");
const converged = JSON.parse((await run(cli, ["doctor", "--json"], projectDir)).stdout);
if (converged.diagnostics.some((diagnostic) => diagnostic.code === "installation_pending"))
  throw new Error("Doctor reported pending provider state after sync.");

await run(cli, ["hook", "observe", "--provider", "claude"], projectDir, {
  input: JSON.stringify({
    session_id: "before-change",
    hook_event_name: "SessionStart",
    source: "startup",
  }),
});
await run(cli, ["hook", "observe", "--provider", "claude"], projectDir, {
  input: JSON.stringify({
    session_id: "before-change",
    hook_event_name: "PostToolUse",
    tool_name: "mcp__playwright__browser_click",
    tool_input: {},
    tool_response: {},
  }),
});
await run(cli, ["configure", "--disable", "playwright", "--yes", "--sync"], projectDir);
const newBaseline = JSON.parse((await run(cli, ["doctor", "--json"], projectDir)).stdout);
if (newBaseline.utilization.observation.ignoredHistoricalSessions !== 1)
  throw new Error("The old session was not isolated from the post-sync harness baseline.");

await run(cli, ["configure", "--enable", "playwright", "--yes"], projectDir);
assertIncludes(
  await run(cli, ["configure", "--remove-pack", "local-smoke", "--dry-run", "--yes"], projectDir),
  "playwright disabled because no selected pack declares it",
);
await run(cli, ["configure", "--remove-pack", "local-smoke", "--yes"], projectDir);
await run(cli, ["sync", "--dry-run"], projectDir);
await run(cli, ["sync"], projectDir);

const claudeMcp = JSON.parse(await readFile(join(projectDir, ".mcp.json"), "utf8"));
if (!claudeMcp.mcpServers.handWritten || claudeMcp.mcpServers.playwright)
  throw new Error("Sync did not preserve user MCP config while pruning its own entry.");
if ((await readdir(join(projectDir, ".agents", "skills"))).includes("local-smoke-skill"))
  throw new Error("Sync did not prune the removed local pack Skill.");
for (const path of [".codex/hooks.json", ".claude/settings.json"]) {
  await readFile(join(projectDir, path), "utf8");
}
if ((await readdir(projectDir)).includes(".kimi-code"))
  throw new Error("Kimi unexpectedly received project-local hooks.");
const gitStatus = await run("git", ["status", "--short"], projectDir);
if (gitStatus.stdout.includes("usage-v2.jsonl"))
  throw new Error("Observation data appeared in git status.");
const claudeContext = await readFile(
  join(projectDir, ".claude/skills/agentyx-project-context/SKILL.md"),
  "utf8",
);
const sharedContext = await readFile(
  join(projectDir, ".agents/skills/agentyx-project-context/SKILL.md"),
  "utf8",
);
if (claudeContext !== sharedContext)
  throw new Error("Provider project context Skills are not byte-identical.");
if (!claudeContext.includes("backend-api"))
  throw new Error("Packaged project context omitted graph ownership.");

const projectRequire = createRequire(join(projectDir, "package.json"));
const cliPackagePath = await findPackageJson(projectRequire.resolve("@agentyx/cli"));
const cliPackageRoot = dirname(cliPackagePath);
const cliRequire = createRequire(cliPackagePath);
const adaptersPackagePath = await findPackageJson(cliRequire.resolve("@agentyx/adapters"));
const adaptersPackageRoot = dirname(adaptersPackagePath);
const adaptersRequire = createRequire(adaptersPackagePath);
const corePackagePath = await findPackageJson(adaptersRequire.resolve("@agentyx/core"));
const corePackageRoot = dirname(corePackagePath);
const cliPackage = JSON.parse(await readFile(cliPackagePath, "utf8"));
const adaptersPackage = JSON.parse(await readFile(adaptersPackagePath, "utf8"));

assertPublishedDependency(cliPackage, "@agentyx/core");
assertPublishedDependency(cliPackage, "@agentyx/adapters");
assertPublishedDependency(adaptersPackage, "@agentyx/core");
await readFile(join(corePackageRoot, "skills", "planning", "SKILL.md"), "utf8");
await readFile(join(corePackageRoot, "agents", "agentyx-reviewer.json"), "utf8");
await readFile(join(corePackageRoot, "templates", "project-context.md"), "utf8");
await readFile(join(corePackageRoot, "schema", "agentyx.schema.json"), "utf8");
await readFile(join(cliPackageRoot, "dist", "index.mjs"), "utf8");
await readFile(join(adaptersPackageRoot, "dist", "index.mjs"), "utf8");

console.log("Pack smoke passed: packaged configure/sync lifecycle across Codex, Claude and Kimi.");
await rm(projectDir, { recursive: true, force: true });
await rm(packDir, { recursive: true, force: true });
await rm(packageCacheDir, { recursive: true, force: true });

async function run(command, args, cwd, options = {}) {
  try {
    const result = execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_fund: "false",
        npm_config_audit: "false",
        npm_config_cache: packageCacheDir,
        PNPM_HOME: packageCacheDir,
      },
      ...options,
      maxBuffer: 1024 * 1024 * 10,
    });

    return { stdout: result, stderr: "" };
  } catch (cause) {
    const stdout = cause.stdout ? `\nstdout:\n${cause.stdout}` : "";
    const stderr = cause.stderr ? `\nstderr:\n${cause.stderr}` : "";

    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}.${stdout}${stderr}`, {
      cause,
    });
  }
}

function assertPublishedDependency(packageJson, dependency) {
  const version = packageJson.dependencies?.[dependency];

  if (typeof version !== "string" || version.startsWith("workspace:")) {
    throw new Error(`${packageJson.name} has unpublished dependency ${dependency}: ${version}`);
  }
}

function assertIncludes(result, expected) {
  if (!result.stdout.includes(expected)) {
    throw new Error(
      `Expected command output to include ${JSON.stringify(expected)}; got:\n${result.stdout}`,
    );
  }
}

function findTarball(files, pattern) {
  const found = files.find((file) => file.includes(pattern));

  if (found === undefined) {
    throw new Error(`Missing packed artifact matching ${pattern}.`);
  }

  return found;
}

async function findPackageJson(start) {
  let directory = dirname(start);

  while (directory !== dirname(directory)) {
    const packageJson = join(directory, "package.json");

    try {
      await readFile(packageJson, "utf8");
      return packageJson;
    } catch (cause) {
      if (!(cause instanceof Error) || cause.code !== "ENOENT") {
        throw cause;
      }
    }

    directory = dirname(directory);
  }

  throw new Error(`Could not locate package.json above ${start}.`);
}

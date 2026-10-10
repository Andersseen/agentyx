import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const packages = ["packages/core", "packages/adapters", "packages/cli"];
const packageCacheDir = await mkdtemp(join(tmpdir(), "agentyx-package-cache-"));
// Every packaged-CLI invocation runs with $HOME pointing here; it must still be empty at the end.
const fakeHome = await mkdtemp(join(tmpdir(), "agentyx-smoke-home-"));
// Stands in for the installed binary. The pnpm-generated shim is a .cmd file on Windows, which
// cannot be spawned without a shell, so the package's own bin entry is run with this Node instead.
const CLI = Symbol("agentyx-cli");
let cliEntry;

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
        "@agentyx/cli": fileSpec(cliTarball),
      },
      pnpm: {
        overrides: {
          "@agentyx/core": fileSpec(coreTarball),
          "@agentyx/adapters": fileSpec(adaptersTarball),
        },
      },
    },
    null,
    2,
  )}\n`,
);
await writeFile(join(projectDir, "tsconfig.json"), '{"compilerOptions":{"strict":true}}\n');

await run("pnpm", ["install", "--ignore-scripts", "--store-dir", packageCacheDir], projectDir);

cliEntry = join(projectDir, "node_modules", "@agentyx", "cli", "dist", "index.mjs");
const installedCliPackage = JSON.parse(
  await readFile(join(projectDir, "node_modules", "@agentyx", "cli", "package.json"), "utf8"),
);
if (installedCliPackage.bin?.agentyx !== "./dist/index.mjs")
  throw new Error("The packaged CLI does not declare the agentyx bin entry.");
if (!(await readFile(cliEntry, "utf8")).startsWith("#!"))
  throw new Error("The packaged CLI entry has no shebang, so the bin shim cannot execute it.");

await run(CLI, ["--version"], projectDir);
await run(CLI, ["--help"], projectDir);
await run(
  CLI,
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
await run(CLI, ["resolve"], projectDir);
assertIncludes(await run(CLI, ["graph"], projectDir), "consumes [backend-api]");
assertIncludes(await run(CLI, ["graph", "--json"], projectDir), '"id": "smoke-api"');
assertIncludes(await run(CLI, ["graph", "--format", "mermaid"], projectDir), "graph LR");
await run(CLI, ["graph", "--format", "svg", "--output", "project-graph.svg"], projectDir);
assertIncludes(await run(CLI, ["graph", "show", "smoke-api"], projectDir), "Smoke API");
assertIncludes(await run(CLI, ["graph", "owner", "backend-api"], projectDir), "Smoke API");
const cli = CLI;
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

// --- Machine-readable output: parseable JSON with the semantic fields consumers need. ---
const parseJson = async (args, cwd = projectDir) => {
  const result = await run(CLI, args, cwd);
  try {
    return JSON.parse(result.stdout);
  } catch (cause) {
    throw new Error(`agentyx ${args.join(" ")} did not print only JSON.`, { cause });
  }
};
const recommended = await parseJson(["recommend", "--json"]);
assertArrays(recommended, ["packs"], "recommend --json");
const resolvedJson = await parseJson(["resolve", "--json"]);
assertArrays(
  resolvedJson,
  ["skills", "mcpServers", "hooks", "agents", "targets"],
  "resolve --json",
);
for (const target of ["codex", "claude", "kimi"])
  if (!resolvedJson.targets.includes(target))
    throw new Error(`resolve --json omitted target ${target}.`);
const configureJson = await parseJson(["configure", "--dry-run", "--json"]);
if (configureJson.dryRun !== true || typeof configureJson.changed !== "boolean")
  throw new Error("configure --dry-run --json lacks dryRun/changed.");
const syncJson = await parseJson(["sync", "--dry-run", "--json"]);
assertArrays(syncJson, ["conflicts", "plans"], "sync --dry-run --json");
if (typeof syncJson.summary?.create !== "number" || syncJson.dryRun !== true)
  throw new Error("sync --dry-run --json lacks summary counts or dryRun.");
const doctorJson = await parseJson(["doctor", "--json"]);
assertArrays(doctorJson, ["diagnostics"], "doctor --json");
if (typeof doctorJson.status !== "string" || typeof doctorJson.installation !== "object")
  throw new Error("doctor --json lacks status/installation.");

// --- Exit behavior: 0 on success, 1 on every refusal; nothing is written on a refusal. ---
const emptyDir = await mkdtemp(join(tmpdir(), "agentyx-empty-"));
await run("git", ["init", "--quiet"], emptyDir);
for (const args of [
  ["resolve"],
  ["sync"],
  ["doctor", "--check"],
  ["configure", "--enable", "agentyx-reviewer", "--yes"],
  ["init", "--pack", "technical", "--target", "no-such-provider", "--yes"],
])
  assertExit(runStatus(CLI, args, emptyDir), 1, `agentyx ${args.join(" ")} in an empty project`);
if ((await readdir(emptyDir)).filter((name) => name !== ".git").length > 0)
  throw new Error("A refused command left files behind in the empty project.");
const beforeInvalid = await readFile(configPath, "utf8");
assertExit(
  runStatus(CLI, ["configure", "--enable", "no-such-capability", "--yes"], projectDir),
  1,
  "configure with an unknown capability",
);
if ((await readFile(configPath, "utf8")) !== beforeInvalid)
  throw new Error("An invalid configure mutation changed .agentyx.json.");
await writeFile(join(emptyDir, ".agentyx.json"), "{ not json");
assertExit(runStatus(CLI, ["resolve"], emptyDir), 1, "resolve with invalid configuration");
assertExit(runStatus(CLI, ["doctor", "--check"], emptyDir), 1, "doctor --check, invalid config");
await rm(emptyDir, { recursive: true, force: true });

// --- Declarative lifecycle in a clean repository, all three providers. ---
const lifeDir = await mkdtemp(join(tmpdir(), "agentyx-lifecycle-"));
await run("git", ["init", "--quiet"], lifeDir);
await writeFile(join(lifeDir, "package.json"), '{"name":"life","private":true}\n');
// Hooks run `npx --no-install agentyx`; Doctor only checks that a project-local bin exists.
await mkdir(join(lifeDir, "node_modules", ".bin"), { recursive: true });
await writeFile(join(lifeDir, "node_modules", ".bin", "agentyx"), "#!/bin/sh\n");
await run(
  CLI,
  [
    "init",
    "--pack",
    "technical",
    "--pack",
    "agentic",
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
  lifeDir,
);
const userFiles = {
  ".claude/agents/mine.md": "user\n",
  ".agents/agents/mine.md": "user\n",
  ".codex/agents/mine.toml": 'name = "mine"\n',
  ".agents/skills/mine/SKILL.md": "user\n",
};
for (const [path, body] of Object.entries(userFiles)) {
  await mkdir(dirname(join(lifeDir, path)), { recursive: true });
  await writeFile(join(lifeDir, path), body);
}
assertExit(runStatus(CLI, ["doctor", "--check"], lifeDir), 1, "doctor --check before sync");
await run(CLI, ["sync"], lifeDir);
assertExit(runStatus(CLI, ["doctor", "--check"], lifeDir), 0, "doctor --check after sync");
for (const path of [".agents/skills/planning/SKILL.md", ".claude/skills/planning/SKILL.md"])
  await readFile(join(lifeDir, path), "utf8");
if (
  (await readFile(join(lifeDir, ".agents/skills/planning/SKILL.md"), "utf8")) !==
  (await readFile(join(lifeDir, ".claude/skills/planning/SKILL.md"), "utf8"))
)
  throw new Error("The same Skill differs between providers.");
for (const path of [".claude/settings.json", ".codex/hooks.json"])
  await readFile(join(lifeDir, path), "utf8");
const lifeLock = await readFile(join(lifeDir, ".agentyx.lock.json"), "utf8");
const synced = JSON.parse(lifeLock);
const sharedSkill = synced.entries.find(
  (entry) => entry.path === ".agents/skills/planning/SKILL.md",
);
if ([...(sharedSkill?.targets ?? [])].sort().join() !== "codex,kimi")
  throw new Error("The shared .agents Skill is not owned by both Codex and Kimi.");

// A configuration change alone never touches provider files.
const snapshotBefore = await snapshot(lifeDir);
await run(CLI, ["configure", "--enable", "agentyx-reviewer", "--yes"], lifeDir);
const configOnly = await snapshot(lifeDir);
for (const [path, hash] of snapshotBefore)
  if (path !== ".agentyx.json" && configOnly.get(path) !== hash)
    throw new Error(`configure changed provider state before sync: ${path}`);
const dry = await parseJson(["sync", "--dry-run", "--json"], lifeDir);
if (dry.summary.create < 3) throw new Error("sync --dry-run did not plan the three agent files.");
if (!sameSnapshot(configOnly, await snapshot(lifeDir)))
  throw new Error("sync --dry-run wrote files.");
await run(CLI, ["sync"], lifeDir);
for (const path of [
  ".claude/agents/agentyx-reviewer.md",
  ".agents/agents/agentyx-reviewer.md",
  ".codex/agents/agentyx-reviewer.toml",
]) {
  const body = await readFile(join(lifeDir, path), "utf8");
  if (!body.includes("review"))
    throw new Error(`${path} does not carry the canonical reviewer instructions.`);
}
const reviewerDoctor = await parseJson(["doctor", "--json"], lifeDir);
if (reviewerDoctor.diagnostics.some((diagnostic) => diagnostic.code === "installation_pending"))
  throw new Error("Doctor reported pending state after sync.");
const lifeConverged = await snapshot(lifeDir);
await run(CLI, ["sync"], lifeDir);
if (!sameSnapshot(lifeConverged, await snapshot(lifeDir)))
  throw new Error("A second sync changed files.");

// Dropping Kimi prunes Kimi-only output but keeps what Codex still shares.
await run(CLI, ["configure", "--remove-target", "kimi", "--yes", "--sync"], lifeDir);
if (await pathExists(join(lifeDir, ".agents/agents/agentyx-reviewer.md")))
  throw new Error("Kimi's managed agent survived removing the Kimi target.");
await readFile(join(lifeDir, ".agents/skills/planning/SKILL.md"), "utf8");
await run(CLI, ["configure", "--disable", "agentyx-reviewer", "--yes", "--sync"], lifeDir);
for (const path of [".claude/agents/agentyx-reviewer.md", ".codex/agents/agentyx-reviewer.toml"])
  if (await pathExists(join(lifeDir, path))) throw new Error(`Managed agent not pruned: ${path}`);
for (const [path, body] of Object.entries(userFiles))
  if ((await readFile(join(lifeDir, path), "utf8")) !== body)
    throw new Error(`User file was modified by the lifecycle: ${path}`);

await run(CLI, ["uninstall"], lifeDir);
for (const [path, body] of Object.entries(userFiles))
  if ((await readFile(join(lifeDir, path), "utf8")) !== body)
    throw new Error(`User file was modified by uninstall: ${path}`);
if (await pathExists(join(lifeDir, ".agentyx.lock.json")))
  throw new Error("Uninstall left .agentyx.lock.json behind.");
if (await pathExists(join(lifeDir, ".claude/skills/planning")))
  throw new Error("Uninstall left a managed Skill behind.");
await rm(lifeDir, { recursive: true, force: true });

if ((await readdir(fakeHome)).length > 0)
  throw new Error(`The packaged CLI wrote under $HOME: ${(await readdir(fakeHome)).join(", ")}`);

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
await assertAssets(corePackageRoot);
await readFile(join(corePackageRoot, "templates", "project-context.md"), "utf8");
await readFile(join(corePackageRoot, "schema", "agentyx.schema.json"), "utf8");
await readFile(join(cliPackageRoot, "dist", "index.mjs"), "utf8");
await readFile(join(adaptersPackageRoot, "dist", "index.mjs"), "utf8");

await rm(fakeHome, { recursive: true, force: true });
console.log("Pack smoke passed: packaged configure/sync lifecycle across Codex, Claude and Kimi.");
await rm(projectDir, { recursive: true, force: true });
await rm(packDir, { recursive: true, force: true });
await rm(packageCacheDir, { recursive: true, force: true });

function fileSpec(path) {
  return `file:${path.replaceAll("\\", "/")}`;
}

function invocation(command, args) {
  return command === CLI
    ? { file: process.execPath, args: [cliEntry, ...args], label: `agentyx ${args.join(" ")}` }
    : { file: command, args, label: `${command} ${args.join(" ")}` };
}

function invocationEnv(command) {
  return {
    ...process.env,
    npm_config_fund: "false",
    npm_config_audit: "false",
    npm_config_cache: packageCacheDir,
    PNPM_HOME: packageCacheDir,
    ...(command === CLI ? { HOME: fakeHome, USERPROFILE: fakeHome } : {}),
  };
}

/** Runs a command and returns its exit status instead of throwing on a nonzero one. */
function runStatus(command, args, cwd) {
  const { file, args: fileArgs } = invocation(command, args);
  const result = spawnSync(file, fileArgs, {
    cwd,
    encoding: "utf8",
    env: invocationEnv(command),
    maxBuffer: 1024 * 1024 * 10,
  });

  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

async function run(command, args, cwd, options = {}) {
  const { file, args: fileArgs, label } = invocation(command, args);
  try {
    const result = execFileSync(file, fileArgs, {
      cwd,
      encoding: "utf8",
      env: invocationEnv(command),
      // pnpm is a .cmd shim on Windows.
      shell: command === "pnpm" && process.platform === "win32",
      ...options,
      maxBuffer: 1024 * 1024 * 10,
    });

    return { stdout: result, stderr: "" };
  } catch (cause) {
    const stdout = cause.stdout ? `\nstdout:\n${cause.stdout}` : "";
    const stderr = cause.stderr ? `\nstderr:\n${cause.stderr}` : "";

    throw new Error(`${label} failed in ${cwd}.${stdout}${stderr}`, {
      cause,
    });
  }
}

function assertArrays(value, keys, label) {
  for (const key of keys)
    if (!Array.isArray(value?.[key])) throw new Error(`${label}: "${key}" is not an array.`);
}

function assertExit(result, expected, label) {
  if (result.status !== expected)
    throw new Error(
      `${label}: expected exit ${expected}, got ${result.status}.\n${result.stdout}${result.stderr}`,
    );
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Maps every project-relative file (excluding .git) to its content hash. */
async function snapshot(root, prefix = "") {
  const files = new Map();
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (relative === ".git") continue;
    if (entry.isDirectory()) {
      for (const [path, hash] of await snapshot(root, relative)) files.set(path, hash);
    } else {
      files.set(
        relative,
        createHash("sha256")
          .update(await readFile(join(root, relative)))
          .digest("hex"),
      );
    }
  }
  return files;
}

function sameSnapshot(left, right) {
  return left.size === right.size && [...left].every(([path, hash]) => right.get(path) === hash);
}

/** Every built-in Skill and Agent the source tree has must be inside the published core package. */
async function assertAssets(coreRoot) {
  for (const [source, packaged, entry] of [
    ["packages/core/skills", "skills", "SKILL.md"],
    ["packages/core/agents", "agents", undefined],
  ]) {
    const expected = (await readdir(join(repoRoot, source))).sort();
    const found = (await readdir(join(coreRoot, packaged))).sort();
    if (expected.length === 0 || expected.join() !== found.join())
      throw new Error(
        `Packaged ${packaged} differ from source: ${expected.length} vs ${found.length}.`,
      );
    if (entry !== undefined)
      for (const name of found) await readFile(join(coreRoot, packaged, name, entry), "utf8");
  }
  for (const agent of ["agentyx-planner", "agentyx-reviewer", "agentyx-verifier"])
    await readFile(join(coreRoot, "agents", `${agent}.json`), "utf8");
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

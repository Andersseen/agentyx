import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
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

await run("pnpm", ["install", "--ignore-scripts"], projectDir);

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
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
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
await run(join(projectDir, "node_modules", ".bin", agentyx), ["doctor"], projectDir);
await run(join(projectDir, "node_modules", ".bin", agentyx), ["install", "--dry-run"], projectDir);
await run(join(projectDir, "node_modules", ".bin", agentyx), ["install"], projectDir);
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
await readFile(join(corePackageRoot, "templates", "project-context.md"), "utf8");
await readFile(join(corePackageRoot, "schema", "agentyx.schema.json"), "utf8");
await readFile(join(cliPackageRoot, "dist", "index.mjs"), "utf8");
await readFile(join(adaptersPackageRoot, "dist", "index.mjs"), "utf8");

console.log(`Pack smoke passed in ${projectDir}`);

async function run(command, args, cwd) {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      env: {
        ...process.env,
        npm_config_fund: "false",
        npm_config_audit: "false",
        npm_config_cache: packageCacheDir,
        PNPM_HOME: packageCacheDir,
      },
      maxBuffer: 1024 * 1024 * 10,
    });

    return result;
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

import type { Dirent } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { builtInToolRegistry } from "../tool/built-in.js";
import { isExecutableOnPath } from "./executable.js";

export const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;

export type PackageManagerName = (typeof PACKAGE_MANAGERS)[number];

export interface PackageManagerDetection {
  readonly name: PackageManagerName | undefined;
  readonly source: "lockfile" | "package-json" | undefined;
  readonly lockfiles: readonly string[];
  readonly ambiguous: boolean;
}

export interface ProjectPackageJsonDetection {
  readonly present: boolean;
  readonly valid: boolean;
  readonly path: string;
  readonly name: string | undefined;
  readonly packageManager: string | undefined;
  readonly error: string | undefined;
}

export type DependencyField =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

/** A single matched dependency: which package, and which `package.json` field it came from. */
export interface TechnologyMatch {
  readonly dependency: string;
  readonly field: DependencyField;
}

export interface ContainerFileSignals {
  readonly dockerfile: boolean;
  readonly compose: boolean;
}

export interface CiFileSignals {
  readonly githubActions: boolean;
}

export interface MonorepoSignal {
  readonly detected: boolean;
  readonly markers: readonly string[];
}

export interface RepositorySizeSignal {
  readonly filesScanned: number;
  /** True when the bounded traversal stopped before finishing; `filesScanned` is a lower bound. */
  readonly capped: boolean;
}

/**
 * Deliberately small, provider-neutral facts about a repository, gathered from a bounded set of
 * known files and `package.json` dependencies — never a full filesystem listing.
 *
 * This is pure detection: it makes no judgement about which packs or capabilities fit. That
 * judgement lives in `recommendCapabilities` (`./recommend.js`), which consumes these signals.
 */
export interface ProjectSignals {
  readonly projectDir: string;
  readonly packageJson: ProjectPackageJsonDetection;
  readonly packageManager: PackageManagerDetection;
  readonly typescript: {
    readonly dependency: TechnologyMatch | undefined;
    readonly tsconfig: boolean;
  };
  readonly angular: TechnologyMatch | undefined;
  readonly testFrameworks: readonly TechnologyMatch[];
  readonly browserTesting: readonly TechnologyMatch[];
  readonly observability: readonly TechnologyMatch[];
  readonly dataTooling: readonly TechnologyMatch[];
  readonly accessibilityTooling: readonly TechnologyMatch[];
  readonly containers: ContainerFileSignals;
  readonly ci: CiFileSignals;
  readonly monorepo: MonorepoSignal;
  readonly repositorySize: RepositorySizeSignal;
  readonly localTools: { readonly rtkAvailable: boolean };
}

/** Package name patterns matched exactly, or as a `@scope/*` prefix. */
const TEST_FRAMEWORK_PATTERNS = [
  "vitest",
  "jest",
  "@jest/*",
  "@playwright/test",
  "cypress",
  "karma",
];
const BROWSER_TESTING_PATTERNS = ["@playwright/test", "cypress"];
const OBSERVABILITY_PATTERNS = ["@sentry/*", "@opentelemetry/*"];
const DATA_TOOLING_PATTERNS = [
  "@supabase/*",
  "drizzle-orm",
  "prisma",
  "@prisma/client",
  "typeorm",
  "sequelize",
];
const ACCESSIBILITY_PATTERNS = ["axe-core", "@axe-core/*", "pa11y"];

const DEPENDENCY_FIELDS: readonly DependencyField[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const CONTAINER_IGNORED = new Set(["node_modules", ".git", "dist", "build", "coverage"]);

/** Extensions counted as source files by the bounded repository-size scan. */
const SOURCE_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".rb",
  ".php",
  ".css",
  ".scss",
  ".html",
]);

/** Maximum directory entries visited by `scanRepositorySize`, regardless of match. */
export const REPOSITORY_SCAN_ENTRY_LIMIT = 5000;

interface PackageJson {
  readonly name?: unknown;
  readonly packageManager?: unknown;
  readonly workspaces?: unknown;
  readonly dependencies?: unknown;
  readonly devDependencies?: unknown;
  readonly peerDependencies?: unknown;
  readonly optionalDependencies?: unknown;
}

const lockfileManagers: ReadonlyMap<string, PackageManagerName> = new Map([
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
]);

/** Gathers every project signal with a bounded, cheap set of reads. */
export async function collectProjectSignals(projectDir: string): Promise<ProjectSignals> {
  const packageJsonPath = join(projectDir, "package.json");
  const packageJsonResult = await readPackageJson(packageJsonPath);
  const packageJson = packageJsonResult.data;

  const [packageManager, containers, ci, monorepo, repositorySize, tsconfig, rtkAvailable] =
    await Promise.all([
      detectPackageManager(projectDir, packageJson),
      detectContainerFiles(projectDir),
      detectCiFiles(projectDir),
      detectMonorepo(projectDir, packageJson),
      scanRepositorySize(projectDir),
      exists(join(projectDir, "tsconfig.json")),
      isExecutableOnPath(builtInToolRegistry.get("rtk").command),
    ]);

  return {
    projectDir,
    packageJson: {
      present: packageJsonResult.present,
      valid: packageJsonResult.valid,
      path: packageJsonPath,
      name: getString(packageJson?.name),
      packageManager: getString(packageJson?.packageManager),
      error: packageJsonResult.error,
    },
    packageManager,
    typescript: {
      dependency: findDependency(packageJson, "typescript"),
      tsconfig,
    },
    angular: findDependency(packageJson, "@angular/core"),
    testFrameworks: findAnyDependency(packageJson, TEST_FRAMEWORK_PATTERNS),
    browserTesting: findAnyDependency(packageJson, BROWSER_TESTING_PATTERNS),
    observability: findAnyDependency(packageJson, OBSERVABILITY_PATTERNS),
    dataTooling: findAnyDependency(packageJson, DATA_TOOLING_PATTERNS),
    accessibilityTooling: findAnyDependency(packageJson, ACCESSIBILITY_PATTERNS),
    containers,
    ci,
    monorepo,
    repositorySize,
    localTools: { rtkAvailable },
  };
}

/**
 * Counts source-like files under a bounded traversal, ignoring dependency, VCS and build output
 * directories. Stops after visiting `entryLimit` directory entries — cheap even on a monorepo — and
 * reports `capped` so callers never mistake a partial scan for a complete one.
 */
export async function scanRepositorySize(
  projectDir: string,
  options: { readonly entryLimit?: number } = {},
): Promise<RepositorySizeSignal> {
  const entryLimit = options.entryLimit ?? REPOSITORY_SCAN_ENTRY_LIMIT;
  const directories = [projectDir];
  let filesScanned = 0;
  let entriesVisited = 0;
  let capped = false;

  while (directories.length > 0 && !capped) {
    const directory = directories.shift();

    if (directory === undefined) {
      break;
    }

    let entries: Dirent[];

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entriesVisited >= entryLimit) {
        capped = true;
        break;
      }

      entriesVisited += 1;

      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || CONTAINER_IGNORED.has(entry.name)) {
          continue;
        }

        directories.push(join(directory, entry.name));
      } else if (entry.isFile() && SOURCE_FILE_EXTENSIONS.has(extname(entry.name))) {
        filesScanned += 1;
      }
    }
  }

  return { filesScanned, capped };
}

function findDependency(
  packageJson: PackageJson | undefined,
  pattern: string,
): TechnologyMatch | undefined {
  for (const field of DEPENDENCY_FIELDS) {
    const value = packageJson?.[field];

    if (!isRecord(value)) {
      continue;
    }

    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      const name = Object.keys(value).find((key) => key.startsWith(prefix));

      if (name !== undefined) {
        return { dependency: name, field };
      }

      continue;
    }

    if (pattern in value) {
      return { dependency: pattern, field };
    }
  }

  return undefined;
}

function findAnyDependency(
  packageJson: PackageJson | undefined,
  patterns: readonly string[],
): readonly TechnologyMatch[] {
  const matches: TechnologyMatch[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const match = findDependency(packageJson, pattern);

    if (match !== undefined && !seen.has(match.dependency)) {
      seen.add(match.dependency);
      matches.push(match);
    }
  }

  return matches;
}

async function detectContainerFiles(projectDir: string): Promise<ContainerFileSignals> {
  const [dockerfile, dockerCompose, compose] = await Promise.all([
    exists(join(projectDir, "Dockerfile")),
    exists(join(projectDir, "docker-compose.yml")),
    exists(join(projectDir, "compose.yml")),
  ]);

  return { dockerfile, compose: dockerCompose || compose };
}

async function detectCiFiles(projectDir: string): Promise<CiFileSignals> {
  return { githubActions: await exists(join(projectDir, ".github", "workflows")) };
}

async function detectMonorepo(
  projectDir: string,
  packageJson: PackageJson | undefined,
): Promise<MonorepoSignal> {
  const markers: string[] = [];

  if (await exists(join(projectDir, "pnpm-workspace.yaml"))) {
    markers.push("pnpm-workspace.yaml");
  }

  if (await exists(join(projectDir, "turbo.json"))) {
    markers.push("turbo.json");
  }

  if (await exists(join(projectDir, "nx.json"))) {
    markers.push("nx.json");
  }

  const workspaces = packageJson?.workspaces;

  if (Array.isArray(workspaces) || isRecord(workspaces)) {
    markers.push("package.json workspaces");
  }

  return { detected: markers.length > 0, markers };
}

async function detectPackageManager(
  projectDir: string,
  packageJson: PackageJson | undefined,
): Promise<PackageManagerDetection> {
  const lockfiles: string[] = [];
  const managers = new Set<PackageManagerName>();

  for (const [file, manager] of lockfileManagers) {
    if (await exists(join(projectDir, file))) {
      lockfiles.push(file);
      managers.add(manager);
    }
  }

  if (managers.size === 1) {
    return {
      name: [...managers][0],
      source: "lockfile",
      lockfiles,
      ambiguous: false,
    };
  }

  if (managers.size > 1) {
    return {
      name: undefined,
      source: "lockfile",
      lockfiles,
      ambiguous: true,
    };
  }

  const declared = parsePackageManagerName(getString(packageJson?.packageManager));

  return {
    name: declared,
    source: declared === undefined ? undefined : "package-json",
    lockfiles,
    ambiguous: false,
  };
}

async function readPackageJson(path: string): Promise<{
  readonly present: boolean;
  readonly valid: boolean;
  readonly data: PackageJson | undefined;
  readonly error: string | undefined;
}> {
  let contents: string;

  try {
    contents = await readFile(path, "utf8");
  } catch (cause) {
    if (isNotFound(cause)) {
      return { present: false, valid: false, data: undefined, error: undefined };
    }

    const reason = cause instanceof Error ? cause.message : String(cause);
    return { present: true, valid: false, data: undefined, error: reason };
  }

  try {
    return { present: true, valid: true, data: JSON.parse(contents), error: undefined };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return { present: true, valid: false, data: undefined, error: reason };
  }
}

function parsePackageManagerName(value: string | undefined): PackageManagerName | undefined {
  const name = value?.split("@")[0];

  return PACKAGE_MANAGERS.includes(name as PackageManagerName)
    ? (name as PackageManagerName)
    : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (cause) {
    if (isNotFound(cause)) {
      return false;
    }

    throw cause;
  }
}

function isNotFound(cause: unknown): boolean {
  return cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT";
}

import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentyxConfigInput, AgentyxProfile } from "../config/schema.js";

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

export interface ProjectDetection {
  readonly projectDir: string;
  readonly packageJson: ProjectPackageJsonDetection;
  readonly packageManager: PackageManagerDetection;
  readonly detectedStacks: readonly string[];
  readonly recommendedStack: string | undefined;
}

interface PackageJson {
  readonly name?: unknown;
  readonly packageManager?: unknown;
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

export async function detectProject(projectDir: string): Promise<ProjectDetection> {
  const packageJsonPath = join(projectDir, "package.json");
  const packageJson = await readPackageJson(packageJsonPath);
  const packageManager = await detectPackageManager(projectDir, packageJson.data);
  const detectedStacks = await detectStacks(projectDir, packageJson.data);

  return {
    projectDir,
    packageJson: {
      present: packageJson.present,
      valid: packageJson.valid,
      path: packageJsonPath,
      name: getString(packageJson.data?.name),
      packageManager: getString(packageJson.data?.packageManager),
      error: packageJson.error,
    },
    packageManager,
    detectedStacks,
    recommendedStack: recommendStack(detectedStacks),
  };
}

export function buildAgentyxConfig(input: {
  readonly stack: string;
  readonly profile: AgentyxProfile;
  readonly targets: readonly string[];
}): AgentyxConfigInput {
  return {
    extends: [input.stack],
    profile: input.profile,
    targets: [...input.targets],
  };
}

export function formatAgentyxConfig(config: AgentyxConfigInput): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

function recommendStack(detectedStacks: readonly string[]): string | undefined {
  if (detectedStacks.includes("angular")) {
    return "angular";
  }

  if (detectedStacks.includes("typescript")) {
    return "typescript";
  }

  return undefined;
}

async function detectStacks(
  projectDir: string,
  packageJson: PackageJson | undefined,
): Promise<readonly string[]> {
  const stacks: string[] = [];
  const dependencies = collectDependencies(packageJson);
  const hasAngular = dependencies.has("@angular/core");
  const hasTypeScript =
    dependencies.has("typescript") || (await exists(join(projectDir, "tsconfig.json")));

  if (hasTypeScript || hasAngular) {
    stacks.push("typescript");
  }

  if (hasAngular) {
    stacks.push("angular");
  }

  return stacks;
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

function collectDependencies(packageJson: PackageJson | undefined): ReadonlySet<string> {
  const dependencies = new Set<string>();

  for (const field of [
    packageJson?.dependencies,
    packageJson?.devDependencies,
    packageJson?.peerDependencies,
    packageJson?.optionalDependencies,
  ]) {
    if (isRecord(field)) {
      for (const name of Object.keys(field)) {
        dependencies.add(name);
      }
    }
  }

  return dependencies;
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

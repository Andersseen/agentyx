import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { builtInAdapterRegistry } from "@agnox/adapters";
import {
  AGNOX_CONFIG_FILENAME,
  AGNOX_PROFILES,
  AgnoxError,
  type AgnoxProfile,
  buildAgnoxConfig,
  detectProject,
  formatAgnoxConfig,
  parseAgnoxConfig,
  resolveStacks,
} from "@agnox/core";
import { confirm, isCancel, multiselect, select } from "@clack/prompts";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

const DEFAULT_INIT_PROFILE: AgnoxProfile = "lean";

export interface InitCommandInput {
  readonly stack: string | undefined;
  readonly profile: AgnoxProfile | undefined;
  readonly targets: readonly string[];
  readonly yes: boolean;
  readonly force: boolean;
  readonly json: boolean;
  readonly cwd: string;
}

export interface InitPlan {
  readonly stack: string;
  readonly profile: AgnoxProfile;
  readonly targets: readonly string[];
  readonly path: string;
  readonly content: string;
  readonly replaced: boolean;
}

export class InitError extends AgnoxError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "InitError";
  }
}

export async function runInitCommand(input: InitCommandInput): Promise<string> {
  const plan = input.yes ? await planNonInteractiveInit(input) : await planInteractiveInit(input);

  await writeFile(plan.path, plan.content, "utf8");

  return input.json ? renderInitJson(plan) : renderInitText(plan);
}

export async function planNonInteractiveInit(input: InitCommandInput): Promise<InitPlan> {
  const detection = await detectProject(input.cwd);
  const path = join(input.cwd, AGNOX_CONFIG_FILENAME);
  const exists = await fileExists(path);

  if (exists && !input.force) {
    throw new InitError(
      "agnox_config_exists",
      `${AGNOX_CONFIG_FILENAME} already exists. Re-run with --force to replace it.`,
    );
  }

  const stack = input.stack ?? detection.recommendedStack;

  if (stack === undefined) {
    throw new InitError(
      "init_stack_required",
      "Could not infer an Agnox stack. Pass --stack typescript or --stack angular.",
    );
  }

  resolveStacks([stack]);

  if (input.targets.length === 0) {
    throw new InitError(
      "init_targets_required",
      "No init targets. Pass at least one --target; Agnox never chooses providers silently.",
    );
  }

  for (const target of input.targets) {
    builtInAdapterRegistry.get(target);
  }

  const config = buildAgnoxConfig({
    stack,
    profile: input.profile ?? DEFAULT_INIT_PROFILE,
    targets: input.targets,
  });
  const parsed = parseAgnoxConfig(config);

  return {
    stack,
    profile: parsed.profile,
    targets: parsed.targets,
    path,
    content: formatAgnoxConfig(config),
    replaced: exists,
  };
}

async function planInteractiveInit(input: InitCommandInput): Promise<InitPlan> {
  const detection = await detectProject(input.cwd);
  const path = join(input.cwd, AGNOX_CONFIG_FILENAME);
  const exists = await fileExists(path);

  if (exists && !input.force) {
    throw new InitError(
      "agnox_config_exists",
      `${AGNOX_CONFIG_FILENAME} already exists. Agnox will not replace it unless --force is used.`,
    );
  }

  const detected = [
    ...detection.detectedStacks.map(formatStackName),
    detection.packageManager.name ??
      (detection.packageManager.ambiguous ? "ambiguous package manager" : undefined),
  ].filter((value): value is string => value !== undefined);
  const stack =
    input.stack ??
    (await promptValue(
      select({
        message: ["Agnox", "", section("Detected", detected), "", "Stack"].join("\n"),
        initialValue: detection.recommendedStack ?? "typescript",
        options: [
          { value: "typescript", label: "TypeScript" },
          { value: "angular", label: "Angular" },
        ],
      }),
    ));
  const profile =
    input.profile ??
    (await promptValue(
      select({
        message: "Profile",
        initialValue: DEFAULT_INIT_PROFILE,
        options: AGNOX_PROFILES.map((value) => ({ value, label: value })),
      }),
    ));
  const targets =
    input.targets.length > 0
      ? [...input.targets]
      : await promptValue(
          multiselect({
            message: "Targets",
            initialValues: ["codex", "kimi"],
            required: true,
            options: builtInAdapterRegistry.list().map((adapter) => ({
              value: adapter.id,
              label: adapter.name,
            })),
          }),
        );

  resolveStacks([stack]);
  for (const target of targets) {
    builtInAdapterRegistry.get(target);
  }

  const config = buildAgnoxConfig({ stack, profile, targets });
  const content = formatAgnoxConfig(config);
  const shouldCreate = await promptValue(
    confirm({
      message: [
        exists ? "Replace .agnox.json?" : "Create .agnox.json?",
        "",
        content.trimEnd(),
      ].join("\n"),
      initialValue: true,
    }),
  );

  if (!shouldCreate) {
    throw new InitError("init_cancelled", "Agnox init cancelled. No files were written.");
  }

  return { stack, profile, targets, path, content, replaced: exists };
}

function renderInitText(plan: InitPlan): string {
  return [
    plan.replaced ? "Replaced .agnox.json" : "Created .agnox.json",
    "",
    section("Stack", [plan.stack]),
    section("Profile", [plan.profile]),
    section("Targets", plan.targets),
    "Next: agnox doctor",
  ].join("\n");
}

function renderInitJson(plan: InitPlan): string {
  return toJson({
    path: AGNOX_CONFIG_FILENAME,
    replaced: plan.replaced,
    stack: plan.stack,
    profile: plan.profile,
    targets: plan.targets,
  });
}

async function promptValue<T>(value: Promise<T | symbol>): Promise<T> {
  const resolved = await value;

  if (isCancel(resolved)) {
    throw new InitError("init_cancelled", "Agnox init cancelled. No files were written.");
  }

  return resolved;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw cause;
  }
}

function collectTarget(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseProfile(value: string): AgnoxProfile {
  if (!AGNOX_PROFILES.includes(value as AgnoxProfile)) {
    throw new Error(`Profile must be one of: ${AGNOX_PROFILES.join(", ")}.`);
  }

  return value as AgnoxProfile;
}

function formatStackName(stack: string): string {
  return stack === "typescript" ? "TypeScript" : stack === "angular" ? "Angular" : stack;
}

export function createInitCommand(): Command {
  return new Command("init")
    .description("Create .agnox.json for this project.")
    .option("--stack <stack>", "stack to write, for example typescript or angular")
    .option("--profile <profile>", "optimization profile to write", parseProfile)
    .option("--target <id>", "target agent to configure; repeatable", collectTarget, [])
    .option("--yes", "accept inferred and explicit choices without prompts", false)
    .option("--force", "replace an existing .agnox.json", false)
    .option("--json", "print machine-readable JSON only", false)
    .action(
      async (options: {
        stack?: string;
        profile?: AgnoxProfile;
        target: string[];
        yes: boolean;
        force: boolean;
        json: boolean;
      }) => {
        await emit(() =>
          runInitCommand({
            stack: options.stack,
            profile: options.profile,
            targets: options.target,
            yes: options.yes,
            force: options.force,
            json: options.json,
            cwd: process.cwd(),
          }),
        );
      },
    );
}

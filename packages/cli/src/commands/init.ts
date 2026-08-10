import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { builtInAdapterRegistry } from "@agentyx/adapters";
import {
  AGENTYX_CONFIG_FILENAME,
  AgentyxError,
  buildAgentyxConfig,
  builtInPacks,
  detectProject,
  formatAgentyxConfig,
  parseAgentyxConfig,
  resolveAgentyxConfig,
} from "@agentyx/core";
import { confirm, isCancel, multiselect } from "@clack/prompts";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export interface InitCommandInput {
  readonly packs: readonly string[];
  readonly enable: readonly string[];
  readonly targets: readonly string[];
  readonly yes: boolean;
  readonly force: boolean;
  readonly json: boolean;
  readonly cwd: string;
}

export interface InitPlan {
  readonly packs: readonly string[];
  readonly enable: readonly string[];
  readonly targets: readonly string[];
  readonly path: string;
  readonly content: string;
  readonly replaced: boolean;
}

export class InitError extends AgentyxError {
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
  const path = join(input.cwd, AGENTYX_CONFIG_FILENAME);
  const exists = await fileExists(path);

  if (exists && !input.force) {
    throw new InitError(
      "agentyx_config_exists",
      `${AGENTYX_CONFIG_FILENAME} already exists. Re-run with --force to replace it.`,
    );
  }

  const packs = input.packs.length > 0 ? [...input.packs] : [...detection.recommendedPacks];

  if (packs.length === 0) {
    throw new InitError("init_pack_required", "Pass at least one --pack.");
  }

  if (input.targets.length === 0) {
    throw new InitError(
      "init_targets_required",
      "No init targets. Pass at least one --target; Agentyx never chooses providers silently.",
    );
  }

  for (const target of input.targets) {
    builtInAdapterRegistry.get(target);
  }

  const config = buildAgentyxConfig({ packs, enable: input.enable, targets: input.targets });
  const parsed = parseAgentyxConfig(config);
  resolveAgentyxConfig(parsed);

  return {
    packs: parsed.packs,
    enable: parsed.enable,
    targets: parsed.targets,
    path,
    content: formatAgentyxConfig(config),
    replaced: exists,
  };
}

async function planInteractiveInit(input: InitCommandInput): Promise<InitPlan> {
  const detection = await detectProject(input.cwd);
  const path = join(input.cwd, AGENTYX_CONFIG_FILENAME);
  const exists = await fileExists(path);

  if (exists && !input.force) {
    throw new InitError(
      "agentyx_config_exists",
      `${AGENTYX_CONFIG_FILENAME} already exists. Agentyx will not replace it unless --force is used.`,
    );
  }

  const detected = [
    ...detection.detectedPacks.map(formatPackName),
    detection.packageManager.name ??
      (detection.packageManager.ambiguous ? "ambiguous package manager" : undefined),
  ].filter((value): value is string => value !== undefined);
  const packs =
    input.packs.length > 0
      ? [...input.packs]
      : await promptValue(
          multiselect({
            message: ["Agentyx", "", section("Detected", detected), "", "Packs"].join("\n"),
            initialValues: [...detection.recommendedPacks],
            required: true,
            options: builtInPacks.map((pack) => ({
              value: pack.name,
              label: `${formatPackName(pack.name)} (${pack.category})`,
            })),
          }),
        );
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

  for (const target of targets) {
    builtInAdapterRegistry.get(target);
  }

  const optionalCapabilities = optionalCapabilitiesFor(packs);
  const enable =
    input.enable.length > 0 || optionalCapabilities.length === 0
      ? [...input.enable]
      : await promptValue(
          multiselect({
            message: "Optional capabilities",
            options: optionalCapabilities.map((capability) => ({
              value: capability.name,
              label: capability.name,
              hint: capability.kind,
            })),
          }),
        );
  const config = buildAgentyxConfig({ packs, enable, targets });
  const parsed = parseAgentyxConfig(config);
  resolveAgentyxConfig(parsed);
  const content = formatAgentyxConfig(config);
  const shouldCreate = await promptValue(
    confirm({
      message: [
        exists ? "Replace .agentyx.json?" : "Create .agentyx.json?",
        "",
        content.trimEnd(),
      ].join("\n"),
      initialValue: true,
    }),
  );

  if (!shouldCreate) {
    throw new InitError("init_cancelled", "Agentyx init cancelled. No files were written.");
  }

  return { packs: parsed.packs, enable: parsed.enable, targets, path, content, replaced: exists };
}

function renderInitText(plan: InitPlan): string {
  return [
    plan.replaced ? "Replaced .agentyx.json" : "Created .agentyx.json",
    "",
    section("Packs", plan.packs),
    section("Enabled", plan.enable),
    section("Targets", plan.targets),
    "Next: agentyx doctor",
  ].join("\n");
}

function renderInitJson(plan: InitPlan): string {
  return toJson({
    path: AGENTYX_CONFIG_FILENAME,
    replaced: plan.replaced,
    packs: plan.packs,
    enable: plan.enable,
    targets: plan.targets,
  });
}

async function promptValue<T>(value: Promise<T | symbol>): Promise<T> {
  const resolved = await value;

  if (isCancel(resolved)) {
    throw new InitError("init_cancelled", "Agentyx init cancelled. No files were written.");
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

function collectName(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function collectTarget(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function formatPackName(pack: string): string {
  return pack === "typescript" ? "TypeScript" : pack === "angular" ? "Angular" : pack;
}

function optionalCapabilitiesFor(packs: readonly string[]): readonly {
  readonly name: string;
  readonly kind: string;
}[] {
  const selected = new Set(packs);
  const capabilities: Array<{ name: string; kind: string }> = [];
  const seen = new Set<string>();

  for (const pack of builtInPacks) {
    if (!selected.has(pack.name)) {
      continue;
    }

    for (const server of pack.mcpServers ?? []) {
      if (
        typeof server === "object" &&
        server.activation === "optional" &&
        !seen.has(server.name)
      ) {
        seen.add(server.name);
        capabilities.push({ name: server.name, kind: "MCP" });
      }
    }

    for (const tool of pack.tools ?? []) {
      if (typeof tool === "object" && tool.activation === "optional" && !seen.has(tool.name)) {
        seen.add(tool.name);
        capabilities.push({ name: tool.name, kind: "tool" });
      }
    }
  }

  return capabilities;
}

export function createInitCommand(): Command {
  return new Command("init")
    .description("Create .agentyx.json for this project.")
    .option("--pack <pack>", "pack to write; repeatable", collectName, [])
    .option("--enable <id>", "optional capability to enable; repeatable", collectName, [])
    .option("--target <id>", "target agent to configure; repeatable", collectTarget, [])
    .option("--yes", "accept inferred and explicit choices without prompts", false)
    .option("--force", "replace an existing .agentyx.json", false)
    .option("--json", "print machine-readable JSON only", false)
    .action(
      async (options: {
        pack: string[];
        enable: string[];
        target: string[];
        yes: boolean;
        force: boolean;
        json: boolean;
      }) => {
        await emit(() =>
          runInitCommand({
            packs: options.pack,
            enable: options.enable,
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

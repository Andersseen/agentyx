import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { builtInAdapterRegistry, detectConfiguredTargets } from "@agentyx/adapters";
import {
  AGENTYX_CONFIG_FILENAME,
  AgentyxError,
  buildAgentyxConfig,
  builtInMcpServerRegistry,
  builtInPacks,
  detectProject,
  formatAgentyxConfig,
  parseAgentyxConfig,
  resolveAgentyxConfig,
} from "@agentyx/core";
import { autocompleteMultiselect, confirm, isCancel, multiselect } from "@clack/prompts";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";
import { formatPackName, packOptions, targetOptions } from "../prompts.js";
import { executeInstall, type InstallOutcome, type InstallReport } from "./install.js";

export interface InitCommandInput {
  readonly packs: readonly string[];
  readonly enable: readonly string[];
  readonly targets: readonly string[];
  readonly yes: boolean;
  readonly force: boolean;
  readonly json: boolean;
  /**
   * Install into the configured targets once the config is written.
   *
   * Left undefined, an interactive run asks and a `--yes` run does not install,
   * so a script's behaviour never changes without the flag.
   */
  readonly install?: boolean;
  readonly cwd: string;
}

export interface InitPlan {
  readonly packs: readonly string[];
  readonly enable: readonly string[];
  readonly targets: readonly string[];
  readonly path: string;
  readonly content: string;
  readonly replaced: boolean;
  /** Whether this run should go on to install, decided before anything is written. */
  readonly install: boolean;
}

export class InitError extends AgentyxError {
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(code, message, options);
    this.name = "InitError";
  }
}

/**
 * Creates `.agentyx.json` and, when asked to, installs it.
 *
 * Writing a config file is not what anyone came for — the skills landing in the
 * agents is. So `init` finishes the job in one run instead of ending on the
 * name of a second command the user has no reason to know. The installation is
 * `agentyx install` itself, not a copy of it, so the plan, the manifest and the
 * conflict rules are identical either way.
 */
export async function runInitCommand(input: InitCommandInput): Promise<string> {
  const plan = input.yes ? await planNonInteractiveInit(input) : await planInteractiveInit(input);

  await writeFile(plan.path, plan.content, "utf8");

  if (!plan.install) {
    return input.json ? renderInitJson(plan, undefined) : renderInitText(plan, undefined);
  }

  const outcome = await installAfterInit(input);

  return input.json ? renderInitJson(plan, outcome.report) : renderInitText(plan, outcome.text);
}

/**
 * Runs the installation the config just written describes.
 *
 * A failure here is reported as a failure of `init`, but with the config file
 * mentioned: it exists, and re-running `agentyx install` after fixing the cause
 * is all that is left to do. Saying only "conflict" would leave the user
 * guessing whether anything happened at all.
 */
async function installAfterInit(input: InitCommandInput): Promise<InstallOutcome> {
  try {
    return await executeInstall({
      packs: [],
      targets: [],
      skills: [],
      mcpServers: [],
      select: false,
      dryRun: false,
      json: input.json,
      cwd: input.cwd,
    });
  } catch (cause) {
    if (!(cause instanceof AgentyxError)) {
      throw cause;
    }

    throw new InitError(
      "init_install_failed",
      [
        `${AGENTYX_CONFIG_FILENAME} was created, but the installation did not run:`,
        cause.message,
        "Resolve the problem above and run agentyx install.",
      ].join("\n"),
      { cause },
    );
  }
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
    install: input.install === true,
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
          autocompleteMultiselect({
            message: ["Agentyx", "", section("Detected", detected), "", "Packs"].join("\n"),
            initialValues: [...detection.recommendedPacks],
            required: true,
            maxItems: 10,
            placeholder: "Type to search packs...",
            options: [...packOptions()],
          }),
        );
  const configured = await detectConfiguredTargets(input.cwd);
  const targets =
    input.targets.length > 0
      ? [...input.targets]
      : await promptValue(
          multiselect({
            message: "Targets",
            initialValues: [...configured],
            required: true,
            options: [...targetOptions(configured)],
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
              hint:
                capability.description === undefined
                  ? capability.kind
                  : `${capability.kind} — ${capability.description}`,
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

  const install =
    input.install ??
    (await promptValue(
      confirm({
        message: `Install the skills into ${formatTargetNames(targets)} now?`,
        initialValue: true,
      }),
    ));

  return {
    packs: parsed.packs,
    enable: parsed.enable,
    targets,
    path,
    content,
    replaced: exists,
    install,
  };
}

/** Provider names as a reader would say them, for a question about them. */
function formatTargetNames(targets: readonly string[]): string {
  const names = targets.map((target) => builtInAdapterRegistry.get(target).name);
  const last = names.at(-1);

  if (names.length <= 1 || last === undefined) {
    return last ?? "the configured targets";
  }

  return `${names.slice(0, -1).join(", ")} and ${last}`;
}

/**
 * The init report, ending on the one command that still has to run.
 *
 * When nothing was installed that command is `install`, because a config file
 * on its own has changed nothing for any agent. When the install already
 * happened the remaining step is `doctor`, which verifies it.
 */
function renderInitText(plan: InitPlan, install: string | undefined): string {
  return [
    plan.replaced ? "Replaced .agentyx.json" : "Created .agentyx.json",
    "",
    section("Packs", plan.packs),
    section("Enabled", plan.enable),
    section("Targets", plan.targets),
    ...(install === undefined
      ? [`Next: agentyx install — writes these skills into ${formatTargetNames(plan.targets)}.`]
      : ["", install, "", "Next: agentyx doctor"]),
  ].join("\n");
}

function renderInitJson(plan: InitPlan, install: InstallReport | undefined): string {
  return toJson({
    path: AGENTYX_CONFIG_FILENAME,
    replaced: plan.replaced,
    packs: plan.packs,
    enable: plan.enable,
    targets: plan.targets,
    installed: install !== undefined,
    ...(install === undefined ? {} : { install }),
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

function optionalCapabilitiesFor(packs: readonly string[]): readonly {
  readonly name: string;
  readonly kind: string;
  readonly description: string | undefined;
}[] {
  const selected = new Set(packs);
  const capabilities: Array<{ name: string; kind: string; description: string | undefined }> = [];
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
        capabilities.push({
          name: server.name,
          kind: "MCP",
          description: describeMcpServer(server.name),
        });
      }
    }

    for (const tool of pack.tools ?? []) {
      if (typeof tool === "object" && tool.activation === "optional" && !seen.has(tool.name)) {
        seen.add(tool.name);
        capabilities.push({ name: tool.name, kind: "tool", description: undefined });
      }
    }
  }

  return capabilities;
}

/**
 * An optional MCP server's own description, or `undefined` when it is not a
 * built-in one. A pack may reference a server Agentyx does not ship, and that
 * must not stop the prompt from offering it.
 */
function describeMcpServer(name: string): string | undefined {
  return builtInMcpServerRegistry.listMetadata().find((server) => server.name === name)
    ?.description;
}

export function createInitCommand(): Command {
  return new Command("init")
    .description("Create .agentyx.json for this project.")
    .option("--pack <pack>", "pack to write; repeatable", collectName, [])
    .option("--enable <id>", "optional capability to enable; repeatable", collectName, [])
    .option("--target <id>", "target agent to configure; repeatable", collectTarget, [])
    .option("--yes", "accept inferred and explicit choices without prompts", false)
    .option("--install", "install into the configured targets without asking")
    .option("--force", "replace an existing .agentyx.json", false)
    .option("--json", "print machine-readable JSON only", false)
    .action(
      async (options: {
        pack: string[];
        enable: string[];
        target: string[];
        yes: boolean;
        install?: boolean;
        force: boolean;
        json: boolean;
      }) => {
        await emit(() =>
          runInitCommand({
            packs: options.pack,
            enable: options.enable,
            targets: options.target,
            yes: options.yes,
            ...(options.install === undefined ? {} : { install: options.install }),
            force: options.force,
            json: options.json,
            cwd: process.cwd(),
          }),
        );
      },
    );
}

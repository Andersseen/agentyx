import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { detectConfiguredTargets } from "@agentyx/adapters";
import {
  type AgentyxConfig,
  type AgentyxConfigInput,
  type AgentyxConfigMutations,
  AgentyxConfigNotFoundError,
  AgentyxError,
  builtInMcpServerRegistry,
  detectProject,
  formatAgentyxConfig,
  loadAgentyxProject,
  mutateAgentyxConfig,
  recommendCapabilities,
  resolveAgentyxConfig,
} from "@agentyx/core";
import { confirm, isCancel, multiselect } from "@clack/prompts";
import { Command } from "commander";
import { emit, toJson } from "../output.js";
import { targetOptions } from "../prompts.js";
import { runDoctorCommand } from "./doctor.js";
import { runSyncCommand } from "./sync.js";

export interface ConfigureCommandInput extends AgentyxConfigMutations {
  readonly cwd: string;
  readonly dryRun: boolean;
  readonly json: boolean;
  readonly yes: boolean;
  readonly sync: boolean;
  readonly interactive?: boolean;
}

export class ConfigureCommandError extends AgentyxError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "ConfigureCommandError";
  }
}

export async function runConfigureCommand(input: ConfigureCommandInput): Promise<string> {
  let project: Awaited<ReturnType<typeof loadAgentyxProject>>;
  try {
    project = await loadAgentyxProject(input.cwd);
  } catch (cause) {
    if (cause instanceof AgentyxConfigNotFoundError) {
      throw new ConfigureCommandError(
        "configure_config_not_found",
        `No .agentyx.json exists here. Run agentyx init first. (${cause.filePath})`,
      );
    }
    throw cause;
  }
  const mutations = hasExplicitMutations(input) ? pickMutations(input) : undefined;
  const selected =
    mutations === undefined && input.interactive === true
      ? await promptConfiguration(
          project.config,
          input.cwd,
          project.packRegistry,
          project.skillRegistry,
        )
      : (mutations ?? {});
  const result = mutateAgentyxConfig(
    project.config,
    selected,
    project.packRegistry,
    project.skillRegistry,
  );
  const changed = JSON.stringify(result.config) !== JSON.stringify(project.config);
  const preview = renderChanges(result.changes, changed);
  const doctorReport = input.json
    ? await runDoctorCommand({ cwd: input.cwd, json: true })
    : undefined;
  let confirmed = input.yes;

  if (changed && !input.dryRun && !input.yes && input.interactive !== true) {
    throw new ConfigureCommandError(
      "configure_confirmation_required",
      "Use --yes to apply explicit configuration changes without an interactive confirmation.",
    );
  }

  if (input.interactive === true && changed && !input.dryRun && !input.yes) {
    const accepted = await confirm({ message: `${preview}\n\nWrite this configuration?` });
    if (isCancel(accepted) || !accepted) {
      throw new ConfigureCommandError(
        "configure_cancelled",
        "Configure cancelled. No files were written.",
      );
    }
    confirmed = true;
  }

  const shouldWrite = changed && !input.dryRun && confirmed;

  if (shouldWrite) {
    const raw = JSON.parse(await readFile(join(input.cwd, ".agentyx.json"), "utf8")) as Record<
      string,
      unknown
    >;
    await writeConfig(input.cwd, preserveRawConfigShape(raw, project.config, result.config));
  }

  const report = {
    changed,
    config: { before: project.config, after: result.config },
    changes: result.changes,
    doctor: {
      reviewedDormantCapabilities:
        doctorReport === undefined
          ? []
          : doctorReport.utilization.capabilities
              .filter(
                (capability) =>
                  result.config.enable.includes(capability.name) &&
                  capability.state === "dormant-candidate" &&
                  (capability.contextCost === "high" || capability.contextCost === "medium"),
              )
              .map((capability) => capability.name),
    },
    written: shouldWrite,
    dryRun: input.dryRun,
  };
  if (input.json) {
    const output = { ...report, sync: undefined };
    if (shouldWrite && input.sync) {
      try {
        const syncOutput = await runSyncCommand({
          cwd: input.cwd,
          dryRun: false,
          force: false,
          json: true,
        });
        return toJson({ ...report, sync: JSON.parse(syncOutput) });
      } catch (cause) {
        if (cause instanceof AgentyxError) {
          throw new ConfigureCommandError(
            "configure_sync_failed",
            `Configuration updated. Sync blocked: ${cause.message}\nResolve the conflict and run agentyx sync.`,
          );
        }
        throw cause;
      }
    }
    return toJson(output);
  }

  let text = changed ? preview : "No configuration changes.";
  if (input.dryRun)
    text += "\n\nDry run: .agentyx.json and installed provider state were not changed.";
  else if (shouldWrite) text += "\n\nConfiguration updated.";
  else if (input.interactive !== true)
    text += "\n\nNothing was written. Use explicit mutation flags and --yes to apply changes.";
  if (shouldWrite && input.sync) {
    try {
      text += `\n\n${await runSyncCommand({ cwd: input.cwd, dryRun: false, force: false, json: false })}`;
      text += "\n\nNext: agentyx doctor";
    } catch (cause) {
      if (cause instanceof AgentyxError) {
        throw new ConfigureCommandError(
          "configure_sync_failed",
          `Configuration updated. Sync blocked: ${cause.message}\nResolve the conflict and run agentyx sync.`,
        );
      }
      throw cause;
    }
  }
  return text;
}

async function promptConfiguration(
  config: Awaited<ReturnType<typeof loadAgentyxProject>>["config"],
  cwd: string,
  registry: Awaited<ReturnType<typeof loadAgentyxProject>>["packRegistry"],
  skillRegistry: Awaited<ReturnType<typeof loadAgentyxProject>>["skillRegistry"],
): Promise<AgentyxConfigMutations> {
  const detection = await detectProject(cwd);
  const recommendations = recommendCapabilities(detection.signals, {
    configuredPacks: config.packs,
  });
  const packHints = new Map(
    recommendations.packs.map((pack) => [pack.name, pack.reasons.join(" ")]),
  );
  const packs = await promptValues(
    multiselect({
      message: "Packs",
      initialValues: [...config.packs],
      required: false,
      options: [...registry.keys()].map((name) => ({
        value: name,
        label: `${name}${config.packs.includes(name) && !packHints.has(name) ? " · selected" : ""}`,
        ...(packHints.has(name) ? { hint: `recommended: ${packHints.get(name)}` } : {}),
      })),
    }),
  );
  const base = mutateAgentyxConfig(
    config,
    { removePacks: config.packs.filter((name) => !packs.includes(name)) },
    registry,
    skillRegistry,
  ).config;
  const declared = resolveAgentyxConfig({ ...base, enable: [] }, registry, skillRegistry);
  const optional = [
    ...declared.declaredMcpServers
      .filter((item) => item.activation === "optional")
      .map((item) => ({ name: item.name, kind: "MCP" })),
    ...declared.declaredTools
      .filter((item) => item.activation === "optional")
      .map((item) => ({ name: item.name, kind: "tool" })),
    ...declared.declaredHooks
      .filter((item) => item.activation === "optional")
      .map((item) => ({ name: item.name, kind: "hook" })),
    ...declared.declaredAgents
      .filter((item) => item.activation === "optional")
      .map((item) => ({ name: item.name, kind: "agent" })),
  ];
  const doctor = await runDoctorCommand({ cwd, json: false });
  const selectedCaps = new Set(
    config.enable.filter((name) => optional.some((item) => item.name === name)),
  );
  const capOptions = optional.map(({ name, kind }) => {
    const usage = doctor.utilization.capabilities.find((item) => item.name === name);
    const mcp = builtInMcpServerRegistry.listMetadata().find((item) => item.name === name);
    const details = usageHint(usage, mcp?.contextCost);
    return {
      value: name,
      label: `${name} · ${kind}${details.length > 0 ? ` · ${details.join(" · ")}` : ""}`,
      ...(usage?.state === "dormant-candidate" &&
      (mcp?.contextCost === "high" || mcp?.contextCost === "medium")
        ? { hint: "Doctor suggests reviewing this capability" }
        : {}),
    };
  });
  const enable = await promptValues(
    multiselect({
      message: "Optional capabilities",
      initialValues: [...selectedCaps],
      required: false,
      options: capOptions,
    }),
  );
  const detectedTargets = await detectConfiguredTargets(cwd);
  const standardTargets = targetOptions(detectedTargets).map((option) => ({
    ...option,
    label: `${option.label}${config.targets.includes(option.value) ? " · selected" : ""}`,
  }));
  const targets = await promptValues(
    multiselect({
      message: "Targets",
      initialValues: [...config.targets],
      required: false,
      options: [
        ...standardTargets,
        ...config.targets
          .filter((name) => !standardTargets.some((option) => option.value === name))
          .map((name) => ({ value: name, label: `${name} · selected` })),
      ],
    }),
  );
  return {
    addPacks: packs.filter((name) => !config.packs.includes(name)),
    removePacks: config.packs.filter((name) => !packs.includes(name)),
    enable: enable.filter((name) => !config.enable.includes(name)),
    disable: config.enable.filter((name) => !enable.includes(name)),
    addTargets: targets.filter((name) => !config.targets.includes(name)),
    removeTargets: config.targets.filter((name) => !targets.includes(name)),
  };
}

function usageHint(
  usage: { state: string; observedSessions: number; eligibleSessions: number } | undefined,
  contextCost: string | undefined,
): string[] {
  const parts: string[] = [];
  if (contextCost !== undefined) parts.push(`${contextCost} context`);
  if (usage?.state === "dormant-candidate")
    parts.push(`0 / ${usage.eligibleSessions} current-harness observable sessions`);
  else if (usage?.state === "observed")
    parts.push(
      usage.eligibleSessions > 0
        ? `observed in ${usage.observedSessions} / ${usage.eligibleSessions} current-harness sessions`
        : "observed use",
    );
  else if (usage?.state === "insufficient-sample") parts.push("insufficient observation sample");
  return parts;
}

async function promptValues<T>(prompt: Promise<T | symbol>): Promise<T> {
  const value = await prompt;
  if (isCancel(value))
    throw new ConfigureCommandError(
      "configure_cancelled",
      "Configure cancelled. No files were written.",
    );
  return value;
}

async function writeConfig(cwd: string, config: AgentyxConfigInput): Promise<void> {
  const path = join(cwd, ".agentyx.json");
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, formatAgentyxConfig(config), { encoding: "utf8", flag: "wx" });
    await rename(temporary, path);
  } catch (cause) {
    await rm(temporary, { force: true });
    throw cause;
  }
}

function preserveRawConfigShape(
  raw: Record<string, unknown>,
  before: AgentyxConfig,
  after: AgentyxConfig,
): AgentyxConfigInput {
  const next: Record<string, unknown> = { ...raw };
  for (const key of ["packs", "enable", "targets"] as const) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      next[key] = after[key];
    }
  }
  return next as AgentyxConfigInput;
}

function hasExplicitMutations(input: ConfigureCommandInput): boolean {
  return [
    input.addPacks,
    input.removePacks,
    input.enable,
    input.disable,
    input.addTargets,
    input.removeTargets,
  ].some((items) => (items?.length ?? 0) > 0);
}

function pickMutations(input: ConfigureCommandInput): AgentyxConfigMutations {
  return {
    ...(input.addPacks === undefined ? {} : { addPacks: input.addPacks }),
    ...(input.removePacks === undefined ? {} : { removePacks: input.removePacks }),
    ...(input.enable === undefined ? {} : { enable: input.enable }),
    ...(input.disable === undefined ? {} : { disable: input.disable }),
    ...(input.addTargets === undefined ? {} : { addTargets: input.addTargets }),
    ...(input.removeTargets === undefined ? {} : { removeTargets: input.removeTargets }),
  };
}

function renderChanges(
  changes: ReturnType<typeof mutateAgentyxConfig>["changes"],
  changed: boolean,
): string {
  if (!changed) return "No configuration changes.";
  const rows = (added: readonly string[], removed: readonly string[]) => [
    ...added.map((name) => `    + ${name}`),
    ...removed.map((name) => `    - ${name}`),
  ];
  return [
    "Configuration changes",
    "",
    "  Packs",
    ...(rows(changes.packs.added, changes.packs.removed).length
      ? rows(changes.packs.added, changes.packs.removed)
      : ["    (none)"]),
    "  Optional capabilities",
    ...(rows(changes.capabilities.enabled, [
      ...changes.capabilities.disabled,
      ...changes.capabilities.orphaned,
    ]).length
      ? rows(changes.capabilities.enabled, [
          ...changes.capabilities.disabled,
          ...changes.capabilities.orphaned,
        ])
      : ["    (none)"]),
    "  Targets",
    ...(rows(changes.targets.added, changes.targets.removed).length
      ? rows(changes.targets.added, changes.targets.removed)
      : ["    (none)"]),
    ...(changes.capabilities.orphaned.length
      ? [
          "  Consequences",
          ...changes.capabilities.orphaned.map(
            (name) => `    - ${name} disabled because no selected pack declares it`,
          ),
        ]
      : []),
  ].join("\n");
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function createConfigureCommand(): Command {
  return new Command("configure")
    .description("Edit an existing Agentyx desired configuration.")
    .option("--add-pack <name>", "add a pack", collect, [])
    .option("--remove-pack <name>", "remove a pack", collect, [])
    .option("--enable <capability>", "enable an optional capability", collect, [])
    .option("--disable <capability>", "disable an optional capability", collect, [])
    .option("--add-target <id>", "add a provider target", collect, [])
    .option("--remove-target <id>", "remove a provider target", collect, [])
    .option("--dry-run", "preview changes without writing", false)
    .option("--json", "print machine-readable JSON only", false)
    .option("--yes", "apply explicit mutations without confirmation", false)
    .option("--sync", "sync provider state after updating configuration", false)
    .action(async (options) => {
      await emit(() =>
        runConfigureCommand({
          addPacks: options.addPack,
          removePacks: options.removePack,
          enable: options.enable,
          disable: options.disable,
          addTargets: options.addTarget,
          removeTargets: options.removeTarget,
          dryRun: options.dryRun,
          json: options.json,
          yes: options.yes,
          sync: options.sync,
          cwd: process.cwd(),
          interactive: process.stdin.isTTY === true && !options.json && !options.dryRun,
        }),
      );
    });
}

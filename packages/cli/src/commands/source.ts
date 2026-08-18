import {
  inspectTrustedSource,
  knownTrustedSourceRegistry,
  knownTrustedSources,
  loadAgentyxConfig,
  TrustedSourceLoadError,
} from "@agentyx/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export function runSourceListCommand(): string {
  return knownTrustedSources
    .map((source) => `${source.name.padEnd(14)} ${source.type.padEnd(12)} ${source.installStatus}`)
    .join("\n");
}

export interface SourceShowCommandInput {
  readonly name: string;
  readonly json: boolean;
}

export function runSourceShowCommand(input: SourceShowCommandInput): string {
  const source = knownTrustedSourceRegistry.get(input.name);

  if (source === undefined) {
    throw new TrustedSourceLoadError(input.name, "the source is not in the trusted registry");
  }

  if (input.json) {
    return toJson(source);
  }

  return [
    source.name,
    source.displayName,
    source.description,
    `repository: ${source.repository}`,
    `type: ${source.type}`,
    `manifest: ${source.manifestPath}`,
    `recommended path: ${source.recommendedPath}`,
    `install: ${source.installStatus}`,
    source.installNote,
    section("Configuration", [
      `"trustedSources": [{ "name": "${source.name}", "path": "${source.recommendedPath}", "ref": "v5.1.0" }]`,
    ]),
  ].join("\n");
}

export interface SourceInspectCommandInput {
  readonly name: string;
  readonly json: boolean;
  readonly cwd: string;
}

export async function runSourceInspectCommand(input: SourceInspectCommandInput): Promise<string> {
  const config = await loadAgentyxConfig(input.cwd);
  const reference = (config.trustedSources ?? []).find((source) => source.name === input.name);

  if (reference === undefined) {
    throw new TrustedSourceLoadError(
      input.name,
      `the source is not configured in .agentyx.json trustedSources`,
    );
  }

  const inspection = await inspectTrustedSource(input.cwd, reference);

  if (input.json) {
    return toJson(inspection);
  }

  const resourceCount = inspection.skills.filter((skill) => skill.hasResources).length;

  return [
    inspection.definition.name,
    inspection.definition.displayName,
    `path: ${inspection.reference.path}`,
    `ref: ${inspection.reference.ref}`,
    `manifest version: ${inspection.manifest.version}`,
    `license: ${inspection.manifest.license}`,
    `repository: ${inspection.manifest.repository}`,
    `skills: ${inspection.skills.length}`,
    `skills with resources: ${resourceCount}`,
    `installable: ${inspection.installable ? "yes" : "no"}`,
    section("Install", [inspection.installNote]),
    section(
      "Skills",
      inspection.skills.map((skill) =>
        skill.hasResources ? `${skill.name}    resources` : skill.name,
      ),
    ),
  ].join("\n");
}

export function createSourceCommand(): Command {
  const source = new Command("source").description("Inspect trusted external Skill sources.");

  source
    .command("list")
    .description("List known trusted external source identifiers.")
    .action(async () => {
      await emit(() => runSourceListCommand());
    });

  source
    .command("show")
    .description("Print one trusted source definition.")
    .argument("<name>", "source identifier, for example superpowers")
    .option("--json", "print machine-readable JSON only", false)
    .action(async (name: string, options: { json: boolean }) => {
      await emit(() => runSourceShowCommand({ name, json: options.json }));
    });

  source
    .command("inspect")
    .description("Inspect a configured local checkout of a trusted source.")
    .argument("<name>", "source identifier, for example superpowers")
    .option("--json", "print machine-readable JSON only", false)
    .action(async (name: string, options: { json: boolean }) => {
      await emit(() => runSourceInspectCommand({ name, json: options.json, cwd: process.cwd() }));
    });

  return source;
}

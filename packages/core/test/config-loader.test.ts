import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AgentyxConfigNotFoundError,
  AgentyxConfigParseError,
  AgentyxConfigValidationError,
} from "../src/config/errors.js";
import {
  AGENTYX_CONFIG_FILENAME,
  agentyxConfigPath,
  loadAgentyxConfig,
} from "../src/config/loader.js";

const exampleProjectPath = fileURLToPath(new URL("../../../examples/angular", import.meta.url));

describe("loadAgentyxConfig", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "agentyx-config-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  async function writeConfig(contents: string): Promise<void> {
    await writeFile(join(projectPath, AGENTYX_CONFIG_FILENAME), contents, "utf8");
  }

  it("loads and validates a configuration file", async () => {
    await writeConfig(
      JSON.stringify({
        packs: ["technical", "typescript", "angular"],
        enable: [],
        targets: ["codex"],
      }),
    );

    await expect(loadAgentyxConfig(projectPath)).resolves.toEqual({
      packs: ["technical", "typescript", "angular"],
      enable: [],
      targets: ["codex"],
    });
  });

  it("applies defaults for omitted fields", async () => {
    await writeConfig(JSON.stringify({ packs: ["technical"] }));

    await expect(loadAgentyxConfig(projectPath)).resolves.toEqual({
      packs: ["technical"],
      enable: [],
      targets: [],
    });
  });

  it("reports a missing file with its path", async () => {
    const expectedPath = agentyxConfigPath(projectPath);

    await expect(loadAgentyxConfig(projectPath)).rejects.toThrow(AgentyxConfigNotFoundError);
    await expect(loadAgentyxConfig(projectPath)).rejects.toThrow(expectedPath);
  });

  it("reports a missing project directory as a missing file", async () => {
    await expect(loadAgentyxConfig(join(projectPath, "nope"))).rejects.toThrow(
      AgentyxConfigNotFoundError,
    );
  });

  it("reports malformed JSON", async () => {
    await writeConfig("{ not json");

    await expect(loadAgentyxConfig(projectPath)).rejects.toThrow(AgentyxConfigParseError);
    await expect(loadAgentyxConfig(projectPath)).rejects.toThrow(/is not valid JSON/);
  });

  it("reports schema violations without recovering from them", async () => {
    await writeConfig(JSON.stringify({ enable: ["RTK"] }));

    await expect(loadAgentyxConfig(projectPath)).rejects.toThrow(AgentyxConfigValidationError);
    await expect(loadAgentyxConfig(projectPath)).rejects.toThrow(/enable\[0\]/);
  });

  it("does not search parent directories", async () => {
    await writeConfig(JSON.stringify({ packs: ["technical"] }));
    const childPath = join(projectPath, "packages", "app");
    await mkdir(childPath, { recursive: true });

    await expect(loadAgentyxConfig(childPath)).rejects.toThrow(AgentyxConfigNotFoundError);
  });

  it("loads the repository example project", async () => {
    await expect(loadAgentyxConfig(exampleProjectPath)).resolves.toEqual({
      packs: ["technical", "typescript", "angular"],
      enable: [],
      targets: ["codex", "claude"],
    });
  });
});

describe("agentyxConfigPath", () => {
  it("appends the configuration filename to the project path", () => {
    expect(agentyxConfigPath("/projects/app")).toBe(join("/projects/app", ".agentyx.json"));
  });
});

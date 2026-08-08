import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AgnoxConfigNotFoundError,
  AgnoxConfigParseError,
  AgnoxConfigValidationError,
} from "../src/config/errors.js";
import { AGNOX_CONFIG_FILENAME, agnoxConfigPath, loadAgnoxConfig } from "../src/config/loader.js";

const exampleProjectPath = fileURLToPath(new URL("../../../examples/angular", import.meta.url));

describe("loadAgnoxConfig", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "agnox-config-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  async function writeConfig(contents: string): Promise<void> {
    await writeFile(join(projectPath, AGNOX_CONFIG_FILENAME), contents, "utf8");
  }

  it("loads and validates a configuration file", async () => {
    await writeConfig(
      JSON.stringify({ extends: ["angular"], profile: "lean", targets: ["codex"] }),
    );

    await expect(loadAgnoxConfig(projectPath)).resolves.toEqual({
      extends: ["angular"],
      profile: "lean",
      targets: ["codex"],
    });
  });

  it("applies defaults for omitted fields", async () => {
    await writeConfig(JSON.stringify({ extends: ["core"] }));

    await expect(loadAgnoxConfig(projectPath)).resolves.toEqual({
      extends: ["core"],
      profile: "balanced",
      targets: [],
    });
  });

  it("reports a missing file with its path", async () => {
    const expectedPath = agnoxConfigPath(projectPath);

    await expect(loadAgnoxConfig(projectPath)).rejects.toThrow(AgnoxConfigNotFoundError);
    await expect(loadAgnoxConfig(projectPath)).rejects.toThrow(expectedPath);
  });

  it("reports a missing project directory as a missing file", async () => {
    await expect(loadAgnoxConfig(join(projectPath, "nope"))).rejects.toThrow(
      AgnoxConfigNotFoundError,
    );
  });

  it("reports malformed JSON", async () => {
    await writeConfig("{ not json");

    await expect(loadAgnoxConfig(projectPath)).rejects.toThrow(AgnoxConfigParseError);
    await expect(loadAgnoxConfig(projectPath)).rejects.toThrow(/is not valid JSON/);
  });

  it("reports schema violations without recovering from them", async () => {
    await writeConfig(JSON.stringify({ profile: "turbo" }));

    await expect(loadAgnoxConfig(projectPath)).rejects.toThrow(AgnoxConfigValidationError);
    await expect(loadAgnoxConfig(projectPath)).rejects.toThrow(/profile: Profile must be one of/);
  });

  it("does not search parent directories", async () => {
    await writeConfig(JSON.stringify({ extends: ["core"] }));
    const childPath = join(projectPath, "packages", "app");
    await mkdir(childPath, { recursive: true });

    await expect(loadAgnoxConfig(childPath)).rejects.toThrow(AgnoxConfigNotFoundError);
  });

  it("loads the repository example project", async () => {
    await expect(loadAgnoxConfig(exampleProjectPath)).resolves.toEqual({
      extends: ["angular"],
      profile: "balanced",
      targets: ["codex", "kimi"],
    });
  });
});

describe("agnoxConfigPath", () => {
  it("appends the configuration filename to the project path", () => {
    expect(agnoxConfigPath("/projects/app")).toBe(join("/projects/app", ".agnox.json"));
  });
});

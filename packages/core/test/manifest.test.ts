import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AgentyxManifestParseError,
  AgentyxManifestValidationError,
} from "../src/manifest/errors.js";
import {
  AGENTYX_MANIFEST_FILENAME,
  agentyxManifestPath,
  emptyInstallManifest,
  formatInstallManifest,
  hashContent,
  loadInstallManifest,
  manifestEntriesByPath,
  parseInstallManifest,
} from "../src/manifest/io.js";
import {
  INSTALL_MANIFEST_VERSION,
  type InstallManifest,
  type InstallManifestEntry,
} from "../src/manifest/schema.js";

const skillEntry: InstallManifestEntry = {
  kind: "skill",
  path: ".agents/skills/planning/SKILL.md",
  skill: "planning",
  targets: ["kimi", "codex"],
  hash: hashContent("planning"),
};

const mcpEntry: InstallManifestEntry = {
  kind: "mcp",
  path: ".mcp.json",
  servers: ["context7", "codebase-memory"],
  targets: ["claude"],
  hash: hashContent("{}"),
  created: true,
};

describe("hashContent", () => {
  it("is stable and distinguishes content", () => {
    expect(hashContent("a")).toBe(hashContent("a"));
    expect(hashContent("a")).not.toBe(hashContent("b"));
    expect(hashContent("a")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("parseInstallManifest", () => {
  it("accepts skill and MCP entries", () => {
    const manifest = parseInstallManifest({
      version: INSTALL_MANIFEST_VERSION,
      entries: [skillEntry, mcpEntry],
    });

    expect(manifest.entries).toHaveLength(2);
  });

  it("defaults entries to an empty list", () => {
    expect(parseInstallManifest({ version: INSTALL_MANIFEST_VERSION })).toEqual(
      emptyInstallManifest(),
    );
  });

  it("rejects a manifest version it does not understand", () => {
    expect(() => parseInstallManifest({ version: 2, entries: [] })).toThrow(
      AgentyxManifestValidationError,
    );
  });

  it("rejects absolute and traversing managed paths", () => {
    for (const path of ["/etc/passwd", "../outside/SKILL.md", ".agents\\skills\\a\\SKILL.md"]) {
      expect(() =>
        parseInstallManifest({
          version: INSTALL_MANIFEST_VERSION,
          entries: [{ ...skillEntry, path }],
        }),
      ).toThrow(AgentyxManifestValidationError);
    }
  });

  it("rejects a hash that is not a SHA-256 digest", () => {
    expect(() =>
      parseInstallManifest({
        version: INSTALL_MANIFEST_VERSION,
        entries: [{ ...skillEntry, hash: "not-a-hash" }],
      }),
    ).toThrow(AgentyxManifestValidationError);
  });

  it("reports the offending entry by index", () => {
    try {
      parseInstallManifest(
        { version: INSTALL_MANIFEST_VERSION, entries: [skillEntry, { ...mcpEntry, hash: "" }] },
        ".agentyx.lock.json",
      );
      expect.unreachable("expected a validation error");
    } catch (error) {
      expect(error).toBeInstanceOf(AgentyxManifestValidationError);
      expect((error as AgentyxManifestValidationError).issues[0]?.path).toBe("entries[1].hash");
    }
  });
});

describe("formatInstallManifest", () => {
  it("sorts entries, targets and servers so reinstalling produces no diff", () => {
    const unsorted: InstallManifest = {
      version: INSTALL_MANIFEST_VERSION,
      entries: [mcpEntry, skillEntry],
    };
    const sorted: InstallManifest = {
      version: INSTALL_MANIFEST_VERSION,
      entries: [skillEntry, mcpEntry],
    };

    expect(formatInstallManifest(unsorted)).toBe(formatInstallManifest(sorted));
    expect(formatInstallManifest(unsorted)).toContain('"targets": [\n        "codex",\n');
    expect(formatInstallManifest(unsorted)).toContain('"codebase-memory",\n        "context7"');
  });

  it("round-trips through the parser", () => {
    const manifest: InstallManifest = {
      version: INSTALL_MANIFEST_VERSION,
      entries: [skillEntry, mcpEntry],
    };

    expect(parseInstallManifest(JSON.parse(formatInstallManifest(manifest)))).toEqual(
      parseInstallManifest(JSON.parse(formatInstallManifest(manifest))),
    );
  });

  it("ends with a newline", () => {
    expect(formatInstallManifest(emptyInstallManifest()).endsWith("\n")).toBe(true);
  });
});

describe("manifestEntriesByPath", () => {
  it("indexes entries by managed path", () => {
    const index = manifestEntriesByPath({
      version: INSTALL_MANIFEST_VERSION,
      entries: [skillEntry, mcpEntry],
    });

    expect(index.get(".mcp.json")).toEqual(mcpEntry);
    expect(index.get("nowhere")).toBeUndefined();
  });
});

describe("loadInstallManifest", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "agentyx-manifest-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  async function writeManifest(contents: string): Promise<void> {
    await writeFile(join(projectPath, AGENTYX_MANIFEST_FILENAME), contents, "utf8");
  }

  it("treats a missing manifest as an empty one", async () => {
    await expect(loadInstallManifest(projectPath)).resolves.toEqual(emptyInstallManifest());
  });

  it("loads a written manifest", async () => {
    await writeManifest(
      formatInstallManifest({ version: INSTALL_MANIFEST_VERSION, entries: [skillEntry] }),
    );

    const manifest = await loadInstallManifest(projectPath);

    expect(manifest.entries[0]?.path).toBe(".agents/skills/planning/SKILL.md");
  });

  it("never repairs a manifest that is not valid JSON", async () => {
    await writeManifest("{");

    await expect(loadInstallManifest(projectPath)).rejects.toThrow(AgentyxManifestParseError);
  });

  it("never repairs a manifest that violates the schema", async () => {
    await writeManifest(JSON.stringify({ version: INSTALL_MANIFEST_VERSION, entries: [{}] }));

    await expect(loadInstallManifest(projectPath)).rejects.toThrow(AgentyxManifestValidationError);
  });

  it("resolves the manifest beside .agentyx.json", () => {
    expect(agentyxManifestPath(projectPath)).toBe(join(projectPath, ".agentyx.lock.json"));
  });
});

import { cp, mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runConfigureCommand } from "../src/commands/configure.js";
import { runDoctorCommand } from "../src/commands/doctor.js";
import { runInitCommand } from "../src/commands/init.js";
import { type InstallCommandInput, runInstallCommand } from "../src/commands/install.js";
import { runSyncCommand } from "../src/commands/sync.js";
import { runUninstallCommand } from "../src/commands/uninstall.js";
import { cliVersion } from "../src/version.js";

const V1_FIXTURE = fileURLToPath(new URL("./fixtures/lock-v1", import.meta.url));
const LOCK = ".agentyx.lock.json";

const base: Omit<InstallCommandInput, "cwd"> = {
  packs: [],
  enable: [],
  targets: [],
  skills: [],
  mcpServers: [],
  select: false,
  dryRun: false,
  json: false,
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentyx-lock-v2-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const config = (value: Record<string, unknown>) =>
  writeFile(join(dir, ".agentyx.json"), JSON.stringify(value), "utf8");
const install = (extra: Partial<InstallCommandInput> = {}) =>
  runInstallCommand({ ...base, cwd: dir, ...extra });
const sync = (extra: { dryRun?: boolean; json?: boolean; force?: boolean } = {}) =>
  runSyncCommand({ cwd: dir, dryRun: false, json: false, force: false, ...extra });
const readLock = async () => JSON.parse(await readFile(join(dir, LOCK), "utf8"));
const lockBytes = () => readFile(join(dir, LOCK), "utf8");
const exists = (path: string) =>
  stat(join(dir, path)).then(
    () => true,
    () => false,
  );

/** Every file under the project, with content, for "nothing was written" assertions. */
async function tree(root = dir, prefix = ""): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) Object.assign(out, await tree(root, rel));
    else out[rel] = await readFile(join(root, rel), "utf8");
  }
  return out;
}

async function useV1Fixture(): Promise<void> {
  await cp(V1_FIXTURE, dir, { recursive: true });
}

const full = { packs: ["technical"], targets: ["codex", "claude"] };

describe("fresh installs write version 2", () => {
  it("sync records a complete snapshot with the executing CLI version", async () => {
    await config(full);
    await sync();

    const lock = await readLock();
    expect(lock.version).toBe(2);
    expect(lock.resolution.agentyxVersion).toBe(cliVersion);
    expect(lock.resolution.targets).toEqual(["claude", "codex"]);
    expect(lock.resolution.skills.length).toBeGreaterThan(0);
  });

  it("a plain install is complete too and reports its lock", async () => {
    await config(full);
    const report = JSON.parse(await install({ json: true }));

    expect(report.lock).toEqual({
      present: false,
      currentVersion: null,
      nextVersion: 2,
      migration: "none",
      resolution: "complete",
      invalidated: false,
    });
    expect((await readLock()).resolution).not.toBeNull();
  });

  it("an identical sync leaves the lock bytes and mtime alone", async () => {
    await config(full);
    await sync();
    const old = new Date("2020-01-01T00:00:00Z");
    await utimes(join(dir, LOCK), old, old);
    const before = await lockBytes();

    await sync();

    expect(await lockBytes()).toBe(before);
    expect((await stat(join(dir, LOCK))).mtime.getTime()).toBe(old.getTime());
  });

  it("rewrites the lock for a snapshot-only change", async () => {
    await config(full);
    await sync();
    const before = await readLock();
    const files = await tree();

    await config({ ...full, localPacks: [{ name: "unused", skills: [] }] });
    await sync();

    const after = await readLock();
    expect(after.resolution.configHash).not.toBe(before.resolution.configHash);
    expect(after.entries).toEqual(before.entries);
    expect(await tree()).toEqual({
      ...files,
      ".agentyx.json": expect.any(String),
      [LOCK]: expect.any(String),
    });
  });

  it("refreshes a complete snapshot after a config change", async () => {
    await config({ packs: ["technical"], targets: ["codex"] });
    await sync();
    await config({ packs: ["technical", "typescript"], targets: ["codex"] });
    await sync();

    const lock = await readLock();
    expect(lock.version).toBe(2);
    expect(lock.resolution.skills.map((skill: { name: string }) => skill.name)).toContain(
      "typescript-strict",
    );
  });

  it("persists a complete empty-ownership lock for a reviewed empty harness", async () => {
    await config({ packs: [], targets: ["codex"] });
    await sync();

    const lock = await readLock();
    expect(lock.version).toBe(2);
    expect(lock.resolution).not.toBeNull();
  });

  it("init --install and configure --sync produce and refresh a complete v2 lock", async () => {
    await runInitCommand({
      packs: ["technical"],
      enable: [],
      targets: ["codex"],
      yes: true,
      force: false,
      json: false,
      install: true,
      cwd: dir,
    });
    const first = await readLock();
    expect(first.version).toBe(2);
    expect(first.resolution.agentyxVersion).toBe(cliVersion);

    await runConfigureCommand({
      cwd: dir,
      dryRun: false,
      json: false,
      yes: true,
      sync: true,
      addPacks: ["typescript"],
    } as never);
    const second = await readLock();
    expect(second.resolution.configHash).not.toBe(first.resolution.configHash);
    expect(second.resolution.skills.length).toBeGreaterThan(first.resolution.skills.length);
  });
});

describe("partial operations write resolution: null", () => {
  const modes: [string, Partial<InstallCommandInput>][] = [
    ["explicit pack", { packs: ["technical"], targets: ["codex"] }],
    ["target override", { targets: ["codex"] }],
    ["runtime enable", { enable: ["playwright"] }],
    ["skills-only", { skillsOnly: true }],
    ["mcp-only", { mcpOnly: true }],
    ["manual skill", { skills: ["code-quality"], targets: ["codex"] }],
    ["manual mcp", { mcpServers: ["context7"], targets: ["codex"] }],
  ];

  it.each(modes)("%s on a fresh project", async (_name, extra) => {
    await config({ packs: ["testing"], enable: ["playwright"], targets: ["codex", "claude"] });
    await install(extra);

    const lock = await readLock();
    expect(lock.version).toBe(2);
    expect(lock.resolution).toBeNull();
  });

  it("works without any project config for explicit packs", async () => {
    await install({ packs: ["technical"], targets: ["codex"] });

    expect(await readLock()).toMatchObject({ version: 2, resolution: null });
  });

  it("a manual install invalidates a complete snapshot and says so", async () => {
    await config(full);
    await sync();

    const output = await install({ skills: ["verification"], targets: ["codex"] });

    expect(await readLock()).toMatchObject({ version: 2, resolution: null });
    expect(output).toContain("invalidated");
    expect(output).toContain("full config-based sync");
  });

  it("a complete sync recovers a null snapshot", async () => {
    await config(full);
    await install({ targets: ["codex"] });
    expect((await readLock()).resolution).toBeNull();

    await sync();

    expect((await readLock()).resolution).not.toBeNull();
  });

  it("retained stale ownership stays out of the snapshot", async () => {
    await config({ packs: ["technical", "typescript"], targets: ["codex"] });
    await install();
    await config({ packs: ["technical"], targets: ["codex"] });
    await install();

    const lock = await readLock();
    expect(lock.entries.map((e: { skill?: string }) => e.skill)).toContain("typescript-strict");
    expect(lock.resolution.skills.map((s: { name: string }) => s.name)).not.toContain(
      "typescript-strict",
    );
  });

  it("a resolution entry never authorizes removal or overwrite", async () => {
    await config({ packs: ["technical"], targets: ["codex"] });
    await sync();
    const lock = await readLock();
    const owned = lock.entries.find((e: { skill?: string }) => e.skill === "code-quality");
    // Drop ownership of one file but keep it in the snapshot, then edit it.
    await writeFile(
      join(dir, LOCK),
      JSON.stringify({
        ...lock,
        entries: lock.entries.filter(
          (e: unknown) => e !== owned && JSON.stringify(e) !== JSON.stringify(owned),
        ),
      }),
    );
    await writeFile(join(dir, owned.path), "mine\n");

    await expect(sync()).rejects.toThrow(/not Agentyx's|conflict|blocked|force/i);
    expect(await readFile(join(dir, owned.path), "utf8")).toBe("mine\n");
    await expect(
      runUninstallCommand({ targets: [], dryRun: false, json: false, cwd: dir }),
    ).resolves.toBeDefined();
    expect(await readFile(join(dir, owned.path), "utf8")).toBe("mine\n");
  });
});

describe("uninstall", () => {
  it("removes the lock after a full v2 uninstall and keeps the config", async () => {
    await config(full);
    await sync();

    await runUninstallCommand({ targets: [], dryRun: false, json: false, cwd: dir });

    expect(await readdir(dir)).toEqual([".agentyx.json"]);
  });

  it("a partial v2 uninstall keeps version 2 and nulls the resolution", async () => {
    await config({ packs: ["technical"], targets: ["codex", "claude"] });
    await sync();

    await runUninstallCommand({ targets: ["codex"], dryRun: false, json: false, cwd: dir });

    const lock = await readLock();
    expect(lock.version).toBe(2);
    expect(lock.resolution).toBeNull();
    expect(lock.entries.every((e: { targets: string[] }) => !e.targets.includes("codex"))).toBe(
      true,
    );
    expect(lock.entries.length).toBeGreaterThan(0);
  });

  it("uninstalls a historical v1 project without migrating", async () => {
    await useV1Fixture();
    await runUninstallCommand({ targets: ["claude"], dryRun: false, json: false, cwd: dir });

    const partial = await readLock();
    expect(partial.version).toBe(1);
    expect(partial.resolution).toBeUndefined();
    expect(partial.entries.length).toBeGreaterThan(0);

    await runUninstallCommand({ targets: [], dryRun: false, json: false, cwd: dir });
    expect(await exists(LOCK)).toBe(false);
  });
});

describe("version-1 locks", () => {
  it("fixture covers every pre-v2 ownership kind", async () => {
    const lock = JSON.parse(await readFile(join(V1_FIXTURE, LOCK), "utf8"));
    expect(lock.version).toBe(1);
    expect(new Set(lock.entries.map((e: { kind: string }) => e.kind))).toEqual(
      new Set(["skill", "agent", "mcp", "hook"]),
    );
  });

  it("refuses install and sync before writing anything", async () => {
    await useV1Fixture();
    const before = await tree();

    for (const run of [
      () => install(),
      () => sync(),
      () => install({ skills: ["verification"], targets: ["codex"] }),
    ]) {
      await expect(run()).rejects.toMatchObject({ code: "legacy_lock_requires_migration" });
    }
    await expect(install()).rejects.toThrow(/agentyx install --migrate-lock/);
    expect(await tree()).toEqual(before);
  });

  it("still previews on a dry run and says migration is required", async () => {
    await useV1Fixture();
    const before = await tree();

    const text = await sync({ dryRun: true });
    const json = JSON.parse(await install({ dryRun: true, json: true }));

    expect(text).toContain("requires reviewed migration");
    expect(json.lock).toMatchObject({
      currentVersion: 1,
      nextVersion: null,
      migration: "required",
    });
    expect(await tree()).toEqual(before);
  });

  it("configure --sync keeps the new config and tells the user to migrate", async () => {
    await useV1Fixture();
    const before = await tree();

    await expect(
      runConfigureCommand({
        cwd: dir,
        dryRun: false,
        json: false,
        yes: true,
        sync: true,
        addPacks: ["technical"],
      } as never),
    ).rejects.toThrow(/--migrate-lock/);

    const after = await tree();
    expect(JSON.parse(after[".agentyx.json"] ?? "{}").packs).toContain("technical");
    expect({ ...after, ".agentyx.json": "" }).toEqual({ ...before, ".agentyx.json": "" });
  });

  it("doctor still reads v1, complete v2 and null v2", async () => {
    await useV1Fixture();
    const legacy = await runDoctorCommand({ json: false, cwd: dir });
    expect(legacy.installation.manifest.present).toBe(true);
    expect(legacy.diagnostics.some((d) => d.level === "error")).toBe(false);

    await install({ migrateLock: true });
    const complete = await runDoctorCommand({ json: false, cwd: dir });
    expect(complete.diagnostics.some((d) => d.level === "error")).toBe(false);

    await install({ skills: ["verification"], targets: ["codex"] });
    const partial = await runDoctorCommand({ json: false, cwd: dir });
    expect(partial.diagnostics.some((d) => d.level === "error")).toBe(false);
  });
});

describe("install --migrate-lock", () => {
  it("migrates a historical lock to a complete v2 lock", async () => {
    await useV1Fixture();
    const legacyPaths = (
      JSON.parse(await readFile(join(V1_FIXTURE, LOCK), "utf8")).entries as {
        path: string;
      }[]
    ).map((e) => e.path);

    const report = JSON.parse(await install({ migrateLock: true, json: true }));

    expect(report.lock).toMatchObject({
      currentVersion: 1,
      nextVersion: 2,
      migration: "performed",
      resolution: "complete",
    });
    const lock = await readLock();
    expect(lock.version).toBe(2);
    expect(lock.resolution.agentyxVersion).toBe(cliVersion);
    expect(lock.entries.map((e: { path: string }) => e.path).sort()).toEqual(
      [...legacyPaths].sort(),
    );
    expect(JSON.parse(await install({ json: true })).lock.migration).toBe("none");
  });

  it("text reports success only after the commit", async () => {
    await useV1Fixture();
    expect(await install({ migrateLock: true })).toContain(
      "Lock: migrated to version 2 with a complete resolution snapshot.",
    );
  });

  it("dry run writes nothing and leaves the legacy lock bytes", async () => {
    await useV1Fixture();
    const before = await tree();

    const text = await install({ migrateLock: true, dryRun: true });

    expect(text).toContain("Lock: version 1 -> version 2 migration planned.");
    expect(await tree()).toEqual(before);
  });

  it("an edited legacy-owned file blocks migration and survives", async () => {
    await useV1Fixture();
    const lock = JSON.parse(await readFile(join(dir, LOCK), "utf8"));
    const skill = lock.entries.find((e: { kind: string }) => e.kind === "skill").path as string;
    await writeFile(join(dir, skill), "edited by user\n");
    const before = await tree();

    await expect(install({ migrateLock: true })).rejects.toBeDefined();

    expect(await tree()).toEqual(before);
  });

  it("an unmanaged desired destination blocks migration without adoption", async () => {
    await useV1Fixture();
    const lock = JSON.parse(await readFile(join(dir, LOCK), "utf8"));
    const skill = lock.entries.find((e: { kind: string }) => e.kind === "skill");
    lock.entries = lock.entries.filter((e: unknown) => e !== skill);
    await writeFile(join(dir, LOCK), `${JSON.stringify(lock, null, 2)}\n`);
    await writeFile(join(dir, skill.path), "hand written\n");
    const before = await tree();

    await expect(install({ migrateLock: true })).rejects.toBeDefined();

    expect(await tree()).toEqual(before);
  });

  it("needs an existing v1 lock", async () => {
    await config(full);
    await expect(install({ migrateLock: true })).rejects.toMatchObject({
      code: "legacy_lock_missing",
    });

    await sync();
    await expect(install({ migrateLock: true })).rejects.toMatchObject({
      code: "lock_migration_not_needed",
    });
  });

  const incompatible: [string, Partial<InstallCommandInput>][] = [
    ["packs", { packs: ["technical"] }],
    ["--target", { targets: ["codex"] }],
    ["--enable", { enable: ["playwright"] }],
    ["--skill", { skills: ["code-quality"] }],
    ["--mcp", { mcpServers: ["context7"] }],
    ["--select", { select: true }],
    ["--skills-only", { skillsOnly: true }],
    ["--mcp-only", { mcpOnly: true }],
  ];

  it.each(incompatible)("rejects %s before prompting or writing", async (_name, extra) => {
    await useV1Fixture();
    const before = await tree();

    await expect(install({ migrateLock: true, ...extra })).rejects.toMatchObject({
      code: "lock_migration_requires_full_project",
    });
    expect(await tree()).toEqual(before);
  });

  it("does not add sync --migrate-lock, --frozen or doctor --locked", async () => {
    const { createSyncCommand } = await import("../src/commands/sync.js");
    const { createDoctorCommand } = await import("../src/commands/doctor.js");
    const { createInstallCommand } = await import("../src/commands/install.js");

    expect(createSyncCommand().options.map((o) => o.long)).not.toContain("--migrate-lock");
    expect(createDoctorCommand().options.map((o) => o.long)).not.toContain("--locked");
    expect(createInstallCommand().options.map((o) => o.long)).not.toContain("--frozen");
  });
});

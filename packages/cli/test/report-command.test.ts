import { chmod, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runReportCommand } from "../src/commands/report.js";
import { createAgentyxProgram } from "../src/index.js";
import { cleanupProjects, fullConfig, reportProject, sync, tree } from "./report-helpers.js";

afterEach(cleanupProjects);

describe("report command", () => {
  it("is registered with --output and --overwrite", () => {
    const command = createAgentyxProgram().commands.find((item) => item.name() === "report");

    expect(command?.options.map((option) => option.long)).toEqual(["--output", "--overwrite"]);
  });

  it("writes agentyx-report.html by default and nothing else", async () => {
    const cwd = await reportProject(fullConfig);
    await sync(cwd);
    const before = await tree(cwd);

    expect(await runReportCommand({ cwd })).toBe("Wrote agentyx-report.html");

    const after = await tree(cwd);
    const { "agentyx-report.html": report, ...rest } = after;
    expect(report).toMatch(/^<!doctype html>/);
    expect(rest).toEqual(before);
  });

  it("refuses to replace an existing report unless --overwrite is given", async () => {
    const cwd = await reportProject(fullConfig);
    await sync(cwd);
    await runReportCommand({ cwd });
    const first = await readFile(join(cwd, "agentyx-report.html"), "utf8");
    await writeFile(join(cwd, "agentyx-report.html"), "keep me");

    await expect(runReportCommand({ cwd })).rejects.toMatchObject({ code: "report_output_exists" });
    expect(await readFile(join(cwd, "agentyx-report.html"), "utf8")).toBe("keep me");

    await runReportCommand({ cwd, overwrite: true });
    expect(await readFile(join(cwd, "agentyx-report.html"), "utf8")).toBe(first);
    await runReportCommand({ cwd, overwrite: true });
    expect(await readFile(join(cwd, "agentyx-report.html"), "utf8")).toBe(first);
    expect((await readdir(cwd)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("writes to a project-relative path in an existing directory", async () => {
    const cwd = await reportProject(fullConfig);
    await mkdir(join(cwd, "reports"));

    await runReportCommand({ cwd, output: "reports/harness.html" });
    expect(await readFile(join(cwd, "reports", "harness.html"), "utf8")).toContain("Report Web");
  });

  it("rejects unsafe paths with stable errors", async () => {
    const cwd = await reportProject(fullConfig);
    const outside = await mkdtemp(join(tmpdir(), "agentyx-report-outside-"));
    await symlink(outside, join(cwd, "linked"));
    await symlink(join(outside, "target.html"), join(cwd, "dangling.html"));
    await writeFile(join(outside, "target.html"), "outside");

    const reject = (output: string, overwrite = true) =>
      expect(runReportCommand({ cwd, output, overwrite })).rejects.toMatchObject({
        code: "report_output_path_invalid",
      });

    await reject("../escape.html");
    await reject(join(cwd, "absolute.html"));
    await reject("linked/report.html");
    await reject("missing-dir/report.html");
    await reject("dangling.html");
    await reject(".agentyx.json");
    await reject("report.txt");
    await reject("");
    expect(await readFile(join(outside, "target.html"), "utf8")).toBe("outside");
    expect(await readdir(outside)).toEqual(["target.html"]);
    await rm(outside, { recursive: true, force: true });
  });

  it.skipIf(process.platform === "win32")("wraps write failures in a domain error", async () => {
    const cwd = await reportProject(fullConfig);
    await mkdir(join(cwd, "ro"));
    await chmod(join(cwd, "ro"), 0o500);

    try {
      await expect(runReportCommand({ cwd, output: "ro/report.html" })).rejects.toMatchObject({
        code: "report_write_failed",
      });
    } finally {
      await chmod(join(cwd, "ro"), 0o700);
    }
  });

  it("does not write a partial report for a missing or invalid configuration", async () => {
    const empty = await mkdtemp(join(tmpdir(), "agentyx-report-empty-"));
    await expect(runReportCommand({ cwd: empty })).rejects.toThrow(/\.agentyx\.json/);
    expect(await readdir(empty)).toEqual([]);
    await rm(empty, { recursive: true, force: true });

    const invalid = await reportProject({ packs: 7 });
    await expect(runReportCommand({ cwd: invalid })).rejects.toThrow();
    expect(await readdir(invalid)).toEqual([".agentyx.json"]);
  });
});

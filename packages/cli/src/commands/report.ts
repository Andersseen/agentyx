import { Command } from "commander";
import { emit } from "../output.js";
import { buildReportModel } from "../report/model.js";
import { DEFAULT_REPORT_PATH, writeReportFile } from "../report/output.js";
import { renderReportHtml } from "../report/render.js";

export interface ReportCommandInput {
  readonly cwd: string;
  readonly output?: string;
  readonly overwrite?: boolean;
}

export async function runReportCommand(input: ReportCommandInput): Promise<string> {
  const output = input.output ?? DEFAULT_REPORT_PATH;
  const html = renderReportHtml(await buildReportModel(input.cwd));

  await writeReportFile({ cwd: input.cwd, output, html, overwrite: input.overwrite === true });

  return `Wrote ${output}`;
}

export function createReportCommand(): Command {
  return new Command("report")
    .description("Write a self-contained HTML report of this project's Agentyx harness.")
    .option("--output <path>", "project-relative .html file to write", DEFAULT_REPORT_PATH)
    .option("--overwrite", "replace the report file if it already exists", false)
    .action(async (options: { output: string; overwrite: boolean }) => {
      await emit(() =>
        runReportCommand({
          cwd: process.cwd(),
          output: options.output,
          overwrite: options.overwrite,
        }),
      );
    });
}

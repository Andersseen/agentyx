import type { ReportModel } from "./model.js";
import { render } from "./report-renderer.generated.js";
import { createReportView } from "./view.js";

/** Renders the single self-contained report document. Pure: the same model gives the same bytes. */
export function renderReportHtml(model: ReportModel): string {
  return render(createReportView(model));
}

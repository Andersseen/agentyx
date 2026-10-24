import { provideContent, withMarkdownRenderer } from "@analogjs/content";
import type { Routes } from "@angular/router";
import { doqRoutes, provideDoq } from "@doqs/analog";
import { doqConfig } from "./doq.config";

/**
 * The documentation region. Everything that needs Doqs or Analog's Markdown renderer lives here, in
 * a chunk the browser downloads only when a documentation URL is opened (see app.config.ts); the
 * providers belong to this route, not to the whole application.
 */
export const docsRoutes: Routes = [
  {
    path: "",
    providers: [provideContent(withMarkdownRenderer()), provideDoq(doqConfig)],
    children: doqRoutes(doqConfig),
  },
];

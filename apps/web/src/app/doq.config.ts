import { defineDoqConfig } from "@doqs/analog";
import { doqPaths } from "../doq.paths";

/**
 * The Agentyx documentation region.
 *
 * Doqs renders its own `main` landmark here: the site shell deliberately renders none, and each
 * marketing page brings its own, so every route ends up with exactly one.
 *
 * `unmatched` stays at its `'not-found'` default on purpose. The `'continue'` mode exists to
 * migrate host-owned pages below the same prefix one at a time, and it hands the bare base path
 * back to the host — Agentyx has no host page at `/docs`, so that mode would leave the
 * documentation index rendering nothing.
 */
export const doqConfig = defineDoqConfig({
  ...doqPaths,
  contentWidth: "46rem",
  presentation: {
    documentationLabel: "Agentyx documentation",
    indexTitle: "Agentyx documentation",
    indexDescription:
      "Install Agentyx, describe your project once in .agentyx.json, and converge every coding agent onto the same Skills, MCP servers and hooks.",
    pageTitleSuffix: "Agentyx",
  },
});

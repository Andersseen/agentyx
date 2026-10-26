import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { EXAMPLE_COMPOSITION, PACK_COUNT, SKILL_COUNT } from "../data/site.js";

/**
 * Closing beat and the page's one inverted, full-bleed moment: composition is the user's job, and
 * this is what one real composition looks like. The full catalogue lives on /packs.
 */
@Component({
  selector: "app-compose",
  imports: [RouterLink],
  template: `
    <section id="compose" class="bg-foreground text-background">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:py-24">
        <div class="lg:col-span-6">
          <h2 class="display-2">Packs compose. You choose the mix.</h2>
          <p class="lede mt-5 max-w-xl opacity-80">
            {{ packCount }} built-in packs carry {{ skillCount }} Skills, with no inheritance and no
            hidden dependencies. A polished product site, for example, pairs the
            <code class="mono">creative-web</code> and <code class="mono">ui-ux</code> design packs
            with the accessibility pack.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a
              routerLink="/packs"
              class="btn-inverse"
              >Browse the packs</a
            >
            <a
              routerLink="/docs/reference/packs"
              class="inline-flex items-center px-3 py-2 text-sm font-semibold underline underline-offset-4"
              >Pack reference</a
            >
          </div>
        </div>
        <div class="min-w-0 lg:col-span-6">
          <p class="mono mb-2 text-sm opacity-80">.agentyx.json</p>
          <pre tabindex="0"
            class="mono overflow-x-auto border border-current/40 p-5 text-sm leading-7"
          ><code>{{ config }}</code></pre>
          <p class="mono mt-3 text-xs opacity-80">
            → {{ composition.skills }} Skills, {{ composition.mcpServers }} MCP servers. Playwright is
            optional.
          </p>
        </div>
      </div>
    </section>
  `,
})
export class ComposeComponent {
  readonly composition = EXAMPLE_COMPOSITION;
  readonly packCount = PACK_COUNT;
  readonly skillCount = SKILL_COUNT;
  readonly config = `{
  "packs": [
    ${EXAMPLE_COMPOSITION.packs.map((pack) => `"${pack}"`).join(",\n    ")}
  ],
  "enable": ["playwright"]
}`;
}

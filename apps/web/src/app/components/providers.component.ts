import { Component, input } from "@angular/core";
import {
  CAPABILITY_ROWS,
  OBSERVABILITY_ROWS,
  PROVIDERS,
  type Provider,
} from "../data/providers.js";

/**
 * The provider compatibility matrix.
 *
 * Rendered from `data/providers.ts`, which mirrors `docs/compatibility.md`, so the site cannot drift
 * into claiming a destination or a signal Agentyx does not actually install or observe.
 */
@Component({
  selector: "app-providers",
  template: `
    <div class="grid min-w-0 gap-10">
      <section aria-labelledby="destinations-heading" class="min-w-0">
        <h3
          id="destinations-heading"
          class="text-xl font-semibold tracking-tight text-foreground"
        >
          Where Agentyx installs
        </h3>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Every path is relative to your project root. Agentyx writes nothing else, and never
          <code class="text-foreground">$HOME</code>.
        </p>
        <!-- relative positions the sr-only caption's containing block here, so the scroll
             container clips it instead of letting it widen the document. -->
        <div
          class="relative mt-5 w-full max-w-full overflow-x-auto border border-wire"
        >
          <table class="w-full min-w-[46rem] border-collapse text-sm">
            <caption class="sr-only">
              Installation destinations per provider: Skills, agents, MCP configuration and hooks.
            </caption>
            <thead>
              <tr class="border-b border-border bg-surface text-left">
                <th scope="col" class="px-4 py-3 font-semibold text-foreground">Capability</th>
                @for (provider of providers; track provider.id) {
                  <th scope="col" class="px-4 py-3 font-semibold text-foreground">
                    {{ provider.name }}
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of capabilityRows; track row.key) {
                <tr class="border-b border-border last:border-0 odd:bg-background/40">
                  <th scope="row" class="px-4 py-3 text-left font-medium text-foreground">
                    {{ row.label }}
                  </th>
                  @for (provider of providers; track provider.id) {
                    <td class="px-4 py-3 align-top">
                      @if (destination(provider, row.key); as path) {
                        <code class="text-xs text-foreground">{{ path }}</code>
                        @if (provider.sharedSettings && row.key === "hooks") {
                          <span class="mt-1 block text-xs text-muted-foreground">
                            shared with MCP
                          </span>
                        }
                      } @else {
                        <span class="text-xs text-muted-foreground">
                          {{ provider.hooksNote ?? "not installed" }}
                        </span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="observability-heading" class="min-w-0">
        <h3
          id="observability-heading"
          class="text-xl font-semibold tracking-tight text-foreground"
        >
          What doctor can observe
        </h3>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          A capability a provider cannot reliably show is <strong>unobservable</strong>, never
          dormant. Absence of evidence is never reported as evidence of absence.
        </p>
        <div
          class="relative mt-5 w-full max-w-full overflow-x-auto border border-wire"
        >
          <table class="w-full min-w-[46rem] border-collapse text-sm">
            <caption class="sr-only">Runtime observation signals available per provider.</caption>
            <thead>
              <tr class="border-b border-border bg-surface text-left">
                <th scope="col" class="px-4 py-3 font-semibold text-foreground">Signal</th>
                @for (provider of providers; track provider.id) {
                  <th scope="col" class="px-4 py-3 font-semibold text-foreground">
                    {{ provider.name }}
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of observabilityRows; track row.key) {
                <tr class="border-b border-border last:border-0 odd:bg-background/40">
                  <th scope="row" class="px-4 py-3 text-left font-medium text-foreground">
                    {{ row.label }}
                  </th>
                  @for (provider of providers; track provider.id) {
                    <td class="px-4 py-3">
                      @if (provider.observability[row.key]) {
                        <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                          <span aria-hidden="true">✓</span> yes
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span aria-hidden="true">—</span> unobservable
                        </span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      @if (showNotes()) {
        <section aria-labelledby="provider-notes-heading" class="min-w-0">
          <h3
            id="provider-notes-heading"
            class="text-xl font-semibold tracking-tight text-foreground"
          >
            Limits, stated plainly
          </h3>
          <dl class="mt-5 grid gap-x-10 gap-y-6 md:grid-cols-2">
            @for (provider of providers; track provider.id) {
              @if (provider.notes) {
                <div class="border-l-2 border-wire pl-5">
                  <dt class="flex flex-wrap items-baseline gap-x-3 font-semibold text-foreground">
                    {{ provider.name }}
                    <span class="mono text-xs font-normal text-muted-foreground">{{ provider.id }}</span>
                    @if (provider.sharedSettings) {
                      <span class="mono text-xs font-normal text-muted-foreground"
                        >one settings document</span
                      >
                    }
                  </dt>
                  <dd class="mt-2 text-sm leading-6 text-muted-foreground">{{ provider.notes }}</dd>
                </div>
              }
            }
          </dl>
        </section>
      }
    </div>
  `,
})
export class ProvidersComponent {
  readonly providers = PROVIDERS;
  readonly capabilityRows = CAPABILITY_ROWS;
  readonly observabilityRows = OBSERVABILITY_ROWS;
  /** The per-provider limit notes; off in the landing teaser, on in the full page. */
  readonly showNotes = input(true);

  destination(provider: Provider, key: string): string | undefined {
    if (key === "hooks") {
      return provider.hooks ?? undefined;
    }
    return provider[key as "skills" | "agents" | "mcp"];
  }
}

import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { VoltNativeButton } from "@voltui/components";
import { LmnArrowRightIcon } from "lumen-icons/arrow-right";
import { LmnGithubIcon } from "lumen-icons/github";
import { PROVIDERS } from "../data/providers.js";
import { EXAMPLE_COMPOSITION, MCP_SERVER_COUNT, PACK_COUNT, SKILL_COUNT } from "../data/site.js";

/**
 * The first screen shows the product's actual model instead of describing it: one definition is
 * resolved, then routed to each provider's own destination. Every label is a real path or count
 * (`data/providers.ts`, `data/site.ts`). The wires draw once, in causal order; with reduced motion
 * the finished diagram is simply there.
 */
@Component({
  selector: "app-hero",
  imports: [RouterLink, VoltNativeButton, LmnArrowRightIcon, LmnGithubIcon],
  styles: `
    :host {
      --row: 4.25rem;
      --cap: 1.75rem;
      --gap: 0.75rem;
      --bus: 2.75rem;
    }

    .board {
      display: grid;
      gap: 0;
      grid-template-columns: minmax(0, 1fr);
    }

    .col {
      display: flex;
      min-width: 0;
      flex-direction: column;
    }

    .cap {
      height: var(--cap);
      margin: 0;
      line-height: 1.25rem;
    }

    .slot {
      display: flex;
      flex: 1;
      align-items: stretch;
    }

    .slot > * {
      display: grid;
      width: 100%;
      align-content: center;
    }

    @media (min-width: 64rem) {
      .board {
        grid-template-columns: minmax(0, 1.2fr) 2.5rem minmax(0, 0.8fr) 2.5rem minmax(0, 1.1fr);
      }
    }

    .trunk {
      position: relative;
      justify-self: center;
      width: 2px;
      height: 2rem;
      background: var(--wire);
      transform-origin: top;
      animation: draw-y 0.45s ease-out backwards;
    }

    @media (min-width: 64rem) {
      .trunk {
        width: auto;
        height: 2px;
        margin-top: var(--cap);
        align-self: center;
        justify-self: stretch;
        transform-origin: left;
        animation-name: draw-x;
      }
    }

    .trunk--a {
      animation-delay: 0.15s;
    }

    .trunk--b {
      animation-delay: 0.85s;
    }

    .resolver {
      animation: lock 0.5s ease-out 0.6s backwards;
      border-left: 3px solid var(--primary);
    }

    .ports {
      position: relative;
      display: grid;
      gap: var(--gap);
      padding-left: var(--bus);
      margin: 0;
      list-style: none;
    }

    .ports::before {
      content: "";
      position: absolute;
      left: 0;
      top: calc(var(--row) / 2);
      bottom: calc(var(--row) / 2);
      width: 2px;
      background: var(--wire);
      transform-origin: top;
      animation: draw-y 0.45s ease-out 1.1s backwards;
    }

    .port {
      position: relative;
      display: grid;
      align-content: center;
      min-height: var(--row);
      padding: 0.5rem 0.875rem;
      border: 1px solid var(--wire);
      background: var(--background);
    }

    .port::before {
      content: "";
      position: absolute;
      left: calc(var(--bus) * -1);
      top: 50%;
      width: var(--bus);
      height: 2px;
      background: var(--wire);
      transform-origin: left;
      animation: draw-x 0.3s ease-out backwards;
      animation-delay: calc(1.5s + var(--i) * 0.14s);
    }

    .port-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: var(--success);
      animation: arrive 0.4s ease-out backwards;
      animation-delay: calc(1.75s + var(--i) * 0.14s);
    }

    .port-path {
      animation: arrive-text 0.4s ease-out backwards;
      animation-delay: calc(1.75s + var(--i) * 0.14s);
    }

    .ledger {
      animation: arrive-text 0.6s ease-out 2.5s backwards;
    }

    @keyframes draw-x {
      from {
        transform: scaleX(0);
      }
    }

    @keyframes draw-y {
      from {
        transform: scaleY(0);
      }
    }

    @keyframes lock {
      from {
        border-left-color: var(--wire);
      }
    }

    @keyframes arrive {
      from {
        background: var(--wire);
      }
    }

    @keyframes arrive-text {
      from {
        opacity: 0.25;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .trunk,
      .resolver,
      .ports::before,
      .port::before,
      .port-dot,
      .port-path,
      .ledger {
        animation: none;
      }
    }
  `,
  template: `
    <section id="hero" class="border-b border-border pb-14 pt-8 lg:pb-16 lg:pt-10">
      <div class="mx-auto max-w-7xl px-4 sm:px-6">
        <div class="grid items-end gap-6 lg:grid-cols-12 lg:gap-12">
          <div class="lg:col-span-8">
            <h1 class="display">
              One definition,<br />
              wired into <span class="text-primary">every agent.</span>
            </h1>
            <div class="mt-6 flex flex-wrap gap-3">
              <a voltButton routerLink="/" fragment="workflow" size="lg">
                See how it works <lmn-arrow-right class="h-4 w-4" aria-hidden="true" />
              </a>
              <a voltButton variant="outline" size="lg" routerLink="/docs">Read the docs</a>
              <a
                voltButton
                variant="ghost"
                size="lg"
                href="https://github.com/Andersseen/agentyx"
                target="_blank"
                rel="noopener noreferrer"
              >
                <lmn-github class="h-4 w-4" aria-hidden="true" /> GitHub
              </a>
            </div>
          </div>
          <p class="lede text-muted-foreground lg:col-span-4 lg:pb-2">
            Agentyx resolves the packs a project chooses into Skills, MCP servers and hooks, then
            installs them where Codex, Claude Code, Kimi Code and Qwen Code each expect them. Local
            to the project, recorded in a lockfile, reversible.
          </p>
        </div>

        <figure class="sheet mt-8 p-4 sm:p-6 lg:mt-10 lg:p-7" aria-labelledby="board-caption">
          <div class="board">
            <div class="col">
              <p class="caption cap">project definition</p>
              <div class="slot"><div class="border border-wire bg-background p-4">
                <p class="mono text-sm font-semibold text-foreground">.agentyx.json</p>
                <pre tabindex="0"
                  class="mono mt-3 overflow-x-auto text-[0.8125rem] leading-6 text-foreground"
                ><code>{{ config }}</code></pre>
              </div></div>
            </div>

            <span class="trunk trunk--a" aria-hidden="true"></span>

            <div class="col">
              <p class="caption cap">agentyx resolve</p>
              <div class="slot"><div class="resolver bg-background p-4">
                <p class="mono text-sm font-semibold text-foreground">
                  {{ composition.packs.length }} packs → {{ composition.skills }} Skills
                </p>
                <p class="mono mt-1 text-[0.8125rem] text-muted-foreground">
                  + {{ composition.mcpServers }} MCP servers
                </p>
                <p class="mt-3 text-sm leading-6 text-muted-foreground">
                  Plan first: <code class="mono text-foreground">install --dry-run</code> previews
                  every write.
                </p>
              </div></div>
            </div>

            <span class="trunk trunk--b" aria-hidden="true"></span>

            <div class="col">
              <p class="caption cap">native destinations</p>
              <div class="slot"><ul class="ports">
                @for (provider of providers; track provider.id; let i = $index) {
                  <li class="port" [style.--i]="i">
                    <p class="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span class="port-dot" aria-hidden="true"></span>{{ provider.name }}
                    </p>
                    <p class="port-path mono mt-0.5 break-words text-[0.8125rem] text-foreground">
                      {{ provider.skills }}
                    </p>
                    <p class="port-path mono break-words text-xs text-muted-foreground">
                      mcp {{ provider.mcp }}
                    </p>
                  </li>
                }
              </ul></div>
            </div>
          </div>

          <figcaption
            id="board-caption"
            class="ledger mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-dashed border-wire pt-4 text-sm"
          >
            <span class="text-muted-foreground">
              Every written path is recorded in
              <code class="mono text-foreground">.agentyx.lock.json</code>. Anything not recorded is
              never overwritten or deleted.
            </span>
            <span class="mono text-xs text-muted-foreground">
              {{ packCount }} packs · {{ skillCount }} Skills · {{ mcpCount }} MCP servers
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  `,
})
export class HeroComponent {
  readonly composition = EXAMPLE_COMPOSITION;
  readonly providers = PROVIDERS;
  readonly packCount = PACK_COUNT;
  readonly skillCount = SKILL_COUNT;
  readonly mcpCount = MCP_SERVER_COUNT;

  readonly config = `{
  "packs": [
    ${EXAMPLE_COMPOSITION.packs
      .map((pack) => `"${pack}"`)
      .reduce((lines, pack, index) => `${lines}${index % 3 === 0 ? ",\n    " : ", "}${pack}`)}
  ],
  "enable": ["playwright"],
  "targets": [${PROVIDERS.map((provider) => `"${provider.id}"`).join(", ")}]
}`;
}

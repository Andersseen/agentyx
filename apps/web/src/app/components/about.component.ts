import { Component } from "@angular/core";
import { WORKFLOW_STEPS } from "../data/workflow.js";

/**
 * The lifecycle as a rail: one line, four stations, each a real command. Principles that govern the
 * whole path hang beneath it as plain annotations rather than another set of cards.
 */
@Component({
  selector: "app-about",
  styles: `
    .rail {
      position: relative;
      display: grid;
      gap: 2rem;
      margin: 3rem 0 0;
      padding: 0 0 0 2rem;
      list-style: none;
    }

    .rail::before {
      content: "";
      position: absolute;
      left: 0.3125rem;
      top: 0.5rem;
      bottom: 0.5rem;
      width: 2px;
      background: var(--wire);
    }

    .station {
      position: relative;
    }

    .station::before {
      content: "";
      position: absolute;
      left: -2rem;
      top: 0.4rem;
      width: 0.75rem;
      height: 0.75rem;
      border: 2px solid var(--primary);
      background: var(--background);
    }

    @media (min-width: 64rem) {
      .rail {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1.5rem;
        margin-top: 4rem;
        padding: 2rem 0 0;
      }

      .rail::before {
        left: 0;
        right: 0;
        top: 0.3125rem;
        bottom: auto;
        width: auto;
        height: 2px;
      }

      .station::before {
        left: 0;
        top: -2rem;
      }
    }
  `,
  template: `
    <section id="workflow" class="band">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div class="grid gap-6 lg:grid-cols-12 lg:gap-12">
          <h2 class="display-2 lg:col-span-6">From a project to a setup you can review.</h2>
          <p class="lede text-muted-foreground lg:col-span-5 lg:col-start-8">
            Choices live in <code class="mono text-foreground">.agentyx.json</code>. Sync converges
            the files on disk to that desired state, and doctor reports how far reality drifted.
          </p>
        </div>

        <ol class="rail">
          @for (step of steps; track step.number) {
            <li class="station min-w-0">
              <p class="mono text-xs text-muted-foreground">{{ step.number }}</p>
              <h3 class="mt-1 text-xl font-semibold tracking-tight text-foreground">
                {{ step.title }}
              </h3>
              <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ step.description }}</p>
              <code
                class="mono mt-3 block overflow-x-auto border border-border bg-background px-3 py-2 text-xs text-foreground"
                >{{ step.command }}</code
              >
            </li>
          }
        </ol>

        <dl class="mt-14 grid gap-8 border-t border-wire pt-6 sm:grid-cols-3">
          <div>
            <dt class="font-semibold text-foreground">Plan first</dt>
            <dd class="mt-1 text-sm leading-6 text-muted-foreground">
              Preview changes with <code class="mono">install --dry-run</code> before any file is
              written.
            </dd>
          </div>
          <div>
            <dt class="font-semibold text-foreground">Owned files only</dt>
            <dd class="mt-1 text-sm leading-6 text-muted-foreground">
              The lockfile tracks managed paths. Edited or unowned destinations become conflicts.
            </dd>
          </div>
          <div>
            <dt class="font-semibold text-foreground">Project local</dt>
            <dd class="mt-1 text-sm leading-6 text-muted-foreground">
              Skills, MCP configuration and supported hooks live with the project.
            </dd>
          </div>
        </dl>
      </div>
    </section>
  `,
})
export class AboutComponent {
  readonly steps = WORKFLOW_STEPS;
}

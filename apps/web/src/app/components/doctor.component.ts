import { Component } from "@angular/core";
import { VoltProgress } from "@voltui/components";
import { MoveInViewDirective, MoveStaggerDirective } from "angular-movement";
import { DOCTOR_INSIGHTS } from "../data/doctor.js";

/**
 * Doctor as an operator readout: labelled rows of state rather than a card of cards. The figures
 * are an illustrative report and say so; "unobservable" is never presented as "unused".
 */
@Component({
  selector: "app-doctor",
  imports: [VoltProgress, MoveInViewDirective, MoveStaggerDirective],
  template: `
    <section id="doctor" class="border-b border-border">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div class="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div class="lg:col-span-5">
            <p class="caption">agentyx doctor</p>
            <h2 class="display-2 mt-3">Know what your agent setup is doing.</h2>
            <p class="lede mt-5 text-muted-foreground">
              <code class="mono text-foreground">doctor</code> checks more than whether a tool is
              installed. It compares your config with the files on disk, sizes the active harness,
              and reports usage evidence when a provider can expose it.
            </p>
            <a
              class="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4"
              href="https://github.com/Andersseen/agentyx#harness-observability"
              target="_blank"
              rel="noopener noreferrer"
              >Read how observation works <span aria-hidden="true">↗</span></a
            >
          </div>

          <div class="sheet min-w-0 self-start lg:col-span-7">
            <div class="flex items-center justify-between gap-3 border-b border-wire px-5 py-3">
              <span class="mono text-sm font-semibold">agentyx doctor</span>
              <span class="mono text-xs text-muted-foreground">Illustrative report</span>
            </div>
            <dl class="grid" moveStagger="90ms">
              <div
                class="grid gap-1 border-b border-border px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4"
                [moveInView]="{ y: [8, 0] }"
                moveDuration="320ms"
              >
                <dt class="mono text-xs uppercase text-muted-foreground">installed state</dt>
                <dd>
                  <span class="font-semibold text-success">In sync</span>
                  <span class="block text-sm text-muted-foreground"
                    >Configured files match the managed lockfile.</span
                  >
                </dd>
              </div>
              <div
                class="grid gap-1 border-b border-border px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4"
                [moveInView]="{ y: [8, 0] }"
                moveDuration="320ms"
              >
                <dt class="mono text-xs uppercase text-muted-foreground">footprint</dt>
                <dd class="mono text-sm text-foreground">5 packs · 18 Skills · 2 MCP servers</dd>
              </div>
              <div
                class="grid gap-1 border-b border-border px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4"
                [moveInView]="{ y: [8, 0] }"
                moveDuration="320ms"
              >
                <dt class="mono text-xs uppercase text-muted-foreground">observed activity</dt>
                <dd>
                  <span class="flex items-center justify-between gap-3 text-sm">
                    <span>example MCP use</span>
                    <span class="mono font-semibold">9 / 12 sessions</span>
                  </span>
                  <volt-progress
                    [value]="75"
                    aria-label="Example MCP use in 75% of observable sessions"
                    class="mt-2 block"
                  />
                  <span class="mt-2 block text-xs leading-5 text-muted-foreground"
                    >75% of sessions with sufficient evidence for this capability.</span
                  >
                </dd>
              </div>
              <div
                class="grid gap-1 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4"
                [moveInView]="{ y: [8, 0] }"
                moveDuration="320ms"
              >
                <dt class="mono text-xs uppercase text-muted-foreground">skill usage</dt>
                <dd>
                  <span class="font-semibold text-info">Unavailable for this target</span>
                  <span class="block text-sm text-muted-foreground"
                    >Doctor will not treat missing visibility as zero use.</span
                  >
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <dl class="mt-12 grid gap-6 border-t border-wire pt-6 md:grid-cols-3 md:gap-10">
              @for (item of insights; track item.title) {
                <div>
                  <dt class="font-semibold text-foreground">{{ item.title }}</dt>
                  <dd class="mt-1 text-sm leading-6 text-muted-foreground">{{ item.copy }}</dd>
                </div>
              }
            </dl>
        <p class="mt-12 max-w-3xl border-l-2 border-wire pl-5 text-sm leading-6 text-muted-foreground">
          Observation is local, metadata only and baseline aware. Older sessions do not count against
          newly enabled capabilities. Doctor offers conservative hints; it never edits your
          configuration.
        </p>
      </div>
    </section>
  `,
})
export class DoctorComponent {
  readonly insights = DOCTOR_INSIGHTS;
}

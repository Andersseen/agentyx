import { Component } from "@angular/core";
import {
  VoltAlert,
  VoltAlertDescription,
  VoltBadge,
  VoltCard,
  VoltCardContent,
  VoltCardHeader,
  VoltProgress,
  VoltSeparator,
} from "@voltui/components";
import { MoveHoverDirective, MoveInViewDirective, MoveStaggerDirective } from "angular-movement";

import { DOCTOR_INSIGHTS } from "../data/doctor.js";

@Component({
  selector: "app-doctor",
  imports: [
    VoltAlert,
    VoltAlertDescription,
    VoltBadge,
    VoltCard,
    VoltCardContent,
    VoltCardHeader,
    VoltProgress,
    VoltSeparator,
    MoveHoverDirective,
    MoveInViewDirective,
    MoveStaggerDirective,
  ],
  template: `
    <section id="doctor" class="border-b border-border bg-background">
      <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div class="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div [moveInView]="{ y: [16, 0] }" moveDuration="440ms">
            <p class="text-xs font-bold uppercase tracking-[0.15em] text-primary">02 / THE NEW DOCTOR</p>
            <h2 class="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Know what your agent setup is doing.</h2>
            <p class="mt-6 text-lg leading-8 text-muted-foreground">
              <code>doctor</code> checks more than whether a tool is installed. It compares your config
              with the files on disk, sizes the active harness, and reports usage evidence when a provider can expose it.
            </p>
            <div class="mt-8 space-y-5" moveStagger="90ms">
              @for (item of insights; track item.title) {
                <div class="flex gap-4" [moveInView]="{ y: [12, 0] }" moveDuration="340ms">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 font-mono text-xs font-bold text-primary" aria-hidden="true">{{ item.number }}</span>
                  <div><h3 class="font-semibold text-foreground">{{ item.title }}</h3><p class="mt-1 text-sm leading-6 text-muted-foreground">{{ item.copy }}</p></div>
                </div>
              }
            </div>
            <a class="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4" href="https://github.com/Andersseen/agentyx#harness-observability" target="_blank" rel="noopener noreferrer">Read how observation works <span aria-hidden="true">↗</span></a>
          </div>
          <volt-card class="block overflow-hidden border-border bg-surface shadow-2xl" [moveInView]="{ y: [18, 0], scale: [0.98, 1] }" moveDuration="460ms" [moveWhileHover]="{ y: [0, -4] }">
            <volt-card-header class="flex flex-row items-center justify-between border-b border-border px-5 py-4">
              <span class="font-mono text-sm font-semibold">agentyx doctor</span>
              <volt-badge variant="secondary">Illustrative report</volt-badge>
            </volt-card-header>
            <volt-card-content class="p-5 sm:p-7">
              <div class="grid grid-cols-3 gap-2 sm:gap-3" moveStagger="70ms">
                <volt-card class="min-w-0 bg-primary/5" [moveInView]="{ y: [10, 0] }"><volt-card-content class="flex flex-col gap-1 p-3"><strong class="text-2xl leading-none">5</strong><span class="text-xs text-muted-foreground">packs</span></volt-card-content></volt-card>
                <volt-card class="min-w-0 bg-primary/5" [moveInView]="{ y: [10, 0] }"><volt-card-content class="flex flex-col gap-1 p-3"><strong class="text-2xl leading-none">18</strong><span class="text-xs text-muted-foreground">Skills</span></volt-card-content></volt-card>
                <volt-card class="min-w-0 bg-primary/5" [moveInView]="{ y: [10, 0] }"><volt-card-content class="flex flex-col gap-1 p-3"><strong class="text-2xl leading-none">2</strong><span class="text-xs text-muted-foreground">MCP servers</span></volt-card-content></volt-card>
              </div>
              <volt-separator class="mt-6" />
              <div class="pt-5">
                <div class="flex items-center justify-between gap-3"><p class="font-semibold">Installed state</p><span class="text-xs font-semibold text-success">IN SYNC</span></div>
                <p class="mt-1 text-sm text-muted-foreground">Configured files match the managed lockfile.</p>
              </div>
              <volt-separator class="mt-5" />
              <div class="pt-5">
                <p class="font-semibold">Observed activity</p>
                <div class="mt-4 flex items-center justify-between gap-3 text-sm"><span>example MCP use</span><span class="font-mono font-semibold">9 / 12 sessions</span></div>
                <volt-progress [value]="75" aria-label="Example MCP use in 75% of observable sessions" class="mt-2 block" />
                <p class="mt-2 text-xs leading-5 text-muted-foreground">75% of sessions with sufficient evidence for this capability.</p>
              </div>
              <volt-alert variant="info" class="mt-5 text-sm leading-6">
                <volt-alert-description><strong>Skill usage unavailable for this target.</strong> Doctor will not treat missing visibility as zero use.</volt-alert-description>
              </volt-alert>
            </volt-card-content>
          </volt-card>
        </div>
        <p class="mt-10 max-w-4xl border-l-2 border-primary pl-5 text-sm leading-6 text-muted-foreground">
          Observation is local, metadata only and baseline aware. Older sessions do not count against newly enabled capabilities. Doctor offers conservative hints; it never edits your configuration.
        </p>
      </div>
    </section>
  `,
})
export class DoctorComponent {
  readonly insights = DOCTOR_INSIGHTS;
}

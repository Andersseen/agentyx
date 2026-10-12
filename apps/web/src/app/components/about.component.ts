import { Component } from "@angular/core";
import {
  VoltCard,
  VoltCardContent,
  VoltCardDescription,
  VoltCardHeader,
  VoltCardTitle,
  VoltSeparator,
} from "@voltui/components";
import { MoveHoverDirective, MoveInViewDirective, MoveStaggerDirective } from "angular-movement";

import { WORKFLOW_STEPS } from "../data/workflow.js";

@Component({
  selector: "app-about",
  imports: [
    VoltCard,
    VoltCardContent,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
    VoltSeparator,
    MoveHoverDirective,
    MoveInViewDirective,
    MoveStaggerDirective,
  ],
  template: `
    <section id="workflow" class="section-band border-b border-border">
      <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div class="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <div [moveInView]="{ y: [16, 0] }" moveDuration="440ms">
            <p class="text-xs font-bold uppercase tracking-[0.15em] text-primary">01 / HOW IT WORKS</p>
            <h2 class="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">From a project to a usable agent setup.</h2>
            <p class="mt-6 text-lg leading-8 text-muted-foreground">
              Agentyx keeps your choices in <code>.agentyx.json</code>. Packs combine project Skills,
              optional tools and MCP servers. Adapters install the result in each agent's native format.
            </p>
            <volt-card class="mt-8 block border-border bg-background" [moveWhileHover]="{ y: [0, -3] }">
              <volt-card-header class="p-5 pb-0"><volt-card-title class="text-sm">Why it exists</volt-card-title></volt-card-header>
              <volt-card-content class="p-5 pt-2"><p class="text-sm leading-6 text-muted-foreground">
                Without a shared definition, each agent drifts into a different setup. Agentyx makes the
                desired setup reviewable, repeatable and safe to update across a team.
              </p></volt-card-content>
            </volt-card>
          </div>
          <div class="grid gap-3" moveStagger="90ms">
            @for (step of steps; track step.number) {
              <volt-card class="block border-border bg-surface" [moveInView]="{ y: [18, 0] }" moveDuration="380ms" [moveWhileHover]="{ y: [0, -4] }">
                <volt-card-content class="flex gap-4 p-5 sm:gap-6">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 font-mono text-xs font-bold text-primary">{{ step.number }}</span>
                  <div class="min-w-0">
                    <volt-card-title class="text-lg">{{ step.title }}</volt-card-title>
                    <volt-card-description class="mt-1 text-sm leading-6">{{ step.description }}</volt-card-description>
                    <code class="mt-3 block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs text-foreground sm:text-sm">{{ step.command }}</code>
                  </div>
                </volt-card-content>
              </volt-card>
            }
          </div>
        </div>
        <volt-separator class="mt-14" />
        <div class="mt-8 grid gap-4 sm:grid-cols-3">
          <div><p class="font-semibold text-foreground">Plan first</p><p class="mt-1 text-sm leading-6 text-muted-foreground">Preview changes with <code>install --dry-run</code> before writing files.</p></div>
          <div><p class="font-semibold text-foreground">Owned files only</p><p class="mt-1 text-sm leading-6 text-muted-foreground">The lockfile tracks managed paths. Edited or unowned destinations become conflicts.</p></div>
          <div><p class="font-semibold text-foreground">Project local</p><p class="mt-1 text-sm leading-6 text-muted-foreground">Skills, MCP configuration and supported hooks live with the project.</p></div>
        </div>
      </div>
    </section>
  `,
})
export class AboutComponent {
  readonly steps = WORKFLOW_STEPS;
}

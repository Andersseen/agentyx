import { Component } from "@angular/core";
import { VoltBadge } from "@voltui/components";
import { MoveInViewDirective } from "angular-movement";
import { ProvidersComponent } from "../components/providers.component.js";

@Component({
  selector: "app-providers-page",
  imports: [ProvidersComponent, VoltBadge, MoveInViewDirective],
  template: `
    <main class="overflow-x-hidden bg-background">
      <section class="hero-section relative overflow-hidden border-b border-border px-4 py-16 sm:px-6 lg:py-20">
        <div class="mx-auto max-w-6xl" [moveInView]="{ y: [16, 0] }" moveDuration="440ms">
          <p class="text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Provider compatibility
          </p>
          <h1
            class="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl"
          >
            Four agents, one definition.
          </h1>
          <p class="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            Agentyx installs the same provider-neutral capabilities into each agent's own documented
            destinations. This page is generated from the same table
            <a
              class="text-primary underline underline-offset-4"
              href="https://github.com/Andersseen/agentyx/blob/main/docs/compatibility.md"
              target="_blank"
              rel="noopener noreferrer"
              >docs/compatibility.md</a
            >
            records, which is checked against each provider's official documentation.
          </p>
          <div class="mt-6 flex flex-wrap gap-2">
            <volt-badge variant="outline">project-local only</volt-badge>
            <volt-badge variant="outline">plan before write</volt-badge>
            <volt-badge variant="outline">reversible via lockfile</volt-badge>
            <volt-badge variant="outline">never touches $HOME</volt-badge>
          </div>
        </div>
      </section>
      <section class="section-band px-4 py-16 sm:px-6 lg:py-20">
        <div class="mx-auto max-w-6xl">
          <app-providers />
        </div>
      </section>
    </main>
  `,
})
export default class ProvidersPageComponent {}

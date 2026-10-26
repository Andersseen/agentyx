import { Component } from "@angular/core";
import { ProvidersComponent } from "../components/providers.component.js";

@Component({
  selector: "app-providers-page",
  imports: [ProvidersComponent],
  template: `
    <main class="overflow-x-hidden bg-background">
      <header class="border-b border-border py-12 lg:py-20">
        <div class="mx-auto grid max-w-7xl px-4 sm:px-6 gap-6 lg:grid-cols-12 lg:gap-12">
          <div class="lg:col-span-7">
            <p class="caption">docs/compatibility.md</p>
            <h1 class="display-2 mt-3">Four agents, one definition.</h1>
          </div>
          <div class="lg:col-span-5 lg:pt-8">
            <p class="lede text-muted-foreground">
              Agentyx installs the same provider-neutral capabilities into each agent's own
              documented destinations. This page is generated from the table
              <a
                class="text-primary underline underline-offset-4"
                href="https://github.com/Andersseen/agentyx/blob/main/docs/compatibility.md"
                target="_blank"
                rel="noopener noreferrer"
                >docs/compatibility.md</a
              >
              records, which is checked against each provider's official documentation.
            </p>
            <ul
              class="mono mt-5 grid gap-1 border-t border-wire pt-4 text-xs text-muted-foreground sm:grid-cols-2"
            >
              <li>project-local only</li>
              <li>plan before write</li>
              <li>reversible via lockfile</li>
              <li>never touches $HOME</li>
            </ul>
          </div>
        </div>
      </header>
      <section class="py-12 lg:py-16">
        <div class="mx-auto max-w-7xl px-4 sm:px-6">
          <app-providers />
        </div>
      </section>
    </main>
  `,
})
export default class ProvidersPageComponent {}

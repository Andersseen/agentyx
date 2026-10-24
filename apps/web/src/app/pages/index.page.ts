import { Component } from "@angular/core";
import { AboutComponent } from "../components/about.component.js";
import { DoctorComponent } from "../components/doctor.component.js";
import { HeroComponent } from "../components/hero.component.js";
import { PacksComponent } from "../components/packs.component.js";
import { ProvidersComponent } from "../components/providers.component.js";

@Component({
  selector: "app-home-page",
  imports: [HeroComponent, AboutComponent, DoctorComponent, ProvidersComponent, PacksComponent],
  template: `
    <div class="overflow-x-hidden bg-background">
      <main>
        <app-hero />
        <app-about />
        <app-doctor />
        <section id="providers" class="section-band border-b border-border">
          <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <div class="max-w-3xl">
              <p class="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                03 / PROVIDERS
              </p>
              <h2 class="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                Four agents, one definition.
              </h2>
              <p class="mt-5 text-lg leading-8 text-muted-foreground">
                Every provider receives byte-identical Skill content. Only the destination differs,
                and each one is that provider's own documented convention.
                <a
                  class="font-semibold text-primary underline underline-offset-4"
                  href="/providers"
                  >See the full compatibility matrix</a
                >.
              </p>
            </div>
            <div class="mt-10">
              <app-providers [showNotes]="false" />
            </div>
          </div>
        </section>
        <app-packs />
      </main>
    </div>
  `,
})
export default class HomePageComponent {}

import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { AboutComponent } from "../components/about.component.js";
import { ComposeComponent } from "../components/compose.component.js";
import { DesignPairComponent } from "../components/design-pair.component.js";
import { DoctorComponent } from "../components/doctor.component.js";
import { HeroComponent } from "../components/hero.component.js";
import { ProvidersComponent } from "../components/providers.component.js";

/**
 * Narrative: one definition (hero) → capabilities resolve → the lifecycle → each provider receives
 * native output → doctor shows installed reality → packs compose.
 */
@Component({
  selector: "app-home-page",
  imports: [
    RouterLink,
    HeroComponent,
    AboutComponent,
    ComposeComponent,
    DesignPairComponent,
    DoctorComponent,
    ProvidersComponent,
  ],
  template: `
    <div class="overflow-x-hidden bg-background">
      <main>
        <app-hero />
        <section id="resolve" class="border-b border-border">
          <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div class="grid gap-6 lg:grid-cols-12 lg:gap-12">
              <div class="lg:col-span-5">
                <p class="caption">agentyx resolve ui-ux creative-web --explain</p>
                <h2 class="display-2 mt-3">Different questions, one resolved set.</h2>
              </div>
              <p class="lede text-muted-foreground lg:col-span-6 lg:col-start-7 lg:pt-8">
                Packs are declared and never inherit. When two packs want the same Skill it resolves
                once and keeps both origins. The two design packs show it: one asks how the product
                behaves, the other what the site should feel like.
              </p>
            </div>
            <div class="mt-10 lg:mt-14">
              <app-design-pair />
            </div>
          </div>
        </section>
        <app-about />
        <section id="providers" class="border-b border-border">
          <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div class="max-w-2xl">
              <h2 class="display-2">Four agents, one definition.</h2>
              <p class="lede mt-5 text-muted-foreground">
                Every provider receives byte-identical Skill content. Only the destination differs,
                and each one is that provider's own documented convention.
                <a
                  class="font-semibold text-primary underline underline-offset-4"
                  routerLink="/providers"
                  >See the full compatibility matrix</a
                >.
              </p>
            </div>
            <div class="mt-10">
              <app-providers [showNotes]="false" />
            </div>
          </div>
        </section>
        <app-doctor />
        <app-compose />
      </main>
    </div>
  `,
})
export default class HomePageComponent {}

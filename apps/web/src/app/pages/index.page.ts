import { Component } from "@angular/core";
import { AboutComponent } from "../components/about.component.js";
import { FeaturesComponent } from "../components/features.component.js";
import { FooterComponent } from "../components/footer.component.js";
import { HeroComponent } from "../components/hero.component.js";
import { NavbarComponent } from "../components/navbar.component.js";
import { PacksComponent } from "../components/packs.component.js";

@Component({
  selector: "app-home-page",
  imports: [
    NavbarComponent,
    HeroComponent,
    AboutComponent,
    FeaturesComponent,
    PacksComponent,
    FooterComponent,
  ],
  template: `
    <div class="min-h-screen overflow-x-hidden bg-background">
      <app-navbar />
      <main id="main-content">
        <app-hero />
        <app-about />
        <app-features />
        <app-packs />
      </main>
      <app-footer />
    </div>
  `,
})
export default class HomePageComponent {}

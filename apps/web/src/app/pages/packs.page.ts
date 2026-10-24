import { Component } from "@angular/core";
import { PacksComponent } from "../components/packs.component.js";

@Component({
  selector: "app-packs-page",
  imports: [PacksComponent],
  template: `
    <main class="overflow-x-hidden bg-background">
      <app-packs />
    </main>
  `,
})
export default class PacksPageComponent {}

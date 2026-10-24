import { Component, computed, signal } from "@angular/core";
import { VoltNativeButton } from "@voltui/components";
import { MoveStaggerDirective, MoveTapDirective } from "angular-movement";
import { PACK_CATEGORIES, PACKS, type PackCategory } from "../data/packs.js";
import { PackCardComponent } from "./pack-card.component.js";
import { PackDetailComponent } from "./pack-detail.component.js";

@Component({
  selector: "app-packs",
  imports: [
    VoltNativeButton,
    MoveStaggerDirective,
    MoveTapDirective,
    PackCardComponent,
    PackDetailComponent,
  ],
  template: `
    <section id="packs" class="section-band border-b border-border">
      <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div class="max-w-3xl">
          <p class="text-xs font-bold uppercase tracking-[0.15em] text-primary">04 / THE PACK CATALOGUE</p>
          <h2 class="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Pick capabilities with a purpose.</h2>
          <p class="mt-5 text-lg leading-8 text-muted-foreground">Packs are composable. Add a language, then layer engineering and workflow practices that fit the project. Select one to see what it brings.</p>
        </div>
        <div class="mt-9 flex flex-wrap gap-2" role="group" aria-label="Filter packs">
          @for (category of categories; track category) {
            <button voltButton type="button" variant="outline" size="sm" class="rounded-full capitalize" [class.border-primary]="activeCategory() === category" [class.text-primary]="activeCategory() === category" [attr.aria-pressed]="activeCategory() === category" (click)="selectCategory(category)" moveWhileTap="press">{{ category === 'all' ? 'All packs' : category }}</button>
          }
        </div>
        <div data-testid="pack-catalogue" class="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
          <div data-testid="pack-list" class="grid min-w-0 content-start gap-2 sm:grid-cols-2" moveStagger="65ms">
            @for (pack of visiblePacks(); track pack.name) {
              <app-pack-card [pack]="pack" [selected]="selectedPack().name === pack.name" (packSelected)="selectedPack.set($event)" />
            }
          </div>
          <aside class="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <app-pack-detail [pack]="selectedPack()" />
          </aside>
        </div>
      </div>
    </section>
  `,
})
export class PacksComponent {
  readonly categories = PACK_CATEGORIES;
  readonly activeCategory = signal<PackCategory>("all");
  readonly selectedPack = signal(PACKS[0]);
  readonly visiblePacks = computed(() =>
    this.activeCategory() === "all"
      ? PACKS
      : PACKS.filter((pack) => pack.category === this.activeCategory()),
  );

  selectCategory(category: PackCategory): void {
    this.activeCategory.set(category);
    const first = category === "all" ? PACKS[0] : PACKS.find((pack) => pack.category === category);
    if (first) this.selectedPack.set(first);
  }
}

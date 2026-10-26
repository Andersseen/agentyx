import { Component, computed, signal } from "@angular/core";
import { PACK_CATEGORIES, PACKS, type PackCategory } from "../data/packs.js";
import { PackCardComponent } from "./pack-card.component.js";
import { PackDetailComponent } from "./pack-detail.component.js";

/** The filterable catalogue: a list of purposes on the left, the selected pack's Skills on the right. */
@Component({
  selector: "app-packs",
  imports: [PackCardComponent, PackDetailComponent],
  template: `
    <section id="catalogue" aria-labelledby="catalogue-heading">
      <h2 id="catalogue-heading" class="display-2">The full catalogue</h2>
      <p class="lede mt-4 max-w-2xl text-muted-foreground">
        Packs are composable. Add a language, then layer engineering and workflow practices that fit
        the project. Select one to see its Skills.
      </p>
      <div class="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter packs">
        @for (category of categories; track category) {
          <button
            type="button"
            class="min-h-10 border px-4 text-sm font-medium capitalize transition-colors hover:bg-accent"
            [class.border-primary]="activeCategory() === category"
            [class.text-primary]="activeCategory() === category"
            [class.border-border]="activeCategory() !== category"
            [attr.aria-pressed]="activeCategory() === category"
            (click)="selectCategory(category)"
          >
            {{ category === 'all' ? 'All packs' : category }}
          </button>
        }
      </div>
      <div
        data-testid="pack-catalogue"
        class="mt-6 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
      >
        <div
          data-testid="pack-list"
          class="grid min-w-0 content-start divide-y divide-border border-y border-border"
        >
          @for (pack of visiblePacks(); track pack.name) {
            <app-pack-card
              [pack]="pack"
              [selected]="selectedPack().name === pack.name"
              (packSelected)="selectedPack.set($event)"
            />
          }
        </div>
        <aside class="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <app-pack-detail [pack]="selectedPack()" />
        </aside>
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

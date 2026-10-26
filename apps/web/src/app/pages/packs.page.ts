import { Component } from "@angular/core";
import { DesignPairComponent } from "../components/design-pair.component.js";
import { PacksComponent } from "../components/packs.component.js";
import { PACK_COUNT, SKILL_COUNT } from "../data/site.js";

/** Purpose before internals: what packs are for, the one distinction people ask about, then the list. */
@Component({
  selector: "app-packs-page",
  imports: [DesignPairComponent, PacksComponent],
  template: `
    <main class="overflow-x-hidden bg-background">
      <header class="border-b border-border py-12 lg:py-20">
        <div class="mx-auto grid max-w-7xl px-4 sm:px-6 gap-6 lg:grid-cols-12 lg:gap-12">
          <h1 class="display-2 lg:col-span-7">Pick capabilities with a purpose.</h1>
          <p class="lede text-muted-foreground lg:col-span-5 lg:pt-3">
            {{ packCount }} packs carry {{ skillCount }} Skills. Each answers one kind of question,
            and they combine without inheritance. Selection is always deliberate: technology alone
            never implies a pack.
          </p>
        </div>
      </header>

      <section id="design-packs" class="band" aria-labelledby="design-packs-heading">
        <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
          <h2 id="design-packs-heading" class="display-2 max-w-3xl">
            Two design packs, two questions.
          </h2>
          <p class="lede mt-4 max-w-3xl text-muted-foreground">
            <code class="mono text-foreground">ui-ux</code> keeps product interfaces correct and
            usable. <code class="mono text-foreground">creative-web</code> gives marketing sites,
            launches and portfolios a creative direction. It does not push expressive art direction
            into dense admin tools or transactional forms. Select both for a polished product site.
          </p>
          <div class="mt-8">
            <app-design-pair [showCommand]="false" />
          </div>
        </div>
      </section>

      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-20">
        <app-packs />
      </div>
    </main>
  `,
})
export default class PacksPageComponent {
  readonly packCount = PACK_COUNT;
  readonly skillCount = SKILL_COUNT;
}

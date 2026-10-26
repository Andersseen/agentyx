import { Component, input, output } from "@angular/core";
import type { Pack } from "../data/packs.js";

/** One catalogue row: a plain selectable line, not a container. */
@Component({
  selector: "app-pack-card",
  template: `
    <button
      type="button"
      class="pack-row group flex w-full min-w-0 flex-col gap-1 border-l-2 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-2"
      [class.border-primary]="selected()"
      [class.bg-accent]="selected()"
      [class.border-transparent]="!selected()"
      [attr.aria-pressed]="selected()"
      (click)="packSelected.emit(pack())"
    >
      <strong class="mono text-sm text-foreground">{{ pack().name }}</strong>
      <span class="block whitespace-normal text-sm leading-6 text-muted-foreground">{{
        pack().purpose
      }}</span>
    </button>
  `,
})
export class PackCardComponent {
  readonly pack = input.required<Pack>();
  readonly selected = input(false);
  readonly packSelected = output<Pack>();
}

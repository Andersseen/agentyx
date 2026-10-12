import { Component, input, output } from "@angular/core";
import { VoltCard, VoltNativeButton } from "@voltui/components";
import { MoveHoverDirective, MoveInViewDirective, MoveTapDirective } from "angular-movement";
import type { Pack } from "../data/packs.js";

@Component({
  selector: "app-pack-card",
  imports: [VoltCard, VoltNativeButton, MoveHoverDirective, MoveInViewDirective, MoveTapDirective],
  template: `
    <volt-card class="block min-w-0 overflow-hidden border-border transition-colors" [class.border-primary]="selected()" [moveInView]="{ y: [12, 0] }" moveDuration="340ms" [moveWhileHover]="{ y: [0, -3] }">
      <button voltButton type="button" variant="ghost" class="h-full min-h-28 w-full flex-col items-stretch justify-start gap-2 rounded-none p-4 text-left" [attr.aria-pressed]="selected()" (click)="packSelected.emit(pack())" moveWhileTap="press">
        <span class="flex w-full items-start justify-between gap-2"><strong class="font-mono text-sm text-foreground">{{ pack().name }}</strong><span class="text-primary" aria-hidden="true">↗</span></span>
        <span class="block w-full whitespace-normal text-sm leading-6 text-muted-foreground">{{ pack().purpose }}</span>
      </button>
    </volt-card>
  `,
})
export class PackCardComponent {
  readonly pack = input.required<Pack>();
  readonly selected = input(false);
  readonly packSelected = output<Pack>();
}

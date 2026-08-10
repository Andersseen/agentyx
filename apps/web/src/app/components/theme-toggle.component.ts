import { Component, inject } from "@angular/core";
import { VoltButton } from "@voltui/components";
import { MoveTapDirective } from "angular-movement";
import { LmnMoonIcon } from "lumen-icons/moon";
import { LmnSunIcon } from "lumen-icons/sun";
import { ThemeService } from "../services/theme.service.js";

@Component({
  selector: "app-theme-toggle",
  imports: [LmnMoonIcon, LmnSunIcon, MoveTapDirective, VoltButton],
  template: `
    <volt-button
      variant="ghost"
      size="icon"
      [attr.aria-label]="theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      (click)="themeService.toggle()"
      [moveWhileTap]="{ scale: [1, 0.92, 1] }"
    >
      @if (theme() === "dark") {
        <lmn-sun class="h-5 w-5" aria-hidden="true" />
      } @else {
        <lmn-moon class="h-5 w-5" aria-hidden="true" />
      }
    </volt-button>
  `,
})
export class ThemeToggleComponent {
  protected readonly themeService = inject(ThemeService);
  protected readonly theme = this.themeService.theme;
}

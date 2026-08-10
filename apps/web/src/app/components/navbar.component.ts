import { Component, signal } from "@angular/core";
import { MoveInViewDirective, MoveTapDirective } from "angular-movement";
import { LmnBars3Icon } from "lumen-icons/bars-3";
import { LmnCommandLineIcon } from "lumen-icons/command-line";
import { LmnXMarkIcon } from "lumen-icons/x-mark";
import { ThemeToggleComponent } from "./theme-toggle.component.js";

interface NavLink {
  label: string;
  href: string;
}

@Component({
  selector: "app-navbar",
  imports: [
    LmnBars3Icon,
    LmnCommandLineIcon,
    LmnXMarkIcon,
    MoveInViewDirective,
    MoveTapDirective,
    ThemeToggleComponent,
  ],
  template: `
    <header
      class="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md"
      role="banner"
      moveInView="fade-down"
      [moveDuration]="360"
    >
      <nav
        class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4"
        aria-label="Main navigation"
      >
        <a
          href="#hero"
          class="group flex items-center gap-2 text-lg font-semibold tracking-tight"
          [moveWhileTap]="{ scale: [1, 0.97, 1] }"
        >
          <span class="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface shadow-sm transition-transform group-hover:-rotate-3">
            <lmn-command-line class="h-5 w-5 text-primary" aria-hidden="true" />
          </span>
          <span>Agentyx</span>
        </a>

        <div class="flex items-center gap-1 md:gap-4">
          <ul class="hidden items-center gap-1 md:flex" role="menubar">
            @for (link of links; track link.href) {
              <li role="none">
                <a
                  [href]="link.href"
                  class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  role="menuitem"
                >
                  {{ link.label }}
                </a>
              </li>
            }
          </ul>
          <app-theme-toggle />
          <button
            type="button"
            class="grid h-10 w-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            [attr.aria-expanded]="menuOpen()"
            aria-controls="mobile-nav"
            aria-label="Toggle navigation"
            (click)="toggleMenu()"
            [moveWhileTap]="{ scale: [1, 0.92, 1] }"
          >
            @if (menuOpen()) {
              <lmn-x-mark class="h-5 w-5" aria-hidden="true" />
            } @else {
              <lmn-bars-3 class="h-5 w-5" aria-hidden="true" />
            }
          </button>
        </div>
      </nav>

      @if (menuOpen()) {
        <div
          id="mobile-nav"
          class="border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-md md:hidden"
          moveInView="fade-down"
          [moveDuration]="240"
        >
          <div class="mx-auto grid max-w-6xl gap-1">
            @for (link of links; track link.href) {
              <a
                [href]="link.href"
                class="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                (click)="closeMenu()"
              >
                {{ link.label }}
              </a>
            }
          </div>
        </div>
      }
    </header>
  `,
})
export class NavbarComponent {
  readonly menuOpen = signal(false);
  readonly links: NavLink[] = [
    { label: "About", href: "#about" },
    { label: "Features", href: "#features" },
    { label: "Packs", href: "#packs" },
  ];

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
}

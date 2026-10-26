import { Component, signal } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { LmnBars3Icon } from "lumen-icons/bars-3";
import { LmnCommandLineIcon } from "lumen-icons/command-line";
import { LmnXMarkIcon } from "lumen-icons/x-mark";
import { ThemeToggleComponent } from "./theme-toggle.component.js";

interface NavLink {
  readonly label: string;
  readonly route: string;
  /** The home route must match exactly, or it would report active on every page. */
  readonly exact: boolean;
}

@Component({
  selector: "app-navbar",
  imports: [
    RouterLink,
    RouterLinkActive,
    LmnBars3Icon,
    LmnCommandLineIcon,
    LmnXMarkIcon,
    ThemeToggleComponent,
  ],
  template: `
    <header
      class="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md"
      role="banner"
    >
      <nav
        class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4"
        aria-label="Main navigation"
      >
        <a
          routerLink="/"
          class="group flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span class="grid h-9 w-9 place-items-center border border-wire bg-surface">
            <lmn-command-line class="h-5 w-5 text-primary" aria-hidden="true" />
          </span>
          <span>Agentyx</span>
        </a>

        <div class="flex items-center gap-1 md:gap-4">
          <ul class="hidden items-center gap-1 md:flex">
            @for (link of links; track link.label) {
              <li>
                <a
                  [routerLink]="link.route"
                  routerLinkActive="nav-link--active"
                  [routerLinkActiveOptions]="{ exact: link.exact }"
                  ariaCurrentWhenActive="page"
                  class="nav-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          class="border-t border-border bg-background px-4 py-3 md:hidden"
        >
          <div class="mx-auto grid max-w-7xl gap-1">
            @for (link of links; track link.label) {
              <a
                [routerLink]="link.route"
                routerLinkActive="nav-link--active"
                [routerLinkActiveOptions]="{ exact: link.exact }"
                ariaCurrentWhenActive="page"
                class="nav-link-block"
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
    { label: "Overview", route: "/", exact: true },
    { label: "Providers", route: "/providers", exact: false },
    { label: "Packs", route: "/packs", exact: false },
    { label: "Docs", route: "/docs", exact: false },
  ];

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
}

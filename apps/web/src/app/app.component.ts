import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { FooterComponent } from "./components/footer.component.js";
import { NavbarComponent } from "./components/navbar.component.js";

/**
 * The site shell. Header and footer live here rather than in each page so the documentation region,
 * which Doqs renders from Markdown, keeps the same navigation as the marketing pages.
 *
 * The shell deliberately renders no `<main>`: each marketing page brings its own, and Doqs renders
 * one for the documentation region, so every route has exactly one `main` landmark. The skip link
 * therefore targets the wrapper, which is common to all routes.
 */
@Component({
  selector: "app-root",
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <a
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-[60] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      href="#content"
      >Skip to content</a
    >
    <app-navbar />
    <div id="content" tabindex="-1" class="outline-none">
      <router-outlet />
    </div>
    <app-footer />
  `,
})
export class AppComponent {}

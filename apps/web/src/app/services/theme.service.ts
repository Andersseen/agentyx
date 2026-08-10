import { DOCUMENT, isPlatformBrowser } from "@angular/common";
import {
  Injectable,
  inject,
  PLATFORM_ID,
  type Renderer2,
  RendererFactory2,
  signal,
} from "@angular/core";

type Theme = "light" | "dark";

const STORAGE_KEY = "agentyx-theme";

@Injectable({
  providedIn: "root",
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly renderer: Renderer2 = inject(RendererFactory2).createRenderer(null, null);
  readonly theme = signal<Theme>(this.getInitialTheme());

  constructor() {
    this.apply(this.theme());
  }

  toggle(): void {
    const next: Theme = this.theme() === "light" ? "dark" : "light";
    this.theme.set(next);
    this.apply(next);
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    this.apply(theme);
  }

  private apply(theme: Theme): void {
    const html = this.document.documentElement;
    if (theme === "dark") {
      this.renderer.addClass(html, "dark");
    } else {
      this.renderer.removeClass(html, "dark");
    }
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors (e.g., private mode).
    }
  }

  private getInitialTheme(): Theme {
    if (!this.isBrowser) {
      return "dark";
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark") {
        return stored;
      }
    } catch {
      // Ignore storage errors.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
}

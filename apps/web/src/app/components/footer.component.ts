import { Component } from "@angular/core";
import { VoltNativeButton } from "@voltui/components";
import { LmnArrowTopRightOnSquareIcon } from "lumen-icons/arrow-top-right-on-square";
import { LmnGithubIcon } from "lumen-icons/github";

interface FooterColumn {
  readonly title: string;
  readonly links: readonly { readonly label: string; readonly href: string }[];
}

@Component({
  selector: "app-footer",
  imports: [VoltNativeButton, LmnGithubIcon, LmnArrowTopRightOnSquareIcon],
  template: `
    <footer class="border-t border-border bg-background">
      <div class="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <p class="font-semibold text-foreground">Agentyx</p>
            <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
              Provider-agnostic, project-local environments for coding agents. Plan first, write what
              you recorded, and take it all back.
            </p>
            <p class="mt-4 text-sm text-muted-foreground">
              &copy; {{ year }} Andersseen. Licensed under MIT.
            </p>
          </div>

          @for (column of columns; track column.title) {
            <nav [attr.aria-label]="column.title">
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {{ column.title }}
              </p>
              <ul class="mt-3 space-y-2">
                @for (link of column.links; track link.href) {
                  <li>
                    <a
                      [href]="link.href"
                      class="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >{{ link.label }}</a
                    >
                  </li>
                }
              </ul>
            </nav>
          }
        </div>

        <div
          class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row"
        >
          <p class="text-xs text-muted-foreground">
            Provider facts are checked against each provider's official documentation.
          </p>
          <a
            voltButton
            variant="ghost"
            size="sm"
            href="https://github.com/Andersseen/agentyx"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Agentyx on GitHub (opens in new tab)"
          >
            <lmn-github class="h-5 w-5" aria-hidden="true" />
            GitHub
            <lmn-arrow-top-right-on-square class="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  year = new Date().getFullYear();

  readonly columns: readonly FooterColumn[] = [
    {
      title: "Product",
      links: [
        { label: "How it works", href: "/#workflow" },
        { label: "Doctor", href: "/#doctor" },
        { label: "Packs", href: "/packs" },
        { label: "Providers", href: "/providers" },
      ],
    },
    {
      title: "Documentation",
      links: [
        { label: "Getting started", href: "/docs/getting-started" },
        { label: "Configuration", href: "/docs/configuration" },
        { label: "Observability", href: "/docs/guides/observability" },
        { label: "Reproducibility", href: "/docs/guides/reproducibility" },
        { label: "CLI reference", href: "/docs/reference/cli" },
        { label: "Compatibility", href: "/docs/reference/compatibility" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Repository", href: "https://github.com/Andersseen/agentyx" },
        { label: "Issues", href: "https://github.com/Andersseen/agentyx/issues" },
        { label: "Changelog", href: "https://github.com/Andersseen/agentyx/releases" },
        {
          label: "Contributing",
          href: "https://github.com/Andersseen/agentyx/blob/main/CONTRIBUTING.md",
        },
      ],
    },
  ];
}

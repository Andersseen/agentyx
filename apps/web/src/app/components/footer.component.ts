import { Component } from "@angular/core";
import { VoltButton } from "@voltui/components";
import { LmnArrowTopRightOnSquareIcon } from "lumen-icons/arrow-top-right-on-square";
import { LmnGlobeAltIcon } from "lumen-icons/globe-alt";
import { LmnGithubIcon } from "lumen-icons/github";

@Component({
  selector: "app-footer",
  imports: [LmnGithubIcon, LmnArrowTopRightOnSquareIcon, LmnGlobeAltIcon, VoltButton],
  template: `
    <footer class="border-t border-border bg-background">
      <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
        <div class="text-center sm:text-left">
          <p class="font-semibold text-foreground">Agentyx</p>
          <p class="text-sm text-muted-foreground">
            &copy; {{ year }} Andersseen. Licensed under MIT.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <a
            href="https://agentyx.pages.dev"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Agentyx website (opens in new tab)"
          >
            <volt-button variant="ghost" size="sm">
              <lmn-globe-alt class="h-4 w-4" slot="leading" aria-hidden="true" />
              Website
              <lmn-arrow-top-right-on-square class="h-4 w-4" slot="trailing" aria-hidden="true" />
            </volt-button>
          </a>
          <a
            href="https://github.com/Andersseen/agentyx"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Agentyx on GitHub (opens in new tab)"
          >
            <volt-button variant="ghost" size="sm">
              <lmn-github class="h-5 w-5" slot="leading" aria-hidden="true" />
              GitHub
              <lmn-arrow-top-right-on-square class="h-4 w-4" slot="trailing" aria-hidden="true" />
            </volt-button>
          </a>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  year = new Date().getFullYear();
}

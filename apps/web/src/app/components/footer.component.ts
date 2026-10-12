import { Component } from "@angular/core";
import { VoltNativeButton } from "@voltui/components";
import { LmnArrowTopRightOnSquareIcon } from "lumen-icons/arrow-top-right-on-square";
import { LmnGithubIcon } from "lumen-icons/github";

@Component({
  selector: "app-footer",
  imports: [VoltNativeButton, LmnGithubIcon, LmnArrowTopRightOnSquareIcon],
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
}

import { Component } from "@angular/core";
import {
  VoltCard,
  VoltCardContent,
  VoltCardDescription,
  VoltCardHeader,
  VoltCardTitle,
} from "@voltui/components";
import { MoveHoverDirective, MoveInViewDirective, MoveStaggerDirective } from "angular-movement";
import { LmnDocumentTextIcon } from "lumen-icons/document-text";
import { LmnPuzzlePieceIcon } from "lumen-icons/puzzle-piece";
import { LmnShieldCheckIcon } from "lumen-icons/shield-check";

@Component({
  selector: "app-about",
  imports: [
    VoltCard,
    VoltCardContent,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
    LmnDocumentTextIcon,
    LmnPuzzlePieceIcon,
    LmnShieldCheckIcon,
    MoveHoverDirective,
    MoveInViewDirective,
    MoveStaggerDirective,
  ],
  template: `
    <section id="about" class="section-band">
      <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <div class="mb-12 max-w-2xl" moveInView="fade-up" [moveInViewMargin]="'0px'">
        <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
          What is Agentyx?
        </h2>
        <p class="mt-4 text-lg text-muted-foreground">
          A single configuration drives consistent behavior across every coding agent.
        </p>
      </div>

      <div
        class="grid gap-6 lg:grid-cols-2"
        moveInView="fade-up"
        [moveInViewMargin]="'0px'"
        moveStagger
        [moveStaggerStep]="0.08"
      >
        <volt-card class="interactive-card flex flex-col justify-center p-2" [moveWhileHover]="{ y: [0, -8], scale: [1, 1.01] }">
          <volt-card-header>
            <lmn-puzzle-piece class="h-6 w-6 text-primary" aria-hidden="true" />
            <volt-card-title>Provider-agnostic packs</volt-card-title>
            <volt-card-description>
              Declare composable capability packs once and install them as native
              <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">SKILL.md</code>
              files.
            </volt-card-description>
          </volt-card-header>
          <volt-card-content>
            <p class="text-muted-foreground">
              Packs contribute skills, MCP servers, and local tool checks. Adapters turn the
              resolved capabilities into project files for Codex, Claude Code, and Kimi Code
              without leaking provider concepts into the packs themselves.
            </p>
          </volt-card-content>
        </volt-card>

        <volt-card class="interactive-card overflow-hidden p-2" [moveWhileHover]="{ y: [0, -8], scale: [1, 1.01] }">
          <volt-card-header>
            <lmn-document-text class="h-6 w-6 text-secondary" aria-hidden="true" />
            <volt-card-title>.agentyx.json</volt-card-title>
            <volt-card-description>Your project capabilities</volt-card-description>
          </volt-card-header>
          <volt-card-content>
            <pre
              class="overflow-x-auto rounded-lg bg-muted p-4 text-sm text-foreground"
              tabindex="0"
            ><code>{{ configSnippet }}</code></pre>
          </volt-card-content>
        </volt-card>
      </div>

      <div
        class="mt-6 grid gap-6 md:grid-cols-3"
        moveInView="fade-up"
        moveStagger
        [moveStaggerStep]="0.07"
      >
        @for (item of guardrails; track item.title) {
          <div class="rounded-md border border-border bg-background/70 p-5 shadow-sm backdrop-blur">
            <lmn-shield-check class="h-5 w-5 text-success" aria-hidden="true" />
            <h3 class="mt-4 text-base font-semibold text-foreground">{{ item.title }}</h3>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ item.copy }}</p>
          </div>
        }
      </div>
      </div>
    </section>
  `,
})
export class AboutComponent {
  readonly configSnippet = `{
  "packs": [
    "technical",
    "typescript",
    "angular",
    "efficiency",
    "agentic"
  ],
  "enable": [],
  "targets": ["codex", "claude", "kimi"]
}`;
  readonly guardrails = [
    {
      title: "Provider clean",
      copy: "Stacks stay neutral; adapters own destinations and file formats.",
    },
    {
      title: "Plan before write",
      copy: "Resolution previews capabilities before anything touches the filesystem.",
    },
    {
      title: "Project local",
      copy: "Generated skills and MCP config stay scoped to the repository.",
    },
  ];
}

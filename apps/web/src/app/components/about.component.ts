import { Component } from "@angular/core";
import {
  VoltCard,
  VoltCardContent,
  VoltCardDescription,
  VoltCardHeader,
  VoltCardTitle,
} from "@voltui/components";
import { MoveHoverDirective, MoveInViewDirective, MoveStaggerDirective } from "angular-movement";
import { LmnArrowRightIcon } from "lumen-icons/arrow-right";
import { LmnDocumentTextIcon } from "lumen-icons/document-text";
import { LmnGlobeAltIcon } from "lumen-icons/globe-alt";
import { LmnPuzzlePieceIcon } from "lumen-icons/puzzle-piece";
import { LmnShieldCheckIcon } from "lumen-icons/shield-check";

interface Step {
  step: string;
  command: string;
  description: string;
}

@Component({
  selector: "app-about",
  imports: [
    VoltCard,
    VoltCardContent,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
    LmnArrowRightIcon,

    LmnDocumentTextIcon,
    LmnGlobeAltIcon,
    LmnPuzzlePieceIcon,
    LmnShieldCheckIcon,
    MoveHoverDirective,
    MoveInViewDirective,
    MoveStaggerDirective,
  ],
  template: `
    <section id="about" class="section-band">
      <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div
          class="mb-12 max-w-2xl"
          moveInView="fade-up"
          [moveInViewMargin]="'0px'"
        >
          <h2
            class="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl"
          >
            What is Agentyx?
          </h2>
          <p class="mt-4 text-lg text-muted-foreground">
            A single configuration drives consistent behavior across every
            coding agent. Packs define capabilities; adapters translate them
            into provider-native files.
          </p>
        </div>

        <div
          class="grid gap-6 lg:grid-cols-2"
          moveInView="fade-up"
          [moveInViewMargin]="'0px'"
          moveStagger
          [moveStaggerStep]="0.08"
        >
          <volt-card
            class="interactive-card flex flex-col justify-center p-2"
            [moveWhileHover]="{ y: [0, -8], scale: [1, 1.01] }"
          >
            <volt-card-header>
              <lmn-puzzle-piece
                class="h-6 w-6 text-primary"
                aria-hidden="true"
              />
              <volt-card-title>Provider-agnostic packs</volt-card-title>
              <volt-card-description>
                Declare composable capability packs once and install them as
                native
                <code
                  class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground"
                  >SKILL.md</code
                >
                files.
              </volt-card-description>
            </volt-card-header>
            <volt-card-content>
              <p class="text-muted-foreground">
                Packs contribute skills, MCP servers, and local tool checks.
                Adapters turn the resolved capabilities into project files for
                Codex, Claude Code, and Kimi Code without leaking provider
                concepts into the packs themselves.
              </p>
            </volt-card-content>
          </volt-card>

          <volt-card
            class="interactive-card overflow-hidden p-2"
            [moveWhileHover]="{ y: [0, -8], scale: [1, 1.01] }"
          >
            <volt-card-header>
              <lmn-document-text
                class="h-6 w-6 text-secondary"
                aria-hidden="true"
              />
              <volt-card-title>.agentyx.json</volt-card-title>
              <volt-card-description
                >Your project capabilities in one file</volt-card-description
              >
            </volt-card-header>
            <volt-card-content>
              <pre
                class="overflow-x-auto rounded-lg bg-muted p-4 text-sm text-foreground"
                tabindex="0"
              ><code>{{ configSnippet }}</code></pre>
            </volt-card-content>
          </volt-card>
        </div>

        <div class="mt-16" moveInView="fade-up" [moveInViewMargin]="'0px'">
          <h3
            class="mb-8 text-center text-2xl font-semibold tracking-tight text-foreground"
          >
            From config to installed capabilities
          </h3>

          <div
            class="grid gap-4 sm:grid-cols-3"
            moveInView="fade-up"
            moveStagger
            [moveStaggerStep]="0.09"
          >
            @for (step of steps; track step.step; let i = $index) {
              <div
                class="relative rounded-lg border border-border bg-surface p-5 shadow-sm"
              >
                <span
                  class="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow"
                >
                  {{ i + 1 }}
                </span>
                <p class="mb-2 font-mono text-sm font-semibold text-primary">
                  {{ step.step }}
                </p>
                <p class="mb-3 font-mono text-sm text-muted-foreground">
                  {{ step.command }}
                </p>
                <p class="text-sm text-muted-foreground">
                  {{ step.description }}
                </p>
              </div>
            }
          </div>
        </div>

        <div
          class="mt-16 grid gap-6 md:grid-cols-3"
          moveInView="fade-up"
          moveStagger
          [moveStaggerStep]="0.07"
        >
          @for (item of guardrails; track item.title) {
            <div
              class="rounded-md border border-border bg-background/70 p-5 shadow-sm backdrop-blur"
            >
              <div class="icon-shell text-success">
                <lmn-shield-check class="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 class="mt-4 text-base font-semibold text-foreground">
                {{ item.title }}
              </h3>
              <p class="mt-2 text-sm leading-6 text-muted-foreground">
                {{ item.copy }}
              </p>
            </div>
          }
        </div>

        <div
          class="mt-16 rounded-lg border border-border bg-surface p-6"
          moveInView="fade-up"
          [moveInViewMargin]="'0px'"
        >
          <div class="flex items-center gap-3">
            <lmn-globe-alt class="h-5 w-5 text-info" aria-hidden="true" />
            <div>
              <p class="text-sm font-medium text-foreground">Website</p>
              <a
                href="https://agentyx.pages.dev"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-info underline underline-offset-2 hover:text-info/80"
              >
                agentyx.pages.dev
                <lmn-arrow-right
                  class="ml-1 inline h-3 w-3"
                  aria-hidden="true"
                />
              </a>
            </div>
          </div>
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

  readonly steps: Step[] = [
    {
      step: "1. Initialize",
      command: "pnpm dlx @agentyx/cli init --pack angular --target codex",
      description: "Scaffold .agentyx.json with your chosen packs and targets.",
    },
    {
      step: "2. Resolve",
      command: "pnpm dlx @agentyx/cli resolve --json",
      description: "Preview the full capability plan before any file is touched.",
    },
    {
      step: "3. Install",
      command: "pnpm dlx @agentyx/cli install --dry-run",
      description: "Apply resolved skills and MCP config into provider-native directories.",
    },
  ];

  readonly guardrails = [
    {
      title: "Provider clean",
      copy: "Packs stay neutral; adapters own destinations and file formats.",
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

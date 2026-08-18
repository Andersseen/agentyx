import { Component, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { VoltButton } from "@voltui/components";
import {
  MoveHoverDirective,
  MoveInViewDirective,
  MoveLoopDirective,
  MoveStaggerDirective,
  MoveTapDirective,
  MoveTextDirective,
} from "angular-movement";
import { LmnArrowRightIcon } from "lumen-icons/arrow-right";
import { LmnGithubIcon } from "lumen-icons/github";
import { LmnSparklesIcon } from "lumen-icons/sparkles";

interface Stat {
  label: string;
  value: string;
}

@Component({
  selector: "app-hero",
  imports: [
    RouterLink,
    VoltButton,
    LmnArrowRightIcon,
    LmnGithubIcon,
    LmnSparklesIcon,
    MoveHoverDirective,
    MoveInViewDirective,
    MoveLoopDirective,
    MoveStaggerDirective,
    MoveTapDirective,
    MoveTextDirective,
  ],
  template: `
    <section
      id="hero"
      class="relative isolate overflow-hidden border-b border-border px-4 py-16 sm:px-6 sm:py-20 lg:py-28"
      moveInView="fade-up"
      [moveInViewMargin]="'0px'"
    >
      <div class="hero-grid" aria-hidden="true"></div>

      <div class="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-transparent to-transparent" aria-hidden="true"></div>

      <div class="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
        <div class="text-center lg:text-left">
          <div
            class="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur lg:mx-0"
            [moveWhileHover]="{ scale: [1, 1.03] }"
          >
            <span class="relative flex h-2 w-2" aria-hidden="true">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75"
              ></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
            </span>
            Provider-agnostic CLI for coding agents
          </div>

          <h1
            class="mx-auto mt-8 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-6xl lg:mx-0 lg:text-7xl"
            moveText="fade-up"
            moveTextSplit="words"
            [moveTextStagger]="0.035"
          >
            Agentyx builds reusable environments for coding agents
          </h1>

          <p class="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-xl lg:mx-0">
            One config. Every agent. Agentyx gives Codex, Claude Code, and Kimi Code the same
            project-local behavior using native Skills and provider-neutral MCP definitions.
          </p>

          <div class="mt-10 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <a
              href="https://github.com/Andersseen/agentyx"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get started on GitHub (opens in new tab)"
              [moveWhileTap]="{ scale: [1, 0.97, 1] }"
            >
              <volt-button variant="solid" size="lg" class="w-full sm:w-auto">
                <lmn-github class="h-5 w-5" slot="leading" aria-hidden="true" />
                Get started
              </volt-button>
            </a>
            <a
              routerLink="/"
              fragment="about"
              aria-label="Learn more about Agentyx"
              [moveWhileTap]="{ scale: [1, 0.97, 1] }"
            >
              <volt-button variant="outline" size="lg" class="w-full sm:w-auto">
                Explore workflow
                <lmn-arrow-right class="h-5 w-5" slot="trailing" aria-hidden="true" />
              </volt-button>
            </a>
          </div>

          <dl
            class="mt-12 grid grid-cols-3 gap-3 text-left"
            moveInView="fade-up"
            moveStagger
            [moveStaggerStep]="0.07"
          >
            @for (stat of stats; track stat.label) {
              <div class="rounded-md border border-border bg-surface/70 p-3 shadow-sm backdrop-blur">
                <dt class="text-xs uppercase tracking-wider text-muted-foreground">{{ stat.label }}</dt>
                <dd class="mt-1 text-lg font-semibold text-foreground sm:text-xl">{{ stat.value }}</dd>
              </div>
            }
          </dl>
        </div>

        <div
          class="relative mx-auto w-full max-w-xl"
          [moveInView]="{ opacity: [0, 1], x: [28, 0], scale: [0.97, 1] }"
          [moveDuration]="560"
        >
          <div
            class="absolute -right-4 -top-4 hidden rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground shadow-lg sm:flex"
            [moveLoop]="{ y: [0, -8, 0] }"
            [moveDuration]="2200"
          >
            <lmn-sparkles class="mr-2 h-4 w-4 text-warning" aria-hidden="true" />
            plan first
          </div>

          <div class="terminal-card overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
            <div class="flex items-center justify-between border-b border-border px-4 py-3">
              <div class="flex gap-2" aria-hidden="true">
                <span class="h-3 w-3 rounded-full bg-danger"></span>
                <span class="h-3 w-3 rounded-full bg-warning"></span>
                <span class="h-3 w-3 rounded-full bg-success"></span>
              </div>
              <span class="text-xs text-muted-foreground">terminal</span>
            </div>
            <pre class="overflow-x-auto p-4 text-left text-sm leading-7 text-foreground sm:p-6"><code><span class="text-info">$</span> pnpm dlx @agentyx/cli resolve angular

<span class="text-warning">Packs</span>
  angular

<span class="text-info">Skills</span>
  angular-modern
  angular-signals
  angular-architecture
  angular-testing

<span class="text-secondary">MCP</span>
  context7    default

<span class="text-success">Tools</span>
  (none)</code></pre>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class HeroComponent {
  readonly title = signal("Agentyx");
  readonly stats: Stat[] = [
    { label: "config", value: "1 file" },
    { label: "targets", value: "3 agents" },
    { label: "writes", value: "planned" },
  ];
}

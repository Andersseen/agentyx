import { Component } from "@angular/core";
import {
  VoltBadge,
  VoltCard,
  VoltCardContent,
  VoltCardHeader,
  VoltNativeButton,
  VoltSeparator,
} from "@voltui/components";
import { MoveInViewDirective, MoveTapDirective } from "angular-movement";
import { LmnArrowRightIcon } from "lumen-icons/arrow-right";
import { LmnGithubIcon } from "lumen-icons/github";

@Component({
  selector: "app-hero",
  imports: [
    VoltBadge,
    VoltCard,
    VoltCardContent,
    VoltCardHeader,
    VoltNativeButton,
    VoltSeparator,
    LmnArrowRightIcon,
    LmnGithubIcon,
    MoveInViewDirective,
    MoveTapDirective,
  ],
  template: `
    <section id="hero" class="hero-section relative overflow-hidden border-b border-border px-4 py-20 sm:px-6 lg:py-28">
      <div class="hero-grid" aria-hidden="true"></div>
      <div class="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
        <div moveInView="fade-up" [moveInViewMargin]="'0px'">
          <p class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary"><span class="h-2 w-2 rounded-full bg-success ring-4 ring-success/15" aria-hidden="true"></span> The project-local harness for coding agents</p>
          <h1 class="mt-7 max-w-3xl text-5xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Give every coding agent the <span class="text-primary">right environment.</span>
          </h1>
          <p class="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            Choose the packs your project needs. Agentyx installs their Skills, MCP setup and hooks for
            Codex, Claude Code and Kimi Code, then shows you what is installed and what is actually observable.
          </p>
          <div class="mt-9 flex flex-wrap gap-3">
            <a voltButton href="#workflow" size="lg" [moveWhileTap]="{ scale: [1, 0.97, 1] }">
              See how it works <lmn-arrow-right class="h-4 w-4" aria-hidden="true" />
            </a>
            <a voltButton variant="outline" size="lg" href="https://github.com/Andersseen/agentyx" target="_blank" rel="noopener noreferrer" [moveWhileTap]="{ scale: [1, 0.97, 1] }">
              <lmn-github class="h-4 w-4" aria-hidden="true" /> GitHub
            </a>
          </div>
          <volt-separator class="mt-12" />
          <div class="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span><strong class="text-foreground">16</strong> built-in packs</span>
            <span><strong class="text-foreground">3</strong> supported targets</span>
            <span><strong class="text-foreground">1</strong> project config</span>
          </div>
        </div>

        <div class="relative" moveInView="fade-up" [moveInViewMargin]="'0px'">
          <div class="absolute -inset-7 rounded-[2rem] bg-primary/10 blur-3xl" aria-hidden="true"></div>
          <volt-card class="relative block overflow-hidden border-border bg-surface shadow-2xl">
            <volt-card-header class="flex flex-row items-center justify-between border-b border-border px-5 py-4">
              <span class="font-mono text-xs font-semibold text-foreground">.agentyx.json</span>
              <volt-badge variant="outline">desired state</volt-badge>
            </volt-card-header>
            <volt-card-content class="p-0"><pre class="overflow-x-auto p-5 text-sm leading-7 text-foreground sm:p-7"><code>{{ config }}</code></pre></volt-card-content>
            <div class="border-t border-border bg-muted/50 px-5 py-4 sm:px-7">
              <p class="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">One definition, native destinations</p>
              <div class="flex flex-wrap gap-2">
                <span class="inline-flex flex-col gap-0.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-bold">Codex <small class="text-[0.65rem] font-normal text-muted-foreground">.agents/skills</small></span>
                <span class="inline-flex flex-col gap-0.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-bold">Claude Code <small class="text-[0.65rem] font-normal text-muted-foreground">.claude/skills</small></span>
                <span class="inline-flex flex-col gap-0.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-bold">Kimi Code <small class="text-[0.65rem] font-normal text-muted-foreground">.agents/skills</small></span>
              </div>
            </div>
          </volt-card>
          <div class="relative -mt-4 ml-auto w-fit rounded-md border border-primary/30 bg-background px-4 py-2 font-mono text-xs text-primary shadow-lg sm:mr-5">
            $ pnpm dlx @agentyx/cli doctor
          </div>
        </div>
      </div>
    </section>
  `,
})
export class HeroComponent {
  readonly config = `{
  "packs": ["technical", "typescript", "efficiency"],
  "enable": ["rtk"],
  "targets": ["codex", "claude", "kimi"]
}`;
}

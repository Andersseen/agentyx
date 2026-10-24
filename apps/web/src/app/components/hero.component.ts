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
      <div class="relative mx-auto grid max-w-6xl min-w-0 items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
        <div class="min-w-0" moveInView="fade-up" [moveInViewMargin]="'0px'">
          <p class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary"><span class="h-2 w-2 rounded-full bg-success ring-4 ring-success/15" aria-hidden="true"></span> The project-local harness for coding agents</p>
          <h1 class="mt-7 max-w-3xl text-5xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Give every coding agent the <span class="text-primary">right environment.</span>
          </h1>
          <p class="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            Choose the packs your project needs. Agentyx installs their Skills, MCP setup and hooks for
            Codex, Claude Code, Kimi Code and Qwen Code, then shows you what is installed and what is
            actually observable.
          </p>
          <div class="mt-9 flex flex-wrap gap-3">
            <a voltButton href="#workflow" size="lg" [moveWhileTap]="{ scale: [1, 0.97, 1] }">
              See how it works <lmn-arrow-right class="h-4 w-4" aria-hidden="true" />
            </a>
            <a voltButton variant="outline" size="lg" href="/docs" [moveWhileTap]="{ scale: [1, 0.97, 1] }">
              Read the docs
            </a>
            <a
              voltButton
              variant="ghost"
              size="lg"
              href="https://github.com/Andersseen/agentyx"
              target="_blank"
              rel="noopener noreferrer"
              [moveWhileTap]="{ scale: [1, 0.97, 1] }"
            >
              <lmn-github class="h-4 w-4" aria-hidden="true" /> GitHub
            </a>
          </div>
          <volt-separator class="mt-12" />
          <dl class="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <div class="flex items-baseline gap-1.5">
              <dt>Built-in packs</dt>
              <dd class="font-bold text-foreground">17</dd>
            </div>
            <div class="flex items-baseline gap-1.5">
              <dt>Skills</dt>
              <dd class="font-bold text-foreground">66</dd>
            </div>
            <div class="flex items-baseline gap-1.5">
              <dt>MCP servers</dt>
              <dd class="font-bold text-foreground">7</dd>
            </div>
            <div class="flex items-baseline gap-1.5">
              <dt>Supported targets</dt>
              <dd class="font-bold text-foreground">4</dd>
            </div>
          </dl>
        </div>

        <div class="relative min-w-0" moveInView="fade-up" [moveInViewMargin]="'0px'">
          <div class="absolute -inset-7 rounded-[2rem] bg-primary/10 blur-3xl" aria-hidden="true"></div>
          <volt-card class="relative block overflow-hidden border-border bg-surface shadow-2xl">
            <volt-card-header class="flex flex-row items-center justify-between border-b border-border px-5 py-4">
              <span class="font-mono text-xs font-semibold text-foreground">.agentyx.json</span>
              <volt-badge variant="outline">desired state</volt-badge>
            </volt-card-header>
            <volt-card-content class="p-0"><pre class="overflow-x-auto p-5 text-sm leading-7 text-foreground sm:p-7"><code>{{ config }}</code></pre></volt-card-content>
            <div class="border-t border-border bg-muted/50 px-5 py-4 sm:px-7">
              <p class="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">One definition, native destinations</p>
              <ul class="flex flex-wrap gap-2">
                @for (target of targets; track target.name) {
                  <li class="inline-flex flex-col gap-0.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-bold">
                    {{ target.name }}
                    <small class="text-[0.65rem] font-normal text-muted-foreground">{{ target.skills }}</small>
                  </li>
                }
              </ul>
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
  "targets": ["codex", "claude", "kimi", "qwen"]
}`;

  /** Mirrors `data/providers.ts`; the hero shows only the Skill destination per target. */
  readonly targets = [
    { name: "Codex", skills: ".agents/skills" },
    { name: "Claude Code", skills: ".claude/skills" },
    { name: "Kimi Code", skills: ".agents/skills" },
    { name: "Qwen Code", skills: ".qwen/skills" },
  ];
}

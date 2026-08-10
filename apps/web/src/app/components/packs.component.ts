import { Component } from "@angular/core";
import {
  VoltBadge,
  VoltCard,
  VoltCardContent,
  VoltCardHeader,
  VoltCardTitle,
} from "@voltui/components";
import { MoveHoverDirective, MoveInViewDirective, MoveStaggerDirective } from "angular-movement";
import { LmnCodeBracketIcon } from "lumen-icons/code-bracket";
import { LmnCpuChipIcon } from "lumen-icons/cpu-chip";
import { LmnSparklesIcon } from "lumen-icons/sparkles";
import { LmnUsersIcon } from "lumen-icons/users";
import { LmnZapIcon } from "lumen-icons/zap";

interface Pack {
  name: string;
  category: string;
  purpose: string;
  icon: string;
  span: string;
}

@Component({
  selector: "app-packs",
  imports: [
    VoltCard,
    VoltCardContent,
    VoltCardHeader,
    VoltCardTitle,
    VoltBadge,
    LmnCodeBracketIcon,
    LmnCpuChipIcon,
    LmnSparklesIcon,
    LmnZapIcon,
    LmnUsersIcon,
    MoveHoverDirective,
    MoveInViewDirective,
    MoveStaggerDirective,
  ],
  template: `
    <section id="packs" class="section-band border-t border-border">
      <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <div class="mx-auto mb-12 max-w-3xl text-center" moveInView="fade-up" [moveInViewMargin]="'0px'">
        <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Composable packs
        </h2>
        <p class="mt-4 text-lg text-muted-foreground">
          Mix and match capability packs to match your project. Technology packs do not hide
          inheritance—select exactly what you need.
        </p>
      </div>

      <div
        class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[15rem]"
        moveInView="fade-up"
        [moveInViewMargin]="'0px'"
        moveStagger
        [moveStaggerStep]="0.08"
      >
        @for (pack of packs; track pack.name) {
          <volt-card class="pack-card h-full p-2 {{ pack.span }}" [moveWhileHover]="{ y: [0, -9], scale: [1, 1.012] }">
            <volt-card-header>
              <div class="flex items-center gap-3">
                @switch (pack.name) {
                  @case ("technical") {
                    <span class="icon-shell text-foreground">
                      <lmn-code-bracket class="h-5 w-5" aria-hidden="true" />
                    </span>
                  }
                  @case ("typescript") {
                    <span class="icon-shell text-info">
                      <lmn-cpu-chip class="h-5 w-5" aria-hidden="true" />
                    </span>
                  }
                  @case ("angular") {
                    <span class="icon-shell text-danger">
                      <lmn-sparkles class="h-5 w-5" aria-hidden="true" />
                    </span>
                  }
                  @case ("efficiency") {
                    <span class="icon-shell text-warning">
                      <lmn-zap class="h-5 w-5" aria-hidden="true" />
                    </span>
                  }
                  @case ("agentic") {
                    <span class="icon-shell text-secondary">
                      <lmn-users class="h-5 w-5" aria-hidden="true" />
                    </span>
                  }
                }
                <volt-card-title>{{ pack.name }}</volt-card-title>
              </div>
              <volt-badge variant="secondary" class="w-fit">{{ pack.category }}</volt-badge>
            </volt-card-header>
            <volt-card-content>
              <p class="text-muted-foreground">{{ pack.purpose }}</p>
            </volt-card-content>
          </volt-card>
        }
      </div>
      </div>
    </section>
  `,
})
export class PacksComponent {
  readonly packs: Pack[] = [
    {
      name: "technical",
      category: "engineering",
      purpose: "General engineering quality, API design, and code review.",
      icon: "code-bracket",
      span: "",
    },
    {
      name: "typescript",
      category: "language",
      purpose: "Strict, modeled, modern TypeScript practices.",
      icon: "cpu-chip",
      span: "",
    },
    {
      name: "angular",
      category: "framework",
      purpose: "Modern Angular APIs, signals, architecture, and testing.",
      icon: "sparkles",
      span: "",
    },
    {
      name: "efficiency",
      category: "efficiency",
      purpose: "Context-efficient exploration, output, iteration, and verification.",
      icon: "zap",
      span: "",
    },
    {
      name: "agentic",
      category: "workflow",
      purpose: "Brainstorming, planning, debugging, parallel and review flows.",
      icon: "users",
      span: "sm:col-span-2 lg:col-span-2",
    },
  ];
}

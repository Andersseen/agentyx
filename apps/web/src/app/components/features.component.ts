import { Component } from "@angular/core";
import { VoltCard, VoltCardDescription, VoltCardHeader, VoltCardTitle } from "@voltui/components";
import { MoveHoverDirective, MoveInViewDirective, MoveStaggerDirective } from "angular-movement";
import { LmnArrowPathRoundedSquareIcon } from "lumen-icons/arrow-path-rounded-square";
import { LmnBoltIcon } from "lumen-icons/bolt";
import { LmnCheckCircleIcon } from "lumen-icons/check-circle";
import { LmnCog6ToothIcon } from "lumen-icons/cog-6-tooth";
import { LmnCommandLineIcon } from "lumen-icons/command-line";

@Component({
  selector: "app-features",
  imports: [
    VoltCard,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
    LmnBoltIcon,
    LmnCommandLineIcon,
    LmnCog6ToothIcon,
    LmnCheckCircleIcon,
    LmnArrowPathRoundedSquareIcon,
    MoveHoverDirective,
    MoveInViewDirective,
    MoveStaggerDirective,
  ],
  template: `
    <section id="features" class="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <div class="mx-auto mb-12 max-w-3xl text-center" moveInView="fade-up" [moveInViewMargin]="'0px'">
        <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Built for agent workflows
        </h2>
        <p class="mt-4 text-lg text-muted-foreground">
          Define capabilities once, resolve them for any provider, and keep installation plans
          separate from filesystem writes.
        </p>
      </div>

      <div
        class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[14rem]"
        moveInView="fade-up"
        [moveInViewMargin]="'0px'"
        moveStagger
        [moveStaggerStep]="0.08"
      >
        <volt-card class="feature-card h-full p-2 lg:col-span-2" [moveWhileHover]="{ y: [0, -10], scale: [1, 1.012] }">
          <volt-card-header>
            <span class="icon-shell text-warning">
              <lmn-bolt class="h-5 w-5" aria-hidden="true" />
            </span>
            <volt-card-title>Native Skills</volt-card-title>
            <volt-card-description>
              Packs install as provider-native SKILL.md files so agents load relevant instructions
              on demand.
            </volt-card-description>
          </volt-card-header>
        </volt-card>

        <volt-card class="feature-card h-full p-2" [moveWhileHover]="{ y: [0, -10], scale: [1, 1.012] }">
          <volt-card-header>
            <span class="icon-shell text-info">
              <lmn-cog-6-tooth class="h-5 w-5" aria-hidden="true" />
            </span>
            <volt-card-title>MCP Servers</volt-card-title>
            <volt-card-description>
              Provider-neutral MCP definitions are configured only when a capability is selected
              and active.
            </volt-card-description>
          </volt-card-header>
        </volt-card>

        <volt-card class="feature-card h-full p-2" [moveWhileHover]="{ y: [0, -10], scale: [1, 1.012] }">
          <volt-card-header>
            <span class="icon-shell text-success">
              <lmn-check-circle class="h-5 w-5" aria-hidden="true" />
            </span>
            <volt-card-title>Doctor</volt-card-title>
            <volt-card-description>
              Inspect project health and detect local tools without running installers or editing
              PATH.
            </volt-card-description>
          </volt-card-header>
        </volt-card>

        <volt-card class="feature-card h-full p-2" [moveWhileHover]="{ y: [0, -10], scale: [1, 1.012] }">
          <volt-card-header>
            <span class="icon-shell text-secondary">
              <lmn-arrow-path-rounded-square class="h-5 w-5" aria-hidden="true" />
            </span>
            <volt-card-title>Resolve</volt-card-title>
            <volt-card-description>
              Resolve selected packs into concrete capabilities and preview what will be installed
              before writing anything.
            </volt-card-description>
          </volt-card-header>
        </volt-card>

        <volt-card class="feature-card h-full p-2 sm:col-span-2 lg:col-span-1" [moveWhileHover]="{ y: [0, -10], scale: [1, 1.012] }">
          <volt-card-header>
            <span class="icon-shell text-danger">
              <lmn-command-line class="h-5 w-5" aria-hidden="true" />
            </span>
            <volt-card-title>Install</volt-card-title>
            <volt-card-description>
              Generate installation plans and apply them to configured targets. Dry-run first, then
              commit the changes.
            </volt-card-description>
          </volt-card-header>
        </volt-card>
      </div>
    </section>
  `,
})
export class FeaturesComponent {}

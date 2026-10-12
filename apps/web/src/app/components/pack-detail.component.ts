import { Component, input } from "@angular/core";
import {
  VoltBadge,
  VoltCard,
  VoltCardContent,
  VoltCardDescription,
  VoltCardHeader,
  VoltCardTitle,
  VoltSeparator,
} from "@voltui/components";
import { MoveEnterDirective } from "angular-movement";
import type { Pack } from "../data/packs.js";

@Component({
  selector: "app-pack-detail",
  imports: [
    VoltBadge,
    VoltCard,
    VoltCardContent,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
    VoltSeparator,
    MoveEnterDirective,
  ],
  template: `
    <volt-card class="block min-h-[27rem] min-w-0 border-border shadow-lg" aria-live="polite">
      @for (item of [pack()]; track item.name) {
        <div moveEnter="fade-up" moveDuration="240ms">
          <volt-card-header class="p-6 pb-0">
            <div class="flex items-center justify-between gap-3"><p class="text-xs font-bold uppercase tracking-[0.15em] text-primary">SELECTED PACK</p><volt-badge variant="secondary">{{ item.category }}</volt-badge></div>
            <volt-card-title class="mt-5 font-mono text-3xl">{{ item.name }}</volt-card-title>
            <volt-card-description class="mt-2 text-base leading-7">{{ item.purpose }}</volt-card-description>
          </volt-card-header>
          <volt-card-content class="min-w-0 p-6">
            <volt-separator />
            <p class="mt-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">What it contributes</p>
            <p class="mt-3 text-sm leading-6 text-foreground">{{ item.includes }}</p>
            <div class="mt-7 min-w-0 rounded-md bg-muted p-4"><p class="mb-2 text-xs text-muted-foreground">Inspect the full definition</p><code class="block break-words text-xs text-foreground sm:text-sm">pnpm dlx @agentyx/cli pack show {{ item.name }}</code></div>
            <p class="mt-4 text-xs leading-5 text-muted-foreground">Optional MCP servers, tools and agents require explicit enablement.</p>
          </volt-card-content>
        </div>
      }
    </volt-card>
  `,
})
export class PackDetailComponent {
  readonly pack = input.required<Pack>();
}

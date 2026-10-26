import { Component, input } from "@angular/core";
import type { Pack } from "../data/packs.js";

@Component({
  selector: "app-pack-detail",
  template: `
    <div class="sheet min-h-[27rem] min-w-0 p-6" aria-live="polite">
      <div class="flex items-baseline justify-between gap-3">
        <p class="caption">selected pack</p>
        <p class="mono text-xs text-muted-foreground">{{ pack().category }}</p>
      </div>
      <h3 class="mono mt-4 text-3xl font-semibold text-foreground">{{ pack().name }}</h3>
      <p class="mt-2 text-base leading-7 text-muted-foreground">{{ pack().purpose }}</p>

      <p class="mt-6 text-sm font-semibold text-foreground">
        {{ pack().skills.length }} Skills, in resolution order
      </p>
      <ul class="mono mt-3 grid gap-1 text-[0.8125rem] text-foreground">
        @for (skill of pack().skills; track skill) {
          <li>{{ skill }}</li>
        }
      </ul>
      <p class="mt-4 text-sm leading-6 text-muted-foreground">{{ pack().includes }}</p>

      <div class="mt-6 min-w-0 border border-border bg-background p-4">
        <p class="mb-2 text-xs text-muted-foreground">Inspect the full definition</p>
        <code class="mono block break-words text-xs text-foreground sm:text-sm"
          >pnpm dlx &#64;agentyx/cli pack show {{ pack().name }}</code
        >
      </div>
      <p class="mt-4 text-xs leading-5 text-muted-foreground">
        Optional MCP servers, tools and agents require explicit enablement.
      </p>
    </div>
  `,
})
export class PackDetailComponent {
  readonly pack = input.required<Pack>();
}

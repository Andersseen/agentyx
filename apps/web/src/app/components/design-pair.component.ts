import { Component, input } from "@angular/core";
import { PACKS } from "../data/packs.js";

interface Lane {
  readonly name: string;
  readonly question: string;
  readonly scope: string;
  readonly exclusive: readonly string[];
}

const byName = (name: string) => PACKS.find((pack) => pack.name === name);
const uiSkills = byName("ui-ux")?.skills ?? [];
const creativeSkills = byName("creative-web")?.skills ?? [];
const shared = uiSkills.filter((skill) => creativeSkills.includes(skill));

/**
 * Two design packs, two different questions, one merge. The lanes show what each pack uniquely
 * contributes; the band below shows the Skills both declare, which `resolve --explain` reports once
 * with both origins. Derived from `data/packs.ts`, which a test checks against the core registry.
 */
@Component({
  selector: "app-design-pair",
  styles: `
    .lane {
      position: relative;
      padding-bottom: 2rem;
    }

    .lane::after {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 0;
      width: 2px;
      height: 2rem;
      background: var(--wire);
    }

    .merge {
      position: relative;
      margin-top: 0;
    }

    .merge::before {
      content: "";
      position: absolute;
      left: calc((100% - 1.5rem) / 4);
      right: calc((100% - 1.5rem) / 4);
      top: -1px;
      height: 2px;
      background: var(--wire);
    }

    @media (max-width: 47.99rem) {
      .merge::before {
        left: 50%;
        right: auto;
        width: 0;
      }
    }
  `,
  template: `
    <div class="grid gap-x-6 md:grid-cols-2" [class.gap-y-0]="true">
      @for (lane of lanes; track lane.name) {
        <section class="lane min-w-0" [attr.aria-labelledby]="'lane-' + lane.name">
          <div class="h-full border border-wire bg-background p-5 sm:p-6">
            <h3
              [id]="'lane-' + lane.name"
              class="mono text-lg font-semibold text-foreground"
            >
              {{ lane.name }}
            </h3>
            <p class="mt-3 text-xl font-semibold leading-snug tracking-tight text-foreground">
              {{ lane.question }}
            </p>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ lane.scope }}</p>
            <ul class="mono mt-5 grid gap-1.5 border-t border-border pt-4 text-[0.8125rem]">
              @for (skill of lane.exclusive; track skill) {
                <li class="text-foreground">{{ skill }}</li>
              }
            </ul>
          </div>
        </section>
      }
    </div>

    <div class="merge border border-dashed border-wire bg-background p-5 sm:p-6">
      <div class="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p class="text-sm font-semibold text-foreground">
            Shared Skills resolve once and keep both origins
          </p>
          <ul class="mono mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[0.8125rem] text-foreground">
            @for (skill of shared; track skill) {
              <li>{{ skill }}</li>
            }
          </ul>
        </div>
        @if (showCommand()) {
          <p class="mono text-xs leading-5 text-muted-foreground">
            agentyx resolve --explain<br />
            <span class="text-foreground">from ui-ux, creative-web</span>
          </p>
        }
      </div>
    </div>
  `,
})
export class DesignPairComponent {
  readonly showCommand = input(true);
  readonly shared = shared;

  readonly lanes: readonly Lane[] = [
    {
      name: "ui-ux",
      question: "Does the product behave well?",
      scope:
        "Usability, states, interaction, design-system consistency and product copy for apps, forms, dashboards and settings.",
      exclusive: uiSkills.filter((skill) => !shared.includes(skill)),
    },
    {
      name: "creative-web",
      question: "What should the site feel like?",
      scope:
        "A creative concept, composition, type, storytelling, motion and critique for marketing sites, launches and portfolios.",
      exclusive: creativeSkills.filter((skill) => !shared.includes(skill)),
    },
  ];
}

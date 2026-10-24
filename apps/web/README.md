# @agentyx/web

Official site for Agentyx: a marketing landing page, a pack catalogue, a provider compatibility
matrix, and the product documentation.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Landing: value proposition, workflow, doctor, provider teaser, interactive pack catalogue. |
| `/packs` | The full pack catalogue with per-pack detail. |
| `/providers` | The compatibility matrix: destinations and observability per provider, limits stated plainly. |
| `/docs/…` | Documentation region, rendered from Markdown by [`@doqs/analog`](https://www.npmjs.com/package/@doqs/analog). |

Documentation content lives in `src/content/docs/**.md` with `title`, `description`, `group` and
`order` frontmatter. It is the only place docs copy should be edited; the provider tables on
`/providers` are rendered from `src/app/data/providers.ts`, which mirrors
[`docs/compatibility.md`](../../docs/compatibility.md) in the repository root — keep the two in
agreement.

## Stack

- [AnalogJS](https://analogjs.org/) — Angular meta-framework, here in **SSG** mode (`ssr: true`,
  `static: true`), so every route is prerendered to static HTML at build time.
- Angular 21 with zoneless change detection.
- Tailwind CSS 4.
- [@doqs/analog](https://www.npmjs.com/package/@doqs/analog) — the documentation region: Markdown
  routes, sidebar, table of contents and code highlighting, wired as a lazy route so the landing page
  loads none of it.
- [@voltui/components](https://www.npmjs.com/package/@voltui/components), `angular-movement`,
  `lumen-icons`.

The site shell (`src/app/app.component.ts`) owns the header, footer and skip link so the
documentation region keeps the same navigation as the marketing pages. The shell renders no `<main>`:
each marketing page brings its own and Doqs renders one for the documentation region, so every route
has exactly one `main` landmark.

## Development

```sh
pnpm install
pnpm --filter @agentyx/web dev
```

## Verification

```sh
pnpm --filter @agentyx/web typecheck
pnpm --filter @agentyx/web e2e
```

The Playwright suite covers the landing page, the pack catalogue, the provider matrix and the
documentation region on desktop and mobile widths, including a horizontal-overflow check per route.

## Build

```sh
pnpm --filter @agentyx/web build
```

Output is written to `dist/analog/public` and is ready for Cloudflare Pages.

## Deploy to Cloudflare Pages

The build uses the `cloudflare-pages` Nitro preset. Connect the repository to Cloudflare Pages and set
the build command to:

```sh
pnpm --filter @agentyx/web build
```

Set the output directory to `apps/web/dist/analog/public`.

For a local preview of the Cloudflare Pages output, you can use [Wrangler](https://developers.cloudflare.com/workers/wrangler/):

```sh
npx wrangler pages dev apps/web/dist/analog/public
```

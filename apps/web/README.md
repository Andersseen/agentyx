# @agentyx/web

Official landing page for Agentyx.

## Stack

- [AnalogJS](https://analogjs.org/) — Angular meta-framework with SSG/Nitro
- Angular 21
- Tailwind CSS 4
- [@voltui/components](https://www.npmjs.com/package/@voltui/components)
- [angular-movement](https://www.npmjs.com/package/angular-movement)
- [lumen-icons](https://www.npmjs.com/package/lumen-icons)

## Development

```sh
pnpm install
pnpm --filter @agentyx/web dev
```

## Build

```sh
pnpm --filter @agentyx/web build
```

Output is written to `dist/analog/public` and is ready for Cloudflare Pages.

## Deploy to Cloudflare Pages

The build uses the `cloudflare-pages` Nitro preset. Connect the repository to Cloudflare Pages and set the build command to:

```sh
pnpm --filter @agentyx/web build
```

Set the output directory to `apps/web/dist/analog/public`.

For a local preview of the Cloudflare Pages output, you can use [Wrangler](https://developers.cloudflare.com/workers/wrangler/):

```sh
npx wrangler pages dev apps/web/dist/analog/public
```

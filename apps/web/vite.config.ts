import analog from "@analogjs/platform";
import { doqPrerenderRoutes } from "@doqs/analog/config";
import { doqDeterministicMarkdown } from "@doqs/analog/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { doqPaths } from "./src/doq.paths";

// https://analogjs.org/docs/features/deployment/providers
export default defineConfig(() => ({
  build: { target: ["es2022"] },
  resolve: { mainFields: ["module"] },
  plugins: [
    analog({
      // Documentation pages are Markdown, so they must be rendered at build time.
      ssr: true,
      static: true,
      content: { highlighter: "prism" },
      prerender: {
        routes: async () => ["/", "/packs", "/providers", ...doqPrerenderRoutes(doqPaths)],
      },
      include: ["/src/**/*.ts"],
      nitro: {
        // Static output ready for Cloudflare Pages.
        // See https://nitro.unjs.io/deploy/providers/cloudflare-pages
        preset: "cloudflare-pages",
      },
    }),
    // Analog renders Markdown concurrently while heading ids come from a shared slugger, so an
    // asynchronous highlighter can swap duplicate-heading suffixes between builds. Rendering one
    // file at a time keeps the output deterministic.
    doqDeterministicMarkdown(),
    tailwindcss(),
  ],
}));

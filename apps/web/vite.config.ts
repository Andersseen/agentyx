import analog from "@analogjs/platform";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://analogjs.org/docs/features/deployment/providers
export default defineConfig(() => ({
  plugins: [
    analog({
      ssr: false,
      prerender: {
        routes: ["/"],
      },
      include: ["/src/**/*.ts"],
      nitro: {
        // Static output ready for Cloudflare Pages.
        // See https://nitro.unjs.io/deploy/providers/cloudflare-pages
        preset: "cloudflare-pages",
      },
    }),
    tailwindcss(),
  ],
}));

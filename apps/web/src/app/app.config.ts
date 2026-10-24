import { provideFileRouter, requestContextInterceptor, withExtraRoutes } from "@analogjs/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { type ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";
import { provideClientHydration, withEventReplay } from "@angular/platform-browser";
import type { Route } from "@angular/router";
import { provideMovement } from "angular-movement";
import { doqPaths } from "../doq.paths";

/**
 * The documentation region is a lazy route: the landing page, which shares this application, loads
 * none of the Doqs components, the Markdown renderer or the syntax highlighter. The empty path
 * consumes nothing, so Doqs's own matchers still see the full URL; `canMatch` limits the region to
 * the documentation mount path. Nothing here imports Doqs or Analog's content package: both are
 * loaded with the region (see docs.routes.ts).
 */
const mountSegment = doqPaths.basePath.split("/").filter(Boolean)[0];
export const docsRoute: Route = {
  path: "",
  canMatch: [(_route, segments) => segments[0]?.path === mountSegment],
  loadChildren: () => import("./docs.routes").then((module) => module.docsRoutes),
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideFileRouter(withExtraRoutes([docsRoute])),
    provideHttpClient(withInterceptors([requestContextInterceptor])),
    provideClientHydration(withEventReplay()),
    provideMovement({
      duration: 420,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    }),
  ],
};

import { provideFileRouter } from "@analogjs/router";
import { type ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";
import { provideMovement } from "angular-movement";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideFileRouter(),
    provideMovement({
      duration: 420,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    }),
  ],
};

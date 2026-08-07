import { agnoxCoreName } from "@agnox/core";

export const agnoxAdaptersName = "agnox-adapters";

export function getAdaptersStatus(): string {
  return `${agnoxAdaptersName}:${agnoxCoreName}`;
}

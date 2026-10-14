import { createHash } from "node:crypto";
import { z } from "zod";

/** A SHA-256 digest of canonical or installed Agentyx-owned content. */
export const contentHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "Content hashes must be lowercase hexadecimal SHA-256 digests.");

/** Hashes UTF-8 text with the digest format used by manifest ownership. */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

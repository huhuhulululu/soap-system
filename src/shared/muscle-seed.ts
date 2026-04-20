/**
 * Deterministic muscle-selection seed derivation.
 *
 * Moved from src/generator/soap-generator.ts in Tier B step 1 Phase B1.2
 * to break the circular import between tx-sequence-engine.ts and
 * soap-generator.ts. Behaviour is identical to the original FNV-1a
 * hash — any drift will break the 30 fixture snapshots.
 */

import type { GenerationContext } from "../types";

/**
 * Derive a deterministic seed for muscle selection from context fields.
 *
 * Priority:
 * 1. If `context.seed` is a finite number, use it verbatim (preserves distinct
 *    streams for 0, 1, -1, etc.).
 * 2. Otherwise FNV-1a hash over (bodyPart, laterality, patterns, chronicity,
 *    pain, age, gender).
 *
 * The returned value is an unsigned 32-bit integer (`1` floor — never 0).
 */
export function objectiveMuscleSeed(context: GenerationContext): number {
  if (typeof context.seed === "number" && Number.isFinite(context.seed)) {
    return context.seed >>> 0;
  }
  const source = [
    context.primaryBodyPart,
    context.laterality || "bilateral",
    context.localPattern || "",
    context.systemicPattern || "",
    context.chronicityLevel || "",
    String(context.painCurrent ?? 8),
    String(context.age ?? 0),
    context.gender || "",
  ].join("|");
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

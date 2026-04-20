/**
 * Narrative map aliases for the renderer layer.
 *
 * These values are consumed by `src/generator/renderers/*.ts` when rendering
 * SOAP narrative text. LATERALITY_NAMES is defined inline; the other seven
 * are direct aliases of TEMPLATE_* constants from template-options.ts, kept
 * separate to give the renderer layer a stable import target even if the
 * underlying template-options schema evolves.
 *
 * Added in Tier B step 3 (W3 — 2026-04-20).
 */

import type { Laterality } from "../types";
import {
  TEMPLATE_TONE_MAP,
  TEMPLATE_ASSOCIATED_SYMPTOMS,
  TEMPLATE_SYMPTOM_SCALE,
  TEMPLATE_CAUSATIVE_CONNECTOR,
  TEMPLATE_NOT_IMPROVED,
  TEMPLATE_TENDERNESS_LABEL,
  TEMPLATE_INSPECTION_DEFAULT,
} from "./template-options";

export const LATERALITY_NAMES: Record<Laterality, string> = {
  left: "left",
  right: "right",
  bilateral: "bilateral",
  unspecified: "",
};

export const TONE_MAP = TEMPLATE_TONE_MAP;
export const ASSOCIATED_SYMPTOMS_MAP = TEMPLATE_ASSOCIATED_SYMPTOMS;
export const SYMPTOM_SCALE_MAP = TEMPLATE_SYMPTOM_SCALE;
export const CAUSATIVE_CONNECTOR_MAP = TEMPLATE_CAUSATIVE_CONNECTOR;
export const NOT_IMPROVED_MAP = TEMPLATE_NOT_IMPROVED;
export const TENDERNESS_LABEL_MAP = TEMPLATE_TENDERNESS_LABEL;
export const INSPECTION_DEFAULT_MAP = TEMPLATE_INSPECTION_DEFAULT;

import { describe, it, expect } from "vitest";
import { TCM_PATTERNS } from "../tcm-patterns";

describe("TCM_PATTERNS completeness", () => {
  const MDLAND_SYSTEMIC = [
    "Kidney Yang Deficiency", "Kidney Yin Deficiency", "Kidney Qi Deficiency",
    "LU & KI Deficiency", "Kidney Essence Deficiency", "Yin Deficiency Fire",
    "Qi Deficiency", "Blood Deficiency", "Qi & Blood Deficiency",
    "Phlegm-Damp", "Phlegm-Heat", "Liver Yang Rising",
    "LV/GB Fire", "LV/GB Damp-Heat", "Spleen Deficiency", "Damp-Heat",
    "ST & Intestine Damp-Heat", "Stomach Heat", "Food Retention",
    "Wei Qi Deficiency", "Ying & Wei Disharmony", "LU Wind-Heat",
    "Excessive Heat Flaring",
  ];

  for (const pattern of MDLAND_SYSTEMIC) {
    it(`has "${pattern}" defined`, () => {
      const found = TCM_PATTERNS[pattern];
      expect(found, `Missing: ${pattern}`).toBeDefined();
      expect(found.tongue.length).toBeGreaterThan(0);
      expect(found.pulse.length).toBeGreaterThan(0);
    });
  }

  const MDLAND_LOCAL = [
    "Qi Stagnation", "Blood Stasis", "Liver Qi Stagnation",
    "Blood Deficiency", "Qi & Blood Deficiency", "Wind-Cold Invasion",
    "Cold-Damp + Wind-Cold", "LV/GB Damp-Heat", "Phlegm-Damp",
    "Phlegm-Heat", "Damp-Heat",
  ];

  for (const pattern of MDLAND_LOCAL) {
    it(`has local "${pattern}" defined`, () => {
      const found = TCM_PATTERNS[pattern];
      expect(found, `Missing local: ${pattern}`).toBeDefined();
    });
  }
});

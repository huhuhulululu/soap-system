import { describe, it, expect } from "vitest";
import { deriveAssessmentFromSOA } from "../tx-sequence-engine";

const VALID_PRESENT = [
  "slight improvement of symptom(s).",
  "improvement of symptom(s).",
  "similar symptom(s) as last visit.",
  "exacerbate of symptom(s).",
  "no change.",
];
const VALID_PATIENT_CHANGE = [
  "decreased",
  "slightly decreased",
  "increased",
  "slight increased",
  "remained the same",
];
const VALID_WHAT_CHANGED = [
  "pain",
  "pain frequency",
  "pain duration",
  "numbness sensation",
  "muscles weakness",
  "muscles soreness sensation",
  "muscles stiffness sensation",
  "heaviness sensation",
  "difficulty in performing ADLs",
  "muscles soreness sensation",
  "severity level",
  "overall condition",
  "as last time visit",
  "dizziness",
  "headache",
  "migraine",
];
const VALID_PHYSICAL_CHANGE = [
  "reduced",
  "slightly reduced",
  "increased",
  "slight increased",
  "remained the same",
];
const VALID_FINDING_TYPE = [
  "local muscles tightness",
  "local muscles tenderness",
  "local muscles spasms",
  "local muscles trigger points",
  "joint ROM",
  "joint ROM limitation",
  "muscles strength",
  "joints swelling",
  "last visit",
];

const baseInput = {
  painDelta: 0.5,
  adlDelta: 0.3,
  frequencyImproved: false,
  visitIndex: 3,
  objectiveTightnessTrend: "slightly reduced" as const,
  objectiveTendernessTrend: "stable" as const,
  objectiveSpasmTrend: "stable" as const,
  objectiveRomTrend: "slightly improved" as const,
  objectiveStrengthTrend: "stable" as const,
  cumulativePainDrop: 2.0,
  progress: 0.5,
  bodyPart: "LBP",
  dimScore: 0.2,
  changedDims: ["pain"],
  symptomScaleChanged: false,
  severityChanged: false,
};

describe("deriveAssessmentFromSOA", () => {
  describe("ASS-01: specific improvements in whatChanged", () => {
    it('selects "pain frequency" when frequency improved (hard rule preserved)', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        frequencyImproved: true,
      });
      // REAL-01: whatChanged may be combined, but must contain "pain frequency"
      expect(result.whatChanged).toContain("pain frequency");
    });

    it("selects ADL-related option when adlDelta is dominant", () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        adlDelta: 0.8,
        painDelta: 0.2,
        frequencyImproved: false,
      });
      // REAL-01: whatChanged may be combined; each part must be valid
      const parts = result.whatChanged.split(/ and |, /).map((p) => p.trim());
      expect(
        parts.some((p) =>
          [
            "difficulty in performing ADLs",
            "muscles soreness sensation",
            "muscles stiffness sensation",
          ].includes(p),
        ),
      ).toBe(true);
    });

    it("selects objective-related option when objective trends are strong and pain/adl weak", () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        painDelta: 0.1,
        adlDelta: 0.05,
        frequencyImproved: false,
        objectiveRomTrend: "improved",
        objectiveTightnessTrend: "reduced",
      });
      // With no S-side signals, only O-side improved → fallback to "overall condition"
      expect(result.whatChanged).toBe("overall condition");
    });

    it('falls back to "pain" when no strong signal', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        painDelta: 0.4,
        adlDelta: 0.1,
        frequencyImproved: false,
        objectiveRomTrend: "stable",
        objectiveTightnessTrend: "stable",
        objectiveStrengthTrend: "stable",
      });
      expect(result.whatChanged).toBe("pain");
    });

    it('findingType uses "joint ROM" at late progress with cumulative evidence', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: "improved",
        progress: 0.75,
        cumulativePainDrop: 3.0,
      });
      expect(result.findingType).toContain("joint ROM");
      // Should NOT say "limitation" at late progress with strong cumulative
      expect(result.findingType).not.toContain("limitation");
    });

    it('findingType uses "joint ROM limitation" at early progress', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: "improved",
        progress: 0.2,
        cumulativePainDrop: 0.5,
      });
      expect(result.findingType).toContain("joint ROM limitation");
    });
  });

  describe("ASS-02: cumulative progress gates language strength", () => {
    it('uses "improvement" + "decreased" for high cumulative at late progress', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        cumulativePainDrop: 4.0,
        progress: 0.75,
        painDelta: 0.3,
      });
      expect(result.present).toBe("improvement of symptom(s).");
      expect(result.patientChange).toBe("decreased");
    });

    it('uses "slight improvement" + "slightly decreased" for low cumulative at early progress', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        cumulativePainDrop: 0.5,
        progress: 0.15,
        painDelta: 0.3,
      });
      expect(result.present).toBe("slight improvement of symptom(s).");
      expect(result.patientChange).toBe("slightly decreased");
    });

    it('strong visit-level dimScore upgrades to "improvement" regardless of cumulative', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        cumulativePainDrop: 1.0,
        progress: 0.2,
        painDelta: 0.8,
        dimScore: 0.4,
        changedDims: ["pain"],
      });
      expect(result.present).toBe("improvement of symptom(s).");
      expect(result.patientChange).toBe("decreased");
    });

    it('mid-progress with moderate cumulative but weak visit delta uses "slight"', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        cumulativePainDrop: 2.0,
        progress: 0.45,
        painDelta: 0.2,
      });
      expect(result.present).toBe("slight improvement of symptom(s).");
      expect(result.patientChange).toBe("slightly decreased");
    });
  });

  describe("ASS-03: all values from template options", () => {
    it("all returned values are from valid template options across varied inputs", () => {
      const inputs = [
        baseInput,
        {
          ...baseInput,
          painDelta: 0,
          adlDelta: 0,
          cumulativePainDrop: 0,
          progress: 0.1,
        },
        { ...baseInput, painDelta: 1.5, cumulativePainDrop: 5, progress: 0.9 },
        { ...baseInput, frequencyImproved: true, progress: 0.3 },
        {
          ...baseInput,
          objectiveRomTrend: "stable" as const,
          objectiveTightnessTrend: "stable" as const,
          objectiveStrengthTrend: "stable" as const,
          objectiveTendernessTrend: "stable" as const,
          objectiveSpasmTrend: "stable" as const,
        },
        { ...baseInput, objectiveStrengthTrend: "improved" as const },
        { ...baseInput, objectiveTendernessTrend: "reduced" as const },
        { ...baseInput, objectiveSpasmTrend: "reduced" as const },
      ];
      for (const input of inputs) {
        const result = deriveAssessmentFromSOA(input);
        expect(VALID_PRESENT).toContain(result.present);
        expect(VALID_PATIENT_CHANGE).toContain(result.patientChange);
        // REAL-01: whatChanged can be combined; validate each part
        const whatParts = result.whatChanged
          .split(/ and |, /)
          .map((p) => p.trim());
        for (const part of whatParts) {
          expect(VALID_WHAT_CHANGED).toContain(part);
        }
        expect(VALID_PHYSICAL_CHANGE).toContain(result.physicalChange);
        // REAL-02: findingType can be combined; validate each part
        const findingParts = result.findingType
          .split(/ and |, /)
          .map((p) => p.trim());
        for (const part of findingParts) {
          expect(VALID_FINDING_TYPE).toContain(part);
        }
      }
    });
  });

  describe("physicalChange and findingType edge cases", () => {
    it('all objective stable → "remained the same" + fallback findingType', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: "stable",
        objectiveStrengthTrend: "stable",
        objectiveTightnessTrend: "stable",
        objectiveTendernessTrend: "stable",
        objectiveSpasmTrend: "stable",
      });
      expect(result.physicalChange).toBe("remained the same");
      expect(result.findingType).toBe("joint ROM limitation");
    });

    it('only slight objective improvement → "slightly reduced"', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: "slightly improved",
        objectiveStrengthTrend: "stable",
        objectiveTightnessTrend: "stable",
        objectiveTendernessTrend: "stable",
        objectiveSpasmTrend: "stable",
      });
      expect(result.physicalChange).toBe("slightly reduced");
    });

    it('strength trend non-stable → findingType "muscles strength"', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: "stable",
        objectiveStrengthTrend: "improved",
      });
      expect(result.findingType).toContain("muscles strength");
    });
  });

  describe("REAL-02: findingType lists ALL changed dimensions", () => {
    it("ROM + Strength + Tightness all changed → findingType mentions all three", () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: "improved",
        objectiveStrengthTrend: "improved",
        objectiveTightnessTrend: "reduced",
        objectiveTendernessTrend: "stable",
        objectiveSpasmTrend: "stable",
        progress: 0.3,
        cumulativePainDrop: 1.0,
      });
      expect(result.findingType).toContain("joint ROM");
      expect(result.findingType).toContain("muscles strength");
      expect(result.findingType).toContain("local muscles tightness");
    });

    it("ROM + Tenderness changed → findingType mentions both", () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: "slightly improved",
        objectiveStrengthTrend: "stable",
        objectiveTightnessTrend: "stable",
        objectiveTendernessTrend: "reduced",
        objectiveSpasmTrend: "stable",
        progress: 0.5,
        cumulativePainDrop: 2.0,
      });
      expect(result.findingType).toContain("joint ROM");
      expect(result.findingType).toContain("local muscles tenderness");
    });

    it("all five dimensions changed → findingType mentions all", () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: "improved",
        objectiveStrengthTrend: "improved",
        objectiveTightnessTrend: "reduced",
        objectiveTendernessTrend: "reduced",
        objectiveSpasmTrend: "reduced",
        progress: 0.7,
        cumulativePainDrop: 3.0,
      });
      expect(result.findingType).toContain("joint ROM");
      expect(result.findingType).toContain("muscles strength");
      expect(result.findingType).toContain("local muscles tightness");
      expect(result.findingType).toContain("local muscles tenderness");
      expect(result.findingType).toContain("local muscles spasms");
    });

    it("single dimension changed → findingType is just that one", () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: "stable",
        objectiveStrengthTrend: "stable",
        objectiveTightnessTrend: "reduced",
        objectiveTendernessTrend: "stable",
        objectiveSpasmTrend: "stable",
      });
      expect(result.findingType).toBe("local muscles tightness");
    });
  });

  describe("Task 4: dimScore + symptomScale/severity integration", () => {
    it('dimScore=0 → present contains "similar"', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        painDelta: 0,
        adlDelta: 0,
        frequencyImproved: false,
        objectiveTightnessTrend: "stable",
        objectiveTendernessTrend: "stable",
        objectiveSpasmTrend: "stable",
        objectiveRomTrend: "stable",
        objectiveStrengthTrend: "stable",
        cumulativePainDrop: 0,
        progress: 0.3,
        dimScore: 0,
        changedDims: [],
        symptomScaleChanged: false,
        severityChanged: false,
      });
      expect(result.present).toContain("similar");
    });

    it('dimScore>=0.3 → present contains "improvement"', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        painDelta: 1.0,
        adlDelta: 0.3,
        frequencyImproved: true,
        objectiveTightnessTrend: "reduced",
        objectiveTendernessTrend: "stable",
        objectiveSpasmTrend: "stable",
        objectiveRomTrend: "improved",
        objectiveStrengthTrend: "stable",
        cumulativePainDrop: 3.0,
        progress: 0.5,
        dimScore: 0.4,
        changedDims: ["pain", "frequency", "tightness", "ROM"],
        symptomScaleChanged: true,
        severityChanged: false,
      });
      expect(result.present).toContain("improvement");
      expect(result.present).not.toContain("similar");
    });

    it('symptomScaleChanged → whatChanged contains "muscles soreness sensation"', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        painDelta: 0.5,
        adlDelta: 0,
        frequencyImproved: false,
        objectiveTightnessTrend: "stable",
        objectiveTendernessTrend: "stable",
        objectiveSpasmTrend: "stable",
        objectiveRomTrend: "stable",
        objectiveStrengthTrend: "stable",
        cumulativePainDrop: 1.0,
        progress: 0.3,
        dimScore: 0.2,
        changedDims: ["pain", "symptomScale"],
        symptomScaleChanged: true,
        severityChanged: false,
      });
      expect(result.whatChanged).toContain("soreness");
    });

    it("多维度变化 → whatChanged lists all S-side changes", () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        painDelta: 1.0,
        adlDelta: 0.3,
        frequencyImproved: true,
        objectiveTightnessTrend: "reduced",
        objectiveTendernessTrend: "reduced",
        objectiveSpasmTrend: "stable",
        objectiveRomTrend: "improved",
        objectiveStrengthTrend: "stable",
        cumulativePainDrop: 3.0,
        progress: 0.5,
        dimScore: 0.5,
        changedDims: [
          "pain",
          "frequency",
          "ADL",
          "tightness",
          "tenderness",
          "ROM",
        ],
        symptomScaleChanged: true,
        severityChanged: true,
      });
      // whatChanged should contain multiple S-side dimensions
      expect(result.whatChanged).toContain("pain");
      expect(result.whatChanged).toContain("frequency");
      // should not be limited to 1-2 items
      const commaCount = (result.whatChanged.match(/,/g) || []).length;
      expect(commaCount).toBeGreaterThanOrEqual(1); // at least 2 items comma-separated
    });
  });
});

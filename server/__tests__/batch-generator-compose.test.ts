/**
 * TDD tests for generateTXSeries "compose mode" refactor.
 *
 * Target behaviour after refactor:
 *   generateTXSequenceStates() → per-state loop:
 *     exportSOAP(ctx, state, "text") + patchSOAPText() + exportSOAP(ctx, state, "html")
 *
 * Tests marked "RED (pre-refactor)" will fail until the refactor lands;
 * tests marked "GREEN" validate existing behaviour that must be preserved.
 */

import { generateBatch } from "../services/batch-generator";
import * as objectivePatch from "../../src/generator/objective-patch";
import type {
  BatchData,
  BatchPatient,
  BatchPatientClinical,
  BatchVisit,
} from "../types";

// ── helpers (same shape as sibling test files) ──────────────────────

function makeClinical(
  overrides: Partial<BatchPatientClinical> = {},
): BatchPatientClinical {
  return {
    painWorst: 8,
    painBest: 3,
    painCurrent: 6,
    severityLevel: "moderate",
    symptomDuration: { value: "3", unit: "year(s)" },
    painRadiation: "without radiation",
    painTypes: ["Dull", "Aching"],
    associatedSymptoms: ["soreness"],
    causativeFactors: ["age related/degenerative changes"],
    relievingFactors: ["Changing positions", "Resting", "Massage"],
    symptomScale: "70%-80%",
    painFrequency:
      "Constant (symptoms occur between 76% and 100% of the time)",
    chronicityLevel: "Chronic",
    recentWorse: { value: "1", unit: "week(s)" },
    ...overrides,
  };
}

function makeVisit(overrides: Partial<BatchVisit> = {}): BatchVisit {
  return {
    index: 0,
    dos: 1,
    noteType: "IE",
    txNumber: null,
    bodyPart: "LBP",
    laterality: "bilateral",
    secondaryParts: [],
    history: [],
    icdCodes: [{ code: "M54.50", name: "Low back pain, unspecified" }],
    cptCodes: [
      { code: "97810", name: "ACUP 1/> WO ESTIM 1ST 15 MIN", units: 1 },
    ],
    generated: null,
    status: "pending",
    ...overrides,
  };
}

function makePatient(overrides: Partial<BatchPatient> = {}): BatchPatient {
  return {
    name: "TEST,COMPOSE",
    dob: "01/01/1960",
    age: 65,
    gender: "Female",
    insurance: "HF",
    clinical: makeClinical(),
    visits: [makeVisit()],
    seed: 12345,
    ...overrides,
  };
}

function makeBatch(patients: BatchPatient[]): BatchData {
  return {
    batchId: "test_batch_compose",
    createdAt: new Date().toISOString(),
    mode: "full",
    confirmed: false,
    patients,
    summary: {
      totalPatients: patients.length,
      totalVisits: patients.reduce((sum, p) => sum + p.visits.length, 0),
      byType: {},
    },
  };
}

/** Build a standard IE + N×TX visit list */
function makeIEAndTXVisits(txCount: number): BatchVisit[] {
  const visits: BatchVisit[] = [
    makeVisit({ index: 0, dos: 1, noteType: "IE", txNumber: null }),
  ];
  for (let i = 0; i < txCount; i++) {
    visits.push(
      makeVisit({
        index: i + 1,
        dos: i + 2,
        noteType: "TX",
        txNumber: i + 1,
      }),
    );
  }
  return visits;
}

/** Extract ROM degree numbers from SOAP text (e.g. "4/5 Flexion: 40 Degrees") */
function extractROMDegrees(text: string): number[] {
  const pattern = /^\d[+-]?\/5\s+.+?:\s+(\d+)\s+(?:Degrees|degree)/gim;
  const degrees: number[] = [];
  for (const line of text.split("\n")) {
    const m = pattern.exec(line.trim());
    if (m) {
      degrees.push(parseInt(m[1]));
    }
    pattern.lastIndex = 0;
  }
  return degrees;
}

// ── tests ───────────────────────────────────────────────────────────

describe("batch-generator compose mode", () => {
  describe("TX series basic generation", () => {
    it("generates text + html for each TX visit (GREEN)", () => {
      const visits = makeIEAndTXVisits(3);
      const batch = makeBatch([makePatient({ visits })]);
      const result = generateBatch(batch);

      expect(result.totalGenerated).toBe(4); // 1 IE + 3 TX
      expect(result.totalFailed).toBe(0);

      const txVisits = result.patients[0].visits.filter(
        (v) => v.noteType === "TX",
      );
      expect(txVisits).toHaveLength(3);

      for (const visit of txVisits) {
        expect(visit.status).toBe("done");
        expect(visit.generated).not.toBeNull();
        // text SOAP sections
        expect(visit.generated!.soap.subjective).toBeTruthy();
        expect(visit.generated!.soap.objective).toBeTruthy();
        expect(visit.generated!.soap.assessment).toBeTruthy();
        expect(visit.generated!.soap.plan).toBeTruthy();
        // html sections
        expect(visit.generated!.html).toBeDefined();
        expect(visit.generated!.html!.subjective).toBeTruthy();
        expect(visit.generated!.html!.objective).toBeTruthy();
        expect(visit.generated!.html!.assessment).toBeTruthy();
        expect(visit.generated!.html!.plan).toBeTruthy();
      }
    });
  });

  describe("realisticPatch propagation to TX", () => {
    let patchSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
      patchSpy = jest.spyOn(objectivePatch, "patchSOAPText");
    });

    afterEach(() => {
      patchSpy.mockRestore();
    });

    it("calls patchSOAPText for TX visits when realisticPatch=true (RED — pre-refactor)", () => {
      const visits = makeIEAndTXVisits(2);
      const batch = makeBatch([makePatient({ visits })]);
      generateBatch(batch, /* realisticPatch */ true);

      // After refactor: patchSOAPText should be called for each TX visit
      // IE calls patchSOAPText (1 call), so total should be 1 IE + 2 TX = 3
      expect(patchSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it("does NOT call patchSOAPText for TX when realisticPatch=false (GREEN)", () => {
      const visits = makeIEAndTXVisits(2);
      const batch = makeBatch([makePatient({ visits })]);
      generateBatch(batch, /* realisticPatch */ false);

      // Without realisticPatch, no calls at all
      expect(patchSpy).not.toHaveBeenCalled();
    });
  });

  describe("romFloors monotonicity", () => {
    it("ROM degrees never decrease across sequential TX visits (GREEN)", () => {
      const visits = makeIEAndTXVisits(5);
      const batch = makeBatch([makePatient({ visits, seed: 42 })]);
      const result = generateBatch(batch);

      const txVisits = result.patients[0].visits.filter(
        (v) => v.noteType === "TX",
      );

      // Collect per-movement ROM floors across visits
      const movementFloors: Record<string, number[]> = {};
      const romPattern =
        /^\d[+-]?\/5\s+(.+?):\s+(\d+)\s+(?:Degrees|degree)/gim;

      for (const visit of txVisits) {
        const text = visit.generated!.fullText;
        for (const line of text.split("\n")) {
          const m = romPattern.exec(line.trim());
          if (m) {
            const movement = m[1];
            const degrees = parseInt(m[2]);
            if (!movementFloors[movement]) {
              movementFloors[movement] = [];
            }
            movementFloors[movement].push(degrees);
          }
          romPattern.lastIndex = 0;
        }
      }

      // For each movement, degrees should be monotonically non-decreasing
      for (const [movement, values] of Object.entries(movementFloors)) {
        for (let i = 1; i < values.length; i++) {
          expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
        }
      }

      // Sanity: we should have found at least some ROM data
      expect(Object.keys(movementFloors).length).toBeGreaterThan(0);
    });
  });

  describe("GATE-01 ELDERPLAN annotation", () => {
    it("includes NCD 30.3.3 Phase Gate annotation at visit 12 for ELDERPLAN (GREEN)", () => {
      // Need at least 12 TX visits to reach visitIndex 12
      const visits = makeIEAndTXVisits(13);
      const batch = makeBatch([
        makePatient({
          insurance: "ELDERPLAN",
          visits,
          seed: 400001,
        }),
      ]);
      const result = generateBatch(batch);

      const allVisits = result.patients[0].visits;
      // Visit 12 is the TX with txNumber=12 (index=12)
      const visit12 = allVisits.find(
        (v) => v.noteType === "TX" && v.txNumber === 12,
      );
      expect(visit12).toBeDefined();
      expect(visit12!.generated).not.toBeNull();
      expect(visit12!.generated!.fullText).toContain("NCD 30.3.3 Phase Gate");
      expect(visit12!.generated!.fullText).toContain("Baseline Pain");
      expect(visit12!.generated!.fullText).toContain("Cumulative Improvement");
    });

    it("does NOT include Phase Gate annotation for non-ELDERPLAN (GREEN)", () => {
      const visits = makeIEAndTXVisits(13);
      const batch = makeBatch([
        makePatient({
          insurance: "HF",
          visits,
          seed: 400002,
        }),
      ]);
      const result = generateBatch(batch);

      const allVisits = result.patients[0].visits;
      for (const visit of allVisits) {
        if (visit.generated) {
          expect(visit.generated.fullText).not.toContain(
            "NCD 30.3.3 Phase Gate",
          );
        }
      }
    });
  });

  describe("IE generation unaffected", () => {
    it("IE visit generates independently with correct SOAP sections (GREEN)", () => {
      const visits = makeIEAndTXVisits(2);
      const batch = makeBatch([makePatient({ visits })]);
      const result = generateBatch(batch);

      const ieVisit = result.patients[0].visits.find(
        (v) => v.noteType === "IE",
      );
      expect(ieVisit).toBeDefined();
      expect(ieVisit!.status).toBe("done");
      expect(ieVisit!.generated).not.toBeNull();

      const text = ieVisit!.generated!.fullText;
      expect(text).toContain("Subjective");
      expect(text).toContain("Objective");
      expect(text).toContain("Assessment");
      expect(text).toContain("Plan");
      // IE should NOT contain TX-specific markers
      expect(text).toContain("Initial Evaluation");
      expect(text).not.toContain("DAILY NOTE");
    });

    it("IE realisticPatch still works when TX refactored (GREEN)", () => {
      const patchSpy = jest.spyOn(objectivePatch, "patchSOAPText");

      const visits = makeIEAndTXVisits(1);
      const batch = makeBatch([makePatient({ visits })]);
      generateBatch(batch, /* realisticPatch */ true);

      // IE should call patchSOAPText at least once
      const ieCalls = patchSpy.mock.calls.filter((_call: unknown[]) => {
        // patchSOAPText(text, context) — context.noteType === "IE"
        const ctx = _call[1] as { noteType?: string } | undefined;
        return ctx?.noteType === "IE";
      });
      expect(ieCalls.length).toBeGreaterThanOrEqual(1);

      patchSpy.mockRestore();
    });
  });
});

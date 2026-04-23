/**
 * TDD RED tests for server/services/soap-producer.ts
 *
 * produceSinglePatient() — server-side SOAP production pipeline
 * that mirrors the worker (soap-engine.worker.ts) logic:
 *   normalizeGenerationContext → generateTXSequenceStates
 *   → exportSOAPAsText / exportSOAP(html) → patchSOAPText → splitSOAPText
 */
import type { NormalizeInput } from "../../src/shared/normalize-generation-context";
import {
  produceSinglePatient,
  type ProduceRequest,
  type ProduceResult,
  type ProduceNote,
} from "../services/soap-producer";

/* ------------------------------------------------------------------ */
/*  Shared fixture                                                     */
/* ------------------------------------------------------------------ */

function makeInput(overrides: Partial<NormalizeInput> = {}): NormalizeInput {
  return {
    noteType: "TX",
    insuranceType: "HF",
    primaryBodyPart: "LBP",
    laterality: "bilateral",
    painCurrent: 7,
    severityLevel: "moderate",
    chronicityLevel: "Chronic",
    painTypes: ["Dull", "Aching"],
    associatedSymptoms: ["soreness"],
    symptomScale: "70%-80%",
    painFrequency:
      "Constant (symptoms occur between 76% and 100% of the time)",
    age: 55,
    gender: "Female",
    ...overrides,
  };
}

function makeRequest(
  overrides: Omit<Partial<ProduceRequest>, "input"> & {
    input?: Partial<NormalizeInput>;
  } = {},
): ProduceRequest {
  const { input: inputOverrides, ...rest } = overrides;
  return {
    input: makeInput(inputOverrides),
    txCount: 3,
    seed: 42,
    realisticPatch: false,
    ...rest,
  };
}

/* ------------------------------------------------------------------ */
/*  1. TX 模式基本生成                                                  */
/* ------------------------------------------------------------------ */

describe("produceSinglePatient", () => {
  describe("TX mode basic generation", () => {
    it("returns exactly txCount TX notes", () => {
      const result = produceSinglePatient(makeRequest({ txCount: 3 }));

      expect(result.notes).toHaveLength(3);
      result.notes.forEach((note) => {
        expect(note.type).toBe("TX");
      });
    });

    it("each TX note has text, soap, and html fields", () => {
      const result = produceSinglePatient(makeRequest({ txCount: 3 }));

      result.notes.forEach((note) => {
        expect(typeof note.text).toBe("string");
        expect(note.text.length).toBeGreaterThan(0);
        expect(note.soap).toBeDefined();
        expect(note.html).toBeDefined();
      });
    });

    it("returns a numeric seed", () => {
      const result = produceSinglePatient(makeRequest());

      expect(typeof result.seed).toBe("number");
    });
  });

  /* ---------------------------------------------------------------- */
  /*  2. IE 模式生成                                                    */
  /* ---------------------------------------------------------------- */

  describe("IE mode generation", () => {
    it("returns 1 IE + txCount TX notes when noteType=IE", () => {
      const result = produceSinglePatient(
        makeRequest({
          input: { noteType: "IE" },
          txCount: 3,
        }),
      );

      expect(result.notes).toHaveLength(4);
      expect(result.notes[0].type).toBe("IE");
      expect(result.notes[0].visitIndex).toBe(0);

      const txNotes = result.notes.filter((n) => n.type === "TX");
      expect(txNotes).toHaveLength(3);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  3. seed 复现                                                      */
  /* ---------------------------------------------------------------- */

  describe("seed reproducibility", () => {
    it("same input + same seed → identical output", () => {
      const req = makeRequest({ seed: 12345 });
      const a = produceSinglePatient(req);
      const b = produceSinglePatient(req);

      expect(a.seed).toBe(b.seed);
      expect(a.notes.length).toBe(b.notes.length);
      a.notes.forEach((noteA, i) => {
        expect(noteA.text).toBe(b.notes[i].text);
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /*  4. realisticPatch                                                */
  /* ---------------------------------------------------------------- */

  describe("realisticPatch", () => {
    it("produces different text when realisticPatch=true vs false", () => {
      const base = { seed: 99, txCount: 1 };
      const withPatch = produceSinglePatient(
        makeRequest({ ...base, realisticPatch: true }),
      );
      const withoutPatch = produceSinglePatient(
        makeRequest({ ...base, realisticPatch: false }),
      );

      // patchSOAPText modifies Objective ROM/Strength values,
      // so at least one note's text should differ
      const patchedText = withPatch.notes[0].text;
      const plainText = withoutPatch.notes[0].text;
      expect(patchedText).not.toBe(plainText);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  5. TX HTML 带 ppnSelectCombo                                     */
  /* ---------------------------------------------------------------- */

  describe("TX HTML contains ppnSelectCombo", () => {
    it("TX notes html has ppnSelectCombo class in at least one section", () => {
      const result = produceSinglePatient(makeRequest({ txCount: 1 }));
      const txNote = result.notes[0];

      const allHtml = [
        txNote.html.subjective,
        txNote.html.objective,
        txNote.html.assessment,
        txNote.html.plan,
      ].join("");

      expect(allHtml).toContain("ppnSelectCombo");
    });
  });

  /* ---------------------------------------------------------------- */
  /*  6. IE HTML 纯 p 标签                                             */
  /* ---------------------------------------------------------------- */

  describe("IE HTML uses plain p tags", () => {
    it("IE note html contains <p> and does not contain ppnSelectCombo", () => {
      const result = produceSinglePatient(
        makeRequest({
          input: { noteType: "IE" },
          txCount: 1,
        }),
      );
      const ieNote = result.notes[0];
      expect(ieNote.type).toBe("IE");

      const allHtml = [
        ieNote.html.subjective,
        ieNote.html.objective,
        ieNote.html.assessment,
        ieNote.html.plan,
      ].join("");

      expect(allHtml).toContain("<p>");
      expect(allHtml).not.toContain("ppnSelectCombo");
    });
  });

  /* ---------------------------------------------------------------- */
  /*  7. SOAP 四段完整                                                  */
  /* ---------------------------------------------------------------- */

  describe("SOAP four sections completeness", () => {
    it("every note has non-empty subjective/objective/assessment/plan in soap", () => {
      const result = produceSinglePatient(
        makeRequest({
          input: { noteType: "IE" } as Partial<NormalizeInput>,
          txCount: 2,
        }),
      );

      result.notes.forEach((note) => {
        expect(note.soap.subjective.length).toBeGreaterThan(0);
        expect(note.soap.objective.length).toBeGreaterThan(0);
        expect(note.soap.assessment.length).toBeGreaterThan(0);
        expect(note.soap.plan.length).toBeGreaterThan(0);
      });
    });

    it("every note has non-empty subjective/objective/assessment/plan in html", () => {
      const result = produceSinglePatient(
        makeRequest({
          input: { noteType: "IE" } as Partial<NormalizeInput>,
          txCount: 2,
        }),
      );

      result.notes.forEach((note) => {
        expect(note.html.subjective.length).toBeGreaterThan(0);
        expect(note.html.objective.length).toBeGreaterThan(0);
        expect(note.html.assessment.length).toBeGreaterThan(0);
        expect(note.html.plan.length).toBeGreaterThan(0);
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /*  8. startVisitIndex                                               */
  /* ---------------------------------------------------------------- */

  describe("startVisitIndex", () => {
    it("first TX visitIndex equals startVisitIndex", () => {
      const result = produceSinglePatient(
        makeRequest({ txCount: 7, startVisitIndex: 5 }),
      );

      expect(result.notes[0].visitIndex).toBe(5);
    });

    it("visitIndex increments from startVisitIndex", () => {
      const result = produceSinglePatient(
        makeRequest({ txCount: 7, startVisitIndex: 5 }),
      );

      expect(result.notes[0].visitIndex).toBe(5);
      expect(result.notes[1].visitIndex).toBe(6);
      expect(result.notes[2].visitIndex).toBe(7);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  9. ROM 单调递增 (12 TX)                                          */
  /* ---------------------------------------------------------------- */

  describe("ROM monotonic non-decreasing over 12 TX", () => {
    it("ROM degrees never decrease across visits", () => {
      const result = produceSinglePatient(
        makeRequest({ txCount: 12, seed: 777 }),
      );

      // Extract ROM degrees from Objective text of each note.
      // ROM lines look like: "... Flexion 102°" or "Flexion: 102 degrees"
      const degreePattern = /(\d+)\s*°/g;

      let prevDegrees: number[] = [];
      for (const note of result.notes) {
        const matches = [...note.soap.objective.matchAll(degreePattern)];
        const degrees = matches.map((m) => parseInt(m[1], 10));

        if (prevDegrees.length > 0 && degrees.length > 0) {
          // Compare sum of degrees — overall ROM should not regress
          const prevSum = prevDegrees.reduce((a, b) => a + b, 0);
          const currSum = degrees.reduce((a, b) => a + b, 0);
          expect(currSum).toBeGreaterThanOrEqual(prevSum);
        }

        if (degrees.length > 0) {
          prevDegrees = degrees;
        }
      }
    });
  });
});

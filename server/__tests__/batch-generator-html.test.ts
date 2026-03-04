import {
  generateBatch,
  generateContinueBatch,
  regenerateVisit,
} from "../services/batch-generator";
import * as soapGenerator from "../../src/generator/soap-generator";
import type {
  BatchData,
  BatchPatient,
  BatchPatientClinical,
  BatchVisit,
} from "../types";

const vi = (globalThis as any).vi ?? (globalThis as any).jest ?? jest;

function makeClinical(overrides: Partial<BatchPatientClinical> = {}): BatchPatientClinical {
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
    index: 1,
    dos: 1,
    noteType: "TX",
    txNumber: 1,
    bodyPart: "SHOULDER",
    laterality: "bilateral",
    secondaryParts: [],
    history: [],
    icdCodes: [{ code: "M25.511", name: "Pain in right shoulder" }],
    cptCodes: [{ code: "97810", name: "ACUP 1/> WO ESTIM 1ST 15 MIN", units: 1 }],
    generated: null,
    status: "pending",
    ...overrides,
  };
}

function makePatient(overrides: Partial<BatchPatient> = {}): BatchPatient {
  return {
    name: "TEST,HTML",
    dob: "09/27/1956",
    age: 69,
    gender: "Female",
    insurance: "HF",
    clinical: makeClinical(),
    visits: [makeVisit()],
    ...overrides,
  };
}

function makeBatch(patients: BatchPatient[]): BatchData {
  return {
    batchId: "test_batch_html",
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

describe("batch-generator html integration", () => {
  it("regenerateVisit TX stores html spans and plain text soap", () => {
    const patient = makePatient();
    const visit = makeVisit({ noteType: "TX", txNumber: 1, bodyPart: "SHOULDER" });
    const result = regenerateVisit(patient, visit);
    const generated = result.generated;
    expect(generated).not.toBeNull();
    expect(generated!.html).toBeDefined();
    expect(generated!.html!.subjective).toContain("ppnSelectCombo");
    expect(generated!.html!.assessment).toContain("ppnSelectCombo");
    expect(generated!.html!.plan).toContain("ppnSelectCombo");
    expect(generated!.fullText).toContain("Subjective");
    expect(generated!.fullText).not.toContain("ppnSelectCombo");
  });

  it("regenerateVisit TX uses single html render path (no exportSOAPAsText call)", () => {
    const exportSOAPSpy = vi.spyOn(soapGenerator, "exportSOAP");
    const exportSOAPAsTextSpy = vi.spyOn(soapGenerator, "exportSOAPAsText");

    const patient = makePatient();
    const visit = makeVisit({ noteType: "TX", txNumber: 1, bodyPart: "SHOULDER" });
    regenerateVisit(patient, visit);

    const htmlCalls = exportSOAPSpy.mock.calls.filter((call: any[]) => call[2] === "html");
    const textCalls = exportSOAPSpy.mock.calls.filter((call: any[]) => call[2] === "text");

    expect(exportSOAPAsTextSpy).not.toHaveBeenCalled();
    expect(htmlCalls).toHaveLength(1);
    expect(textCalls).toHaveLength(0);

    exportSOAPSpy.mockRestore();
    exportSOAPAsTextSpy.mockRestore();
  });

  it("regenerateVisit IE stores plain html paragraphs without tx spans", () => {
    const patient = makePatient({
      visits: [
        makeVisit({
          noteType: "IE",
          txNumber: null,
          bodyPart: "LBP",
          index: 10,
        }),
      ],
    });
    const result = regenerateVisit(patient, patient.visits[0]);
    const generated = result.generated;
    expect(generated).not.toBeNull();
    expect(generated!.html).toBeDefined();
    expect(generated!.html!.subjective).toContain("<p>");
    expect(generated!.html!.subjective).not.toContain("ppnSelectCombo");
  });

  it("generateTXSeries writes html for each TX visit", () => {
    const patient = makePatient({
      visits: [
        makeVisit({ index: 1, noteType: "TX", txNumber: 1, bodyPart: "SHOULDER" }),
        makeVisit({ index: 2, noteType: "TX", txNumber: 2, bodyPart: "SHOULDER" }),
      ],
    });
    const result = generateBatch(makeBatch([patient]));
    expect(result.patients[0].visits).toHaveLength(2);
    for (const visit of result.patients[0].visits) {
      expect(visit.generated).not.toBeNull();
      expect(visit.generated!.html).toBeDefined();
      expect(visit.generated!.html!.subjective).toContain("ppnSelectCombo");
      expect(visit.generated!.html!.assessment).toContain("ppnSelectCombo");
    }
  });

  it("generateContinueBatch writes html spans for continued TX visits", () => {
    const sourcePatient = makePatient({
      visits: [makeVisit({ noteType: "TX", txNumber: 1, index: 1 })],
    });
    const sourceBatch = generateBatch(makeBatch([sourcePatient]));
    const soapText = sourceBatch.patients[0].visits[0].generated!.fullText;

    const continuePatient = makePatient({
      visits: [makeVisit({ noteType: "TX", txNumber: 2, index: 2 })],
      soapText,
    });
    const continueBatch: BatchData = {
      ...makeBatch([continuePatient]),
      mode: "continue",
    };
    const result = generateContinueBatch(continueBatch);
    const generated = result.patients[0].visits[0].generated;
    expect(generated).not.toBeNull();
    expect(generated!.html).toBeDefined();
    expect(generated!.html!.subjective).toContain("ppnSelectCombo");
    expect(generated!.html!.assessment).toContain("ppnSelectCombo");
  });
});

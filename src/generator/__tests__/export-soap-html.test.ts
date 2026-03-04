import { exportSOAP, exportSOAPAsText } from "../soap-generator";

describe("exportSOAP html format", () => {
  function makeTxContext(primaryBodyPart: string): any {
    return {
      noteType: "TX",
      insuranceType: "NONE",
      primaryBodyPart,
      laterality: "bilateral",
      localPattern: "Qi Stagnation",
      systemicPattern: "Kidney Yang Deficiency",
      chronicityLevel: "Chronic",
      severityLevel: "moderate to severe",
      painCurrent: 8,
      painWorst: 9,
      painBest: 3,
      painTypes: ["Dull", "Aching"],
      associatedSymptoms: ["soreness", "stiffness"],
      painFrequency:
        "Constant (symptoms occur between 76% and 100% of the time)",
      symptomScale: "70%",
      medicalHistory: [],
      secondaryBodyParts: [],
      seed: 42,
    };
  }

  it("returns ppnSelectCombo spans in TX html mode", () => {
    const html = exportSOAP(makeTxContext("SHOULDER"), undefined, "html");
    expect(html).toContain("ppnSelectCombo");
    expect(html).toContain("ppnSelectComboSingle");
  });

  it("uses template shoulder painArea/radiation options", () => {
    const html = exportSOAP(makeTxContext("SHOULDER"), undefined, "html");
    expect(html).toContain(
      "ppnSelectCombo shoulder area|shoulder area and lateral arm|shoulder area, upper back and upper arm|shoulder area and upper back area|shoulder area, upper back and periscapular area|shoulder area and periscapular area",
    );
    expect(html).toContain(
      "ppnSelectCombo without radiation|with radiation to R arm|with radiation to L arm|with radiation to BLUE",
    );
  });

  it("uses template knee radiation as ppnSelectComboSingle", () => {
    const html = exportSOAP(makeTxContext("KNEE"), undefined, "html");
    expect(html).toContain(
      "ppnSelectComboSingle without radiation|with radiation to R leg|with radiation to L leg|with radiation to BLLE|with radiation to toes|with local swollen",
    );
  });

  it("uses template LBP painArea/radiation options", () => {
    const html = exportSOAP(makeTxContext("LBP"), undefined, "html");
    expect(html).toContain(
      "ppnSelectCombo midback|mid and lower back|lower back|lower back and buttocks",
    );
    expect(html).toContain(
      "ppnSelectComboSingle without radiation|with radiation to R leg|with radiation to L leg|with radiation to BLLE|with radiation to toes",
    );
  });

  it("uses template neck mixed radiation dropdown (dizziness/headache/migraine)", () => {
    const html = exportSOAP(makeTxContext("NECK"), undefined, "html");
    expect(html).toContain(
      "ppnSelectCombo with dizziness|with headache|with migraine|without radiation|with radiation to R arm|with radiation to L arm|with radiation to BLUE",
    );
  });

  it("uses template symptomChange/painScale/symptomScale pools", () => {
    const html = exportSOAP(makeTxContext("KNEE"), undefined, "html");
    expect(html).toContain(
      "ppnSelectComboSingle improvement of symptom(s)|exacerbate of symptom(s)|similar symptom(s) as last visit|improvement after treatment, but pain still came back next day",
    );
    expect(html).toContain(
      "ppnSelectComboSingle 10|10-9|9|9-8|8|8-7|7|7-6|6|6-5|5|5-4|4|4-3|3|3-2|2|2-1|1|1-0|0",
    );
    expect(html).toContain(
      "ppnSelectCombo 10%|10%-20%|20%|20%-30%|30%|30%-40%|40%|40%-50%|50%|50%-60%|60%|60%-70%|70%|70%-80%|80%|80%-90%|90%|100%",
    );
  });

  it("uses fixed 14 treatment options in TX plan html", () => {
    const html = exportSOAP(makeTxContext("SHOULDER"), undefined, "html");
    expect(html).toContain("<strong>Today's treatment principles:</strong><br>");
    expect(html).toContain(
      "ppnSelectCombo moving qi|regulates qi|activating Blood circulation to dissipate blood stagnant|dredging channel and activating collaterals|activate blood and relax tendons|eliminates accumulation|resolve stagnation, clears heat|promote circulation, relieves pain|expelling pathogens|dispelling cold, drain the dampness|strengthening muscles and bone|clear heat, dispelling the flame|clear damp-heat|drain the dampness, clear damp",
    );
  });

  it("adds Assessment first-line painArea dropdowns for SHOULDER/NECK/LBP", () => {
    const shoulder = exportSOAP(makeTxContext("SHOULDER"), undefined, "html");
    expect(shoulder).toContain(
      "ppnSelectCombo shoulder area|shoulder area and lateral arm|shoulder area, upper back and upper arm|shoulder area and upper back area|shoulder area, upper back and periscapular area|shoulder area and periscapular area",
    );

    const neck = exportSOAP(makeTxContext("NECK"), undefined, "html");
    expect(neck).toContain(
      "ppnSelectComboSingle neck|neck and upper back|upper back|neck and upper back with migraine",
    );

    const lbp = exportSOAP(makeTxContext("LBP"), undefined, "html");
    expect(lbp).toContain(
      "ppnSelectCombo midback|mid and lower back|lower back|lower back and buttocks",
    );
  });

  it("uses LBP reduced-series patientChange and fixed 11 local pattern options", () => {
    const html = exportSOAP(makeTxContext("LBP"), undefined, "html");
    expect(html).toContain(
      "ppnSelectComboSingle reduced|slightly reduced|increased|slight increased|remained the same",
    );
    expect(html).toContain(
      "ppnSelectCombo Qi Stagnation|Blood Stasis|Liver Qi Stagnation|Blood Deficiency|Qi &amp; Blood Deficiency|Wind-Cold Invasion|Cold-Damp + Wind-Cold|LV/GB Damp-Heat|Phlegm-Damp|Phlegm-Heat|Damp-Heat",
    );
  });

  it("keeps patient reports line in baseline format (no emotional/causative visible text)", () => {
    const html = exportSOAP(makeTxContext("SHOULDER"), undefined, "html");
    expect(html).toContain("Patient reports: there is ");
    expect(html).not.toContain("Patient reports: Normal,");
  });

  it("includes elbow laterality dropdown in TX html", () => {
    const html = exportSOAP(makeTxContext("ELBOW"), undefined, "html");
    expect(html).toContain(
      "ppnSelectComboSingle along right|along left|along bilateral|in left|in right|in bilateral",
    );
  });

  it("exportSOAPAsText remains plain text", () => {
    const txContext = makeTxContext("SHOULDER");
    const text = exportSOAPAsText(txContext);
    expect(text).toContain("Subjective");
    expect(text).not.toContain("ppnSelectCombo");
    expect(text).not.toContain("<span");
  });
});

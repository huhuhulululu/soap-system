import {
  type BodyPartKey,
  TEMPLATE_ADL,
  TEMPLATE_AGGRAVATING,
  TEMPLATE_CAUSATIVES,
  TEMPLATE_MUSCLES,
  TEMPLATE_PAIN_TYPES,
  TEMPLATE_RELIEVING,
  TEMPLATE_ROM,
  TEMPLATE_TENDERNESS_SCALE,
  TEMPLATE_TENDERNESS_TEXT,
  TEMPLATE_TX_FINDING_TYPE,
  TEMPLATE_TX_ASSESSMENT_AREA,
  TEMPLATE_TX_SYMPTOM_CHANGE,
  TEMPLATE_TX_PAIN_SCALE,
  TEMPLATE_TX_SYMPTOM_SCALE_OPTIONS,
  TEMPLATE_TX_PATIENT_CHANGE_BY_BODY_PART,
  TEMPLATE_TX_TREATMENT_OPTIONS,
  TEMPLATE_TX_LOCAL_PATTERN_OPTIONS,
  TEMPLATE_TX_REASON,
  TEMPLATE_TX_CAUSATIVE_MIDDLE,
  TEMPLATE_TX_EMOTIONAL_STATE,
  TEMPLATE_TX_LATERALITY,
  TEMPLATE_TX_NECK_DIRECTION,
  TEMPLATE_TX_PAIN_AREA,
  TEMPLATE_TX_RADIATION,
  TEMPLATE_TX_RADIATION_INPUT_TYPE,
  TEMPLATE_TX_WHAT_CHANGED_O,
  TEMPLATE_TX_WHAT_CHANGED_S,
} from "../template-options";

const ALL_BODY_PARTS: BodyPartKey[] = [
  "LBP",
  "NECK",
  "SHOULDER",
  "KNEE",
  "ELBOW",
  "HIP",
  "THIGH",
];

describe("template-options", () => {
  describe("TEMPLATE_PAIN_TYPES", () => {
    it("has entries for all body parts", () => {
      for (const bp of ALL_BODY_PARTS) {
        expect(TEMPLATE_PAIN_TYPES[bp].length).toBeGreaterThan(0);
      }
    });

    it("ELBOW lacks 'pin & needles'", () => {
      expect(TEMPLATE_PAIN_TYPES.ELBOW).not.toContain("pin & needles");
    });

    it("all others include 'pin & needles'", () => {
      for (const bp of ALL_BODY_PARTS.filter((b) => b !== "ELBOW")) {
        expect(TEMPLATE_PAIN_TYPES[bp]).toContain("pin & needles");
      }
    });

    it("starts with Dull for every body part", () => {
      for (const bp of ALL_BODY_PARTS) {
        expect(TEMPLATE_PAIN_TYPES[bp][0]).toBe("Dull");
      }
    });
  });

  describe("TEMPLATE_MUSCLES", () => {
    it("has tightness, tenderness, spasm for all body parts", () => {
      for (const bp of ALL_BODY_PARTS) {
        const m = TEMPLATE_MUSCLES[bp];
        expect(m.tightness.length).toBeGreaterThan(0);
        expect(m.tenderness.length).toBeGreaterThan(0);
        expect(m.spasm.length).toBeGreaterThan(0);
      }
    });

    it("LBP muscles include 'iliocostalis' and 'The Multifidus muscles'", () => {
      expect(TEMPLATE_MUSCLES.LBP.tightness).toContain("iliocostalis");
      expect(TEMPLATE_MUSCLES.LBP.tightness).toContain(
        "The Multifidus muscles",
      );
    });

    it("NECK muscles include 'Scalene anterior / med / posterior'", () => {
      expect(TEMPLATE_MUSCLES.NECK.tightness).toContain(
        "Scalene anterior / med / posterior",
      );
    });

    it("SHOULDER muscles include 'upper trapezius' and 'AC joint'", () => {
      expect(TEMPLATE_MUSCLES.SHOULDER.tightness).toContain("upper trapezius");
      expect(TEMPLATE_MUSCLES.SHOULDER.tightness).toContain("AC joint");
    });

    it("KNEE muscles include 'Adductor longus/ brev/ magnus'", () => {
      expect(TEMPLATE_MUSCLES.KNEE.tightness).toContain(
        "Adductor longus/ brev/ magnus",
      );
    });

    it("ELBOW tenderness has extra items vs tightness", () => {
      expect(TEMPLATE_MUSCLES.ELBOW.tenderness.length).toBeGreaterThan(
        TEMPLATE_MUSCLES.ELBOW.tightness.length,
      );
      expect(TEMPLATE_MUSCLES.ELBOW.tenderness).toContain("Illiac Crest");
      expect(TEMPLATE_MUSCLES.ELBOW.tenderness).toContain("s2-s4");
      expect(TEMPLATE_MUSCLES.ELBOW.tenderness).toContain("L2-L5");
    });

    it("HIP/THIGH spasm uses specific 3-item list", () => {
      for (const bp of ["HIP", "THIGH"] as BodyPartKey[]) {
        expect(TEMPLATE_MUSCLES[bp].spasm).toEqual([
          "Quadratus Lumborum",
          "Tensor Fascia Latae",
          "Piriformis",
        ]);
      }
    });

    it("HIP/THIGH tightness includes 'greater tubercle'", () => {
      expect(TEMPLATE_MUSCLES.HIP.tightness).toContain("greater tubercle");
      expect(TEMPLATE_MUSCLES.THIGH.tightness).toContain("greater tubercle");
    });
  });

  describe("TEMPLATE_ROM", () => {
    it("has movements for all body parts", () => {
      for (const bp of ALL_BODY_PARTS) {
        expect(TEMPLATE_ROM[bp].length).toBeGreaterThan(0);
      }
    });

    it("LBP has 6 movements", () => {
      expect(TEMPLATE_ROM.LBP).toHaveLength(6);
      const names = TEMPLATE_ROM.LBP.map((m) => m.name);
      expect(names).toContain("Flexion");
      expect(names).toContain("Extension");
      expect(names).toContain("Rotation to Right");
      expect(names).toContain("Rotation to Left");
      expect(names).toContain("Flexion to the Right");
      expect(names).toContain("Flexion to the Left");
    });

    it("LBP Flexion starts at 90 normal, ends at 5 severe", () => {
      const flexion = TEMPLATE_ROM.LBP.find((m) => m.name === "Flexion");
      expect(flexion).toBeDefined();
      expect(flexion!.options[0]).toEqual({ degrees: 90, severity: "normal" });
      expect(flexion!.options.at(-1)).toEqual({
        degrees: 5,
        severity: "severe",
      });
    });

    it("NECK has 6 movements", () => {
      expect(TEMPLATE_ROM.NECK).toHaveLength(6);
      const names = TEMPLATE_ROM.NECK.map((m) => m.name);
      expect(names).toContain("Extension");
      expect(names).toContain("Flexion");
      expect(names).toContain("Rotation to Right");
      expect(names).toContain("Rotation to Left");
      expect(names).toContain("Lateral Flexion to the Right");
      expect(names).toContain("Lateral Flexion to the Left");
    });

    it("SHOULDER has 6 movements including Horizontal Adduction", () => {
      expect(TEMPLATE_ROM.SHOULDER).toHaveLength(6);
      const names = TEMPLATE_ROM.SHOULDER.map((m) => m.name);
      expect(names).toContain("Abduction");
      expect(names).toContain("Horizontal Adduction");
      expect(names).toContain("External rotation");
      expect(names).toContain("Internal rotation");
    });

    it("SHOULDER Abduction starts at 180 normal", () => {
      const abd = TEMPLATE_ROM.SHOULDER.find((m) => m.name === "Abduction");
      expect(abd!.options[0]).toEqual({ degrees: 180, severity: "normal" });
      expect(abd!.options).toHaveLength(36);
    });

    it("KNEE has Flexion and Extension", () => {
      expect(TEMPLATE_ROM.KNEE).toHaveLength(2);
      expect(TEMPLATE_ROM.KNEE[0].name).toBe("Flexion");
      expect(TEMPLATE_ROM.KNEE[1].name).toBe("Extension");
    });

    it("KNEE Flexion starts at 130 normal", () => {
      expect(TEMPLATE_ROM.KNEE[0].options[0]).toEqual({
        degrees: 130,
        severity: "normal",
      });
    });

    it("KNEE Extension has 0(normal) and -5(severe)", () => {
      expect(TEMPLATE_ROM.KNEE[1].options).toEqual([
        { degrees: 0, severity: "normal" },
        { degrees: -5, severity: "severe" },
      ]);
    });

    it("ELBOW has 6 movements", () => {
      expect(TEMPLATE_ROM.ELBOW).toHaveLength(6);
      const names = TEMPLATE_ROM.ELBOW.map((m) => m.name);
      expect(names).toContain("Flexion");
      expect(names).toContain("Extension");
      expect(names).toContain("Left side flexion");
      expect(names).toContain("Rt side flexion");
      expect(names).toContain("Left side rotation");
      expect(names).toContain("Right side rotation");
    });

    it("HIP has 5 movements", () => {
      expect(TEMPLATE_ROM.HIP).toHaveLength(5);
      const names = TEMPLATE_ROM.HIP.map((m) => m.name);
      expect(names).toContain("Abduction");
      expect(names).toContain("Flexion");
      expect(names).toContain("Extension");
      expect(names).toContain("External rotation");
      expect(names).toContain("Internal rotation");
    });

    it("THIGH has 3 movements (no rotations)", () => {
      expect(TEMPLATE_ROM.THIGH).toHaveLength(3);
      const names = TEMPLATE_ROM.THIGH.map((m) => m.name);
      expect(names).toContain("Abduction");
      expect(names).toContain("Flexion");
      expect(names).toContain("Extension");
    });

    it("all ROM options have valid severity values", () => {
      const validSeverities = ["normal", "mild", "moderate", "severe"];
      for (const bp of ALL_BODY_PARTS) {
        for (const mov of TEMPLATE_ROM[bp]) {
          for (const opt of mov.options) {
            expect(validSeverities).toContain(opt.severity);
            expect(typeof opt.degrees).toBe("number");
          }
        }
      }
    });
  });

  describe("TEMPLATE_ADL", () => {
    it("has entries for all body parts", () => {
      for (const bp of ALL_BODY_PARTS) {
        expect(TEMPLATE_ADL[bp].length).toBeGreaterThan(0);
      }
    });

    it("LBP includes 'performing household chores'", () => {
      expect(TEMPLATE_ADL.LBP).toContain("performing household chores");
    });

    it("NECK includes 'gargling'", () => {
      expect(TEMPLATE_ADL.NECK).toContain("gargling");
    });

    it("SHOULDER includes 'reach to back to unzip'", () => {
      expect(TEMPLATE_ADL.SHOULDER).toContain("reach to back to unzip");
    });

    it("KNEE includes 'bending knee to sit position'", () => {
      expect(TEMPLATE_ADL.KNEE).toContain("bending knee to sit position");
    });

    it("THIGH includes 'get out/in the chair or bed'", () => {
      expect(TEMPLATE_ADL.THIGH).toContain("get out/in the chair or bed");
    });
  });

  describe("TX html option sets", () => {
    it("uses template-extracted laterality options", () => {
      expect(TEMPLATE_TX_LATERALITY).toEqual([
        "along right",
        "along left",
        "along bilateral",
        "in left",
        "in right",
        "in bilateral",
      ]);
      expect(TEMPLATE_TX_NECK_DIRECTION).toEqual([
        "in",
        "in left side",
        "in right side",
        "along right side",
        "along left side",
      ]);
    });

    it("uses template-extracted TX pain area options", () => {
      expect(TEMPLATE_TX_PAIN_AREA.SHOULDER).toEqual([
        "shoulder area",
        "shoulder area and lateral arm",
        "shoulder area, upper back and upper arm",
        "shoulder area and upper back area",
        "shoulder area, upper back and periscapular area",
        "shoulder area and periscapular area",
      ]);
      expect(TEMPLATE_TX_PAIN_AREA.NECK).toEqual([
        "neck",
        "neck and upper back",
        "upper back",
      ]);
      expect(TEMPLATE_TX_PAIN_AREA.LBP).toEqual([
        "midback",
        "mid and lower back",
        "lower back",
        "lower back and buttocks",
      ]);
      expect(TEMPLATE_TX_PAIN_AREA.KNEE).toEqual([]);
      expect(TEMPLATE_TX_PAIN_AREA.ELBOW).toEqual([]);
    });

    it("uses template-extracted TX radiation options and input types", () => {
      expect(TEMPLATE_TX_RADIATION.SHOULDER).toEqual([
        "without radiation",
        "with radiation to R arm",
        "with radiation to L arm",
        "with radiation to BLUE",
      ]);
      expect(TEMPLATE_TX_RADIATION.ELBOW).toEqual([
        "without radiation",
        "with radiation to R arm",
        "with radiation to L arm",
        "with radiation to BLUE",
      ]);
      expect(TEMPLATE_TX_RADIATION.KNEE).toEqual([
        "without radiation",
        "with radiation to R leg",
        "with radiation to L leg",
        "with radiation to BLLE",
        "with radiation to toes",
        "with local swollen",
      ]);
      expect(TEMPLATE_TX_RADIATION.LBP).toEqual([
        "without radiation",
        "with radiation to R leg",
        "with radiation to L leg",
        "with radiation to BLLE",
        "with radiation to toes",
      ]);
      expect(TEMPLATE_TX_RADIATION.NECK).toEqual([
        "with dizziness",
        "with headache",
        "with migraine",
        "without radiation",
        "with radiation to R arm",
        "with radiation to L arm",
        "with radiation to BLUE",
      ]);
      expect(TEMPLATE_TX_RADIATION_INPUT_TYPE.KNEE).toBe("single");
      expect(TEMPLATE_TX_RADIATION_INPUT_TYPE.LBP).toBe("single");
      expect(TEMPLATE_TX_RADIATION_INPUT_TYPE.SHOULDER).toBe("multi");
      expect(TEMPLATE_TX_RADIATION_INPUT_TYPE.NECK).toBe("multi");
      expect(TEMPLATE_TX_RADIATION_INPUT_TYPE.ELBOW).toBe("multi");
    });

    it("has per-bodyPart whatChanged pools for Assessment", () => {
      expect(TEMPLATE_TX_WHAT_CHANGED_O.SHOULDER.length).toBeGreaterThan(0);
      expect(TEMPLATE_TX_WHAT_CHANGED_O.NECK.length).toBeGreaterThan(0);
      expect(TEMPLATE_TX_WHAT_CHANGED_S.NECK).toContain("headache");
      expect(TEMPLATE_TX_WHAT_CHANGED_S.NECK).toContain("dizziness");
    });

    it('TEMPLATE_TX_FINDING_TYPE does not contain fabricated "joint ROM"', () => {
      expect(TEMPLATE_TX_FINDING_TYPE).not.toContain("joint ROM");
      expect(TEMPLATE_TX_FINDING_TYPE).toContain("joint ROM limitation");
    });

    it("uses template assessment-area options (NECK has migraine option)", () => {
      expect(TEMPLATE_TX_ASSESSMENT_AREA.SHOULDER).toEqual([
        "shoulder area",
        "shoulder area and lateral arm",
        "shoulder area, upper back and upper arm",
        "shoulder area and upper back area",
        "shoulder area, upper back and periscapular area",
        "shoulder area and periscapular area",
      ]);
      expect(TEMPLATE_TX_ASSESSMENT_AREA.NECK).toEqual([
        "neck",
        "neck and upper back",
        "upper back",
        "neck and upper back with migraine",
      ]);
      expect(TEMPLATE_TX_ASSESSMENT_AREA.LBP).toEqual([
        "midback",
        "mid and lower back",
        "lower back",
        "lower back and buttocks",
      ]);
    });

    it("uses full symptom/pain scale pools and fixed plan/local options", () => {
      expect(TEMPLATE_TX_SYMPTOM_CHANGE).toEqual([
        "improvement of symptom(s)",
        "exacerbate of symptom(s)",
        "similar symptom(s) as last visit",
        "improvement after treatment, but pain still came back next day",
      ]);
      expect(TEMPLATE_TX_PAIN_SCALE).toContain("10-9");
      expect(TEMPLATE_TX_PAIN_SCALE).toContain("9-8");
      expect(TEMPLATE_TX_PAIN_SCALE).toContain("1-0");
      expect(TEMPLATE_TX_PAIN_SCALE).toContain("0");
      expect(TEMPLATE_TX_PAIN_SCALE).toHaveLength(21);
      expect(TEMPLATE_TX_SYMPTOM_SCALE_OPTIONS).toContain("10%-20%");
      expect(TEMPLATE_TX_SYMPTOM_SCALE_OPTIONS).toContain("70%-80%");
      expect(TEMPLATE_TX_SYMPTOM_SCALE_OPTIONS).toContain("80%-90%");
      expect(TEMPLATE_TX_SYMPTOM_SCALE_OPTIONS).toHaveLength(18);
      expect(TEMPLATE_TX_TREATMENT_OPTIONS).toHaveLength(14);
      expect(TEMPLATE_TX_LOCAL_PATTERN_OPTIONS).toHaveLength(11);
    });

    it("keeps full TEMPLATE_TX_REASON pool (24 options) with key entries", () => {
      expect(TEMPLATE_TX_REASON).toHaveLength(24);
      expect(TEMPLATE_TX_REASON[0]).toBe(
        "can move joint more freely and with less pain",
      );
      expect(TEMPLATE_TX_REASON).toContain("continuous treatment");
      expect(TEMPLATE_TX_REASON).toContain(
        "still need more treatments to reach better effect",
      );
      expect(TEMPLATE_TX_REASON).toContain("bad posture");
      expect(TEMPLATE_TX_REASON).toContain("uncertain reason");
      expect(TEMPLATE_TX_REASON.at(-1)).toBe("uncertain reason");
    });

    it("keeps per-bodyPart patientChange wording (LBP uses reduced)", () => {
      expect(TEMPLATE_TX_PATIENT_CHANGE_BY_BODY_PART.LBP).toEqual([
        "reduced",
        "slightly reduced",
        "increased",
        "slight increased",
        "remained the same",
      ]);
      expect(TEMPLATE_TX_PATIENT_CHANGE_BY_BODY_PART.KNEE).toEqual([
        "decreased",
        "slightly decreased",
        "increased",
        "slight increased",
        "remained the same",
      ]);
    });

    it("includes subjective emotional and causative-middle pools", () => {
      expect(TEMPLATE_TX_EMOTIONAL_STATE).toEqual([
        "Normal",
        "Stressful",
        "Anxious",
        "Depressed",
        "Irritable",
        "Sad",
        "Negative",
        "Positive",
      ]);
      expect(TEMPLATE_TX_CAUSATIVE_MIDDLE).toHaveLength(12);
      expect(TEMPLATE_TX_CAUSATIVE_MIDDLE).toContain(
        "working on computer day by day",
      );
      expect(TEMPLATE_TX_CAUSATIVE_MIDDLE).toContain("lack of exercise");
    });
  });

  describe("TEMPLATE_AGGRAVATING", () => {
    it("has entries for all body parts", () => {
      for (const bp of ALL_BODY_PARTS) {
        expect(TEMPLATE_AGGRAVATING[bp].length).toBeGreaterThan(0);
      }
    });

    it("SHOULDER includes 'push the door' and 'Overhead activities'", () => {
      expect(TEMPLATE_AGGRAVATING.SHOULDER).toContain("push the door");
      expect(TEMPLATE_AGGRAVATING.SHOULDER).toContain("Overhead activities");
    });

    it("ELBOW includes 'cold weather'", () => {
      expect(TEMPLATE_AGGRAVATING.ELBOW).toContain("cold weather");
    });

    it("HIP includes 'Prolonge walking' (template typo preserved)", () => {
      expect(TEMPLATE_AGGRAVATING.HIP).toContain("Prolonge walking");
    });

    it("THIGH uses lowercase 'prolonged' variants", () => {
      expect(TEMPLATE_AGGRAVATING.THIGH).toContain("prolonged walking");
      expect(TEMPLATE_AGGRAVATING.THIGH).toContain("prolonged sitting");
    });
  });

  describe("TEMPLATE_RELIEVING", () => {
    it("has entries for all body parts", () => {
      for (const bp of ALL_BODY_PARTS) {
        expect(TEMPLATE_RELIEVING[bp].length).toBeGreaterThan(0);
      }
    });

    it("LBP, KNEE, HIP include 'Medications'", () => {
      for (const bp of ["LBP", "KNEE", "HIP"] as BodyPartKey[]) {
        expect(TEMPLATE_RELIEVING[bp]).toContain("Medications");
      }
    });

    it("NECK, SHOULDER, ELBOW, THIGH do NOT include 'Medications'", () => {
      for (const bp of [
        "NECK",
        "SHOULDER",
        "ELBOW",
        "THIGH",
      ] as BodyPartKey[]) {
        expect(TEMPLATE_RELIEVING[bp]).not.toContain("Medications");
      }
    });

    it("all start with 'Moving around'", () => {
      for (const bp of ALL_BODY_PARTS) {
        expect(TEMPLATE_RELIEVING[bp][0]).toBe("Moving around");
      }
    });
  });

  describe("TEMPLATE_CAUSATIVES", () => {
    it("has entries for all body parts", () => {
      for (const bp of ALL_BODY_PARTS) {
        expect(TEMPLATE_CAUSATIVES[bp].length).toBeGreaterThan(0);
      }
    });

    it("all start with 'age related/degenerative changes'", () => {
      for (const bp of ALL_BODY_PARTS) {
        expect(TEMPLATE_CAUSATIVES[bp][0]).toBe(
          "age related/degenerative changes",
        );
      }
    });

    it("KNEE has 'Recent fall (no sign of fracture)' not 'fell'", () => {
      expect(TEMPLATE_CAUSATIVES.KNEE).toContain(
        "Recent fall (no sign of fracture)",
      );
      expect(TEMPLATE_CAUSATIVES.KNEE).not.toContain(
        "fell (no sign of fracture)",
      );
    });

    it("LBP has 'fell (no sign of fracture)' not 'Recent fall'", () => {
      expect(TEMPLATE_CAUSATIVES.LBP).toContain("fell (no sign of fracture)");
      expect(TEMPLATE_CAUSATIVES.LBP).not.toContain(
        "Recent fall (no sign of fracture)",
      );
    });

    it("KNEE has 'weather changed/cold weather'", () => {
      expect(TEMPLATE_CAUSATIVES.KNEE).toContain(
        "weather changed/cold weather",
      );
    });

    it("HIP has 'Inactive lifestyle' and 'Bad Posture'", () => {
      expect(TEMPLATE_CAUSATIVES.HIP).toContain("Inactive lifestyle");
      expect(TEMPLATE_CAUSATIVES.HIP).toContain("Bad Posture");
    });

    it("KNEE has 'Inactive lifestyle' and 'Bad Posture'", () => {
      expect(TEMPLATE_CAUSATIVES.KNEE).toContain("Inactive lifestyle");
      expect(TEMPLATE_CAUSATIVES.KNEE).toContain("Bad Posture");
    });

    it("full causatives include 'weather change' (not 'weather changed')", () => {
      expect(TEMPLATE_CAUSATIVES.LBP).toContain("weather change");
      expect(TEMPLATE_CAUSATIVES.NECK).toContain("weather change");
    });
  });

  describe("TEMPLATE_TENDERNESS_SCALE", () => {
    it("has entries for all body parts", () => {
      for (const bp of ALL_BODY_PARTS) {
        expect(TEMPLATE_TENDERNESS_SCALE[bp]).toBeDefined();
        expect(
          Object.keys(TEMPLATE_TENDERNESS_SCALE[bp]).length,
        ).toBeGreaterThan(0);
      }
    });

    it("SHOULDER uses 'Patient complains' style", () => {
      expect(TEMPLATE_TENDERNESS_SCALE.SHOULDER["+4"]).toContain(
        "Patient complains",
      );
    });

    it("KNEE uses 'There is' style with 0 grade", () => {
      expect(TEMPLATE_TENDERNESS_SCALE.KNEE["+4"]).toContain("There is severe");
      expect(TEMPLATE_TENDERNESS_SCALE.KNEE["0"]).toBe("(0) = No tenderness");
    });

    it("HIP uses KNEE-style scale (not SHOULDER-style)", () => {
      expect(TEMPLATE_TENDERNESS_SCALE.HIP["+4"]).toContain("There is severe");
      expect(TEMPLATE_TENDERNESS_SCALE.HIP["0"]).toBe("(0) = No tenderness");
    });
  });

  describe("TEMPLATE_TENDERNESS_TEXT", () => {
    it("has entries for all body parts", () => {
      for (const bp of ALL_BODY_PARTS) {
        expect(TEMPLATE_TENDERNESS_TEXT[bp]).toBeDefined();
        expect(TEMPLATE_TENDERNESS_TEXT[bp].length).toBeGreaterThan(0);
      }
    });

    it("SHOULDER uses plural 'muscles'", () => {
      expect(TEMPLATE_TENDERNESS_TEXT.SHOULDER).toBe(
        "Tenderness muscles noted along",
      );
    });

    it("KNEE uses singular 'muscle'", () => {
      expect(TEMPLATE_TENDERNESS_TEXT.KNEE).toBe(
        "Tenderness muscle noted along",
      );
    });
  });
});

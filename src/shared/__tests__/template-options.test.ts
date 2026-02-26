import { describe, expect, it } from "vitest";
import {
  type BodyPartKey,
  TEMPLATE_ADL,
  TEMPLATE_AGGRAVATING,
  TEMPLATE_CAUSATIVES,
  TEMPLATE_MUSCLES,
  TEMPLATE_PAIN_TYPES,
  TEMPLATE_RELIEVING,
  TEMPLATE_ROM,
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
      expect(TEMPLATE_CAUSATIVES.KNEE).toContain("weather changed/cold weather");
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
});

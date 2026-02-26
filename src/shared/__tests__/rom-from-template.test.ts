import { describe, expect, it } from "vitest";
import {
  pickTemplateROMDegrees,
  getTemplateSeverityForPain,
  getTemplateSeverityLabel,
  resolveTemplateMovementName,
  hasTemplateROM,
} from "../rom-from-template";
import {
  type BodyPartKey,
  type Severity,
  TEMPLATE_ROM,
} from "../template-options";

const ALL_TEMPLATE_BPS: BodyPartKey[] = [
  "LBP",
  "NECK",
  "SHOULDER",
  "KNEE",
  "ELBOW",
  "HIP",
  "THIGH",
];

describe("getTemplateSeverityForPain", () => {
  it("pain 1-3 → mild", () => {
    expect(getTemplateSeverityForPain(1)).toBe("mild");
    expect(getTemplateSeverityForPain(2)).toBe("mild");
    expect(getTemplateSeverityForPain(3)).toBe("mild");
  });

  it("pain 4-6 → moderate", () => {
    expect(getTemplateSeverityForPain(4)).toBe("moderate");
    expect(getTemplateSeverityForPain(5)).toBe("moderate");
    expect(getTemplateSeverityForPain(6)).toBe("moderate");
  });

  it("pain 7-10 → severe", () => {
    expect(getTemplateSeverityForPain(7)).toBe("severe");
    expect(getTemplateSeverityForPain(8)).toBe("severe");
    expect(getTemplateSeverityForPain(10)).toBe("severe");
  });

  it("pain 0 → normal", () => {
    expect(getTemplateSeverityForPain(0)).toBe("normal");
  });
});

describe("pickTemplateROMDegrees", () => {
  it("returns a degree value that exists in TEMPLATE_ROM options for LBP Flexion", () => {
    const result = pickTemplateROMDegrees("LBP", "Flexion", "moderate", 0.5);
    const flexion = TEMPLATE_ROM.LBP.find((m) => m.name === "Flexion")!;
    const validDegrees = flexion.options.map((o) => o.degrees);
    expect(validDegrees).toContain(result);
  });

  it("returns a degree value that exists in TEMPLATE_ROM options for NECK Extension", () => {
    const result = pickTemplateROMDegrees("NECK", "Extension", "mild", 0.3);
    const ext = TEMPLATE_ROM.NECK.find((m) => m.name === "Extension")!;
    const validDegrees = ext.options.map((o) => o.degrees);
    expect(validDegrees).toContain(result);
  });

  it("returns a degree value from TEMPLATE_ROM for SHOULDER Abduction", () => {
    const result = pickTemplateROMDegrees(
      "SHOULDER",
      "Abduction",
      "severe",
      0.2,
    );
    const abd = TEMPLATE_ROM.SHOULDER.find((m) => m.name === "Abduction")!;
    const validDegrees = abd.options.map((o) => o.degrees);
    expect(validDegrees).toContain(result);
  });

  it("returns a degree value from TEMPLATE_ROM for KNEE Flexion", () => {
    const result = pickTemplateROMDegrees("KNEE", "Flexion", "moderate", 0.4);
    const flex = TEMPLATE_ROM.KNEE.find((m) => m.name === "Flexion")!;
    const validDegrees = flex.options.map((o) => o.degrees);
    expect(validDegrees).toContain(result);
  });

  it("severe severity picks from severe options", () => {
    const result = pickTemplateROMDegrees("LBP", "Flexion", "severe", 0.5);
    const flexion = TEMPLATE_ROM.LBP.find((m) => m.name === "Flexion")!;
    const severeOptions = flexion.options.filter(
      (o) => o.severity === "severe",
    );
    const severeDegrees = severeOptions.map((o) => o.degrees);
    expect(severeDegrees).toContain(result);
  });

  it("normal severity picks from normal options", () => {
    const result = pickTemplateROMDegrees("LBP", "Flexion", "normal", 0.5);
    const flexion = TEMPLATE_ROM.LBP.find((m) => m.name === "Flexion")!;
    const normalOptions = flexion.options.filter(
      (o) => o.severity === "normal",
    );
    const normalDegrees = normalOptions.map((o) => o.degrees);
    expect(normalDegrees).toContain(result);
  });

  it("rngValue 0 picks first option in severity band, rngValue ~1 picks last", () => {
    const result0 = pickTemplateROMDegrees("LBP", "Flexion", "moderate", 0.0);
    const result1 = pickTemplateROMDegrees("LBP", "Flexion", "moderate", 0.999);
    const flexion = TEMPLATE_ROM.LBP.find((m) => m.name === "Flexion")!;
    const modOptions = flexion.options.filter((o) => o.severity === "moderate");
    expect(result0).toBe(modOptions[0].degrees);
    expect(result1).toBe(modOptions[modOptions.length - 1].degrees);
  });

  it("returns null for unknown movement name", () => {
    const result = pickTemplateROMDegrees(
      "ELBOW",
      "Supination",
      "moderate",
      0.5,
    );
    expect(result).toBeNull();
  });

  it("all body parts and all movements return valid template degrees", () => {
    for (const bp of ALL_TEMPLATE_BPS) {
      for (const mov of TEMPLATE_ROM[bp]) {
        for (const sev of ["normal", "mild", "moderate", "severe"] as const) {
          const filtered = mov.options.filter((o) => o.severity === sev);
          if (filtered.length === 0) continue;
          const result = pickTemplateROMDegrees(bp, mov.name, sev, 0.5);
          const validDegrees = filtered.map((o) => o.degrees);
          expect(validDegrees).toContain(result);
        }
      }
    }
  });
});

describe("hasTemplateROM", () => {
  it("returns true for all BodyPartKey values", () => {
    for (const bp of ALL_TEMPLATE_BPS) {
      expect(hasTemplateROM(bp)).toBe(true);
    }
  });

  it("returns false for non-template body parts", () => {
    expect(hasTemplateROM("MIDDLE_BACK")).toBe(false);
    expect(hasTemplateROM("MID_LOW_BACK")).toBe(false);
    expect(hasTemplateROM("WRIST")).toBe(false);
    expect(hasTemplateROM("ANKLE")).toBe(false);
  });
});

describe("resolveTemplateMovementName", () => {
  it("maps NECK parenthetical names to TEMPLATE_ROM names", () => {
    expect(resolveTemplateMovementName("NECK", "Extension (look up)")).toBe(
      "Extension",
    );
    expect(resolveTemplateMovementName("NECK", "Flexion (look down)")).toBe(
      "Flexion",
    );
    expect(
      resolveTemplateMovementName(
        "NECK",
        "Flexion to the Right (bending right)",
      ),
    ).toBe("Lateral Flexion to the Right");
  });

  it("maps KNEE movement names", () => {
    expect(resolveTemplateMovementName("KNEE", "Flexion(fully bent)")).toBe(
      "Flexion",
    );
    expect(
      resolveTemplateMovementName("KNEE", "Extension(fully straight)"),
    ).toBe("Extension");
  });

  it("maps SHOULDER rotation case differences", () => {
    expect(resolveTemplateMovementName("SHOULDER", "External Rotation")).toBe(
      "External rotation",
    );
    expect(resolveTemplateMovementName("SHOULDER", "Internal Rotation")).toBe(
      "Internal rotation",
    );
  });

  it("maps HIP rotation case differences", () => {
    expect(resolveTemplateMovementName("HIP", "Internal Rotation")).toBe(
      "Internal rotation",
    );
    expect(resolveTemplateMovementName("HIP", "External Rotation")).toBe(
      "External rotation",
    );
  });

  it("passes through names that need no mapping", () => {
    expect(resolveTemplateMovementName("LBP", "Flexion")).toBe("Flexion");
    expect(resolveTemplateMovementName("SHOULDER", "Abduction")).toBe(
      "Abduction",
    );
  });
});

describe("getTemplateSeverityLabel", () => {
  it("returns correct severity for known degree values", () => {
    expect(getTemplateSeverityLabel("LBP", "Flexion", 90)).toBe("normal");
    expect(getTemplateSeverityLabel("LBP", "Flexion", 75)).toBe("mild");
    expect(getTemplateSeverityLabel("LBP", "Flexion", 50)).toBe("moderate");
    expect(getTemplateSeverityLabel("LBP", "Flexion", 25)).toBe("severe");
  });

  it("returns 'moderate' as fallback for unknown degrees", () => {
    expect(getTemplateSeverityLabel("LBP", "Flexion", 999)).toBe("moderate");
  });
});

describe("KNEE ROM picks from template options", () => {
  it("KNEE Flexion moderate returns a valid template degree", () => {
    const result = pickTemplateROMDegrees("KNEE", "Flexion", "moderate", 0.5);
    const flex = TEMPLATE_ROM.KNEE.find((m) => m.name === "Flexion")!;
    const modDegrees = flex.options
      .filter((o) => o.severity === "moderate")
      .map((o) => o.degrees);
    expect(modDegrees).toContain(result);
  });

  it("KNEE Extension normal returns 0", () => {
    const result = pickTemplateROMDegrees("KNEE", "Extension", "normal", 0.5);
    expect(result).toBe(0);
  });

  it("KNEE Extension severe returns -5", () => {
    const result = pickTemplateROMDegrees("KNEE", "Extension", "severe", 0.5);
    expect(result).toBe(-5);
  });
});

describe("SHOULDER ROM picks from template options", () => {
  it("SHOULDER Abduction severe returns a valid template degree", () => {
    const result = pickTemplateROMDegrees(
      "SHOULDER",
      "Abduction",
      "severe",
      0.5,
    );
    const abd = TEMPLATE_ROM.SHOULDER.find((m) => m.name === "Abduction")!;
    const severeDegrees = abd.options
      .filter((o) => o.severity === "severe")
      .map((o) => o.degrees);
    expect(severeDegrees).toContain(result);
  });

  it("SHOULDER External rotation mild returns a valid template degree", () => {
    const result = pickTemplateROMDegrees(
      "SHOULDER",
      "External rotation",
      "mild",
      0.5,
    );
    const ext = TEMPLATE_ROM.SHOULDER.find(
      (m) => m.name === "External rotation",
    )!;
    const mildDegrees = ext.options
      .filter((o) => o.severity === "mild")
      .map((o) => o.degrees);
    expect(mildDegrees).toContain(result);
  });
});

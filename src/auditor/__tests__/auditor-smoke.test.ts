/**
 * Auditor smoke tests — 3-layer integration + AuditorAgent aggregation.
 *
 * Covers gaps flagged in architecture-diagnosis.md: layer1/layer2/layer3
 * had zero unit tests before this file. These are smoke tests only —
 * not exhaustive rule coverage — so they lock in instantiation + basic
 * contract behaviour and catch top-level regressions.
 */

import {
  AuditorAgent,
  RuleComplianceEngine,
  MedicalLogicChecker,
  CaseSimilarityAnalyzer,
} from "../index";

describe("Auditor smoke", () => {
  describe("Layer 1 — RuleComplianceEngine", () => {
    test("instantiates and produces PASS result for empty note", () => {
      const engine = new RuleComplianceEngine();
      const result = engine.check({}, {});
      expect(result.layer).toBe("rule_compliance");
      expect(["PASS", "FAIL"]).toContain(result.result);
      expect(result.summary.total).toBeGreaterThan(0);
      expect(Array.isArray(result.violations)).toBe(true);
    });

    test("CRITICAL rule AC-6.1: Pacemaker + electrical stimulation triggers failure", () => {
      const engine = new RuleComplianceEngine();
      const result = engine.check({
        hasPacemaker: true,
        electricalStimulation: true,
      });
      const critical = result.violations.find((v) => v.ruleId === "AC-6.1");
      expect(critical).toBeDefined();
      expect(critical?.severity).toBe("CRITICAL");
    });

    test("CRITICAL rule V01: Pain regression across visits triggers failure", () => {
      const engine = new RuleComplianceEngine();
      const result = engine.check(
        { painScaleCurrent: 7 },
        { previousPain: 5, visitType: "follow-up" },
      );
      const v01 = result.violations.find((v) => v.ruleId === "V01");
      expect(v01).toBeDefined();
      expect(v01?.severity).toBe("CRITICAL");
    });
  });

  describe("Layer 2 — MedicalLogicChecker", () => {
    test("instantiates and returns Layer2Result shape", () => {
      const checker = new MedicalLogicChecker();
      const result = checker.check({});
      expect(result.layer).toBe("medical_logic");
      expect(["PASS", "WARNING"]).toContain(result.result);
      expect(Array.isArray(result.concerns)).toBe(true);
    });

    test("HS01 heuristic: Deficiency pattern + high pain flags concern", () => {
      const checker = new MedicalLogicChecker();
      const result = checker.check({
        systemicPattern: "Kidney Qi Deficiency",
        painScaleCurrent: 9,
      });
      const hs01 = result.concerns.find((c) => c.ruleId === "HS01");
      expect(hs01).toBeDefined();
      expect(hs01?.confidence).toBeGreaterThan(0);
    });
  });

  describe("Layer 3 — CaseSimilarityAnalyzer", () => {
    test("instantiates and returns Layer3Result shape", () => {
      const analyzer = new CaseSimilarityAnalyzer();
      const result = analyzer.check({});
      expect(result.layer).toBe("case_similarity");
      expect(["PASS", "WARNING"]).toContain(result.result);
      expect(typeof result.qualityScore).toBe("number");
      expect(Array.isArray(result.topMatches)).toBe(true);
    });

    test("matches a KNEE/Cold-Damp note against the golden case", () => {
      const analyzer = new CaseSimilarityAnalyzer();
      const result = analyzer.check({
        primaryBodyPart: "KNEE",
        noteType: "IE",
        painScaleCurrent: 8,
        systemicPattern: "Cold-Damp",
      });
      // Any match to the golden KNEE case should appear in topMatches
      const goldenMatch = result.topMatches.find(
        (m) => m.caseId === "GOLDEN_KNEE_IE_001",
      );
      expect(goldenMatch).toBeDefined();
      expect(goldenMatch?.type).toBe("excellent");
    });
  });

  describe("AuditorAgent — aggregation", () => {
    test("audit() returns overallResult + qualityScore + all 3 layer results", () => {
      const agent = new AuditorAgent();
      const report = agent.audit(
        {
          painScaleCurrent: 6,
          primaryBodyPart: "LBP",
          systemicPattern: "Qi Stagnation",
        },
        {},
      );
      expect(["PASS", "WARNING", "FAIL"]).toContain(report.overallResult);
      expect(report.qualityScore).toBeGreaterThanOrEqual(0);
      expect(report.qualityScore).toBeLessThanOrEqual(100);
      expect(report.layer1.layer).toBe("rule_compliance");
      expect(report.layer2.layer).toBe("medical_logic");
      expect(report.layer3.layer).toBe("case_similarity");
      expect(typeof report.timestamp).toBe("string");
    });

    test("CRITICAL violation from Layer 1 propagates to overallResult = FAIL", () => {
      const agent = new AuditorAgent();
      const report = agent.audit({
        hasPacemaker: true,
        electricalStimulation: true,
      });
      expect(report.overallResult).toBe("FAIL");
      expect(report.qualityScore).toBeLessThan(100);
    });

    test("quickCheck() returns only Layer 1 result", () => {
      const agent = new AuditorAgent();
      const result = agent.quickCheck({ painScaleCurrent: 5 });
      expect(result.layer).toBe("rule_compliance");
    });

    test("formatReport() produces a non-empty human-readable string", () => {
      const agent = new AuditorAgent();
      const report = agent.audit({ painScaleCurrent: 5 });
      const text = agent.formatReport(report);
      expect(text).toContain("SOAP 审核报告");
      expect(text.length).toBeGreaterThan(50);
    });
  });
});

import type { VisitRecord } from "../types";
import type {
  CheckInput,
  CheckOutput,
  CheckError,
  RuleSeverity,
  TimelineEntry,
  ScoreBreakdown,
} from "./types";
import { generateCorrections } from "./correction-generator";
import {
  avgRom,
  avgStrength,
  trend,
  err,
} from "./rules/shared";
import { RULE_EXECUTION_PLAN } from "./rules";
import {
  compareSeverity,
  extractPainCurrent,
  parseFrequencyLevel,
} from "../../../src/shared/field-parsers";

function scoreDocument(errors: CheckError[], _txCount: number): ScoreBreakdown {
  const hasCritical = errors.some((e) => e.severity === "CRITICAL");
  if (hasCritical) {
    return {
      ieConsistency: 0,
      txConsistency: 0,
      timelineLogic: 0,
      totalScore: 0,
      grade: "FAIL",
    };
  }
  const penaltyMap: Record<RuleSeverity, number> = {
    CRITICAL: 0,
    HIGH: 15,
    MEDIUM: 8,
    LOW: 0,
  };
  const totalPenalty = errors.reduce((s, e) => s + penaltyMap[e.severity], 0);
  const totalScore = Math.max(0, 100 - totalPenalty);
  const grade: "PASS" | "WARNING" | "FAIL" =
    totalScore >= 80 ? "PASS" : totalScore >= 60 ? "WARNING" : "FAIL";
  return {
    ieConsistency: totalScore,
    txConsistency: totalScore,
    timelineLogic: totalScore,
    totalScore,
    grade,
  };
}

function buildTimeline(
  visits: VisitRecord[],
  errors: CheckError[],
): TimelineEntry[] {
  return visits.map((v, i) => {
    const prev = i > 0 ? visits[i - 1] : undefined;
    const pain = extractPainCurrent(v.subjective.painScale);
    const prevPain = prev
      ? extractPainCurrent(prev.subjective.painScale)
      : pain;
    const curT = v.objective.tendernessMuscles.scale;
    const prevT = prev ? prev.objective.tendernessMuscles.scale : curT;
    const curTight = v.objective.tightnessMuscles.gradingScale;
    const prevTight = prev
      ? prev.objective.tightnessMuscles.gradingScale
      : curTight;
    const curSpasm = v.objective.spasmMuscles.frequencyScale;
    const prevSpasm = prev
      ? prev.objective.spasmMuscles.frequencyScale
      : curSpasm;
    const curF = parseFrequencyLevel(v.subjective.painFrequency);
    const prevF = prev
      ? parseFrequencyLevel(prev.subjective.painFrequency)
      : curF;
    const curRom = avgRom(v);
    const prevRom = prev ? avgRom(prev) : curRom;
    const curStrength = avgStrength(v);
    const prevStrength = prev ? avgStrength(prev) : curStrength;
    const byVisit = errors.filter((e) => e.visitIndex === i);

    return {
      visitDate: v.assessment.date || "",
      visitIndex: i,
      visitType: v.subjective.visitType === "INITIAL EVALUATION" ? "IE" : "TX",
      indicators: {
        pain: {
          value: pain,
          label: String(pain),
          trend: trend(pain, prevPain),
          ok: pain <= prevPain,
        },
        tenderness: {
          value: `+${curT}`,
          trend: trend(curT, prevT),
          ok: curT <= prevT,
        },
        tightness: {
          value: curTight,
          trend:
            compareSeverity(curTight, prevTight) < 0
              ? "↓"
              : compareSeverity(curTight, prevTight) > 0
                ? "↑"
                : "→",
          ok: compareSeverity(curTight, prevTight) <= 0,
        },
        spasm: {
          value: `+${curSpasm}`,
          trend: trend(curSpasm, prevSpasm),
          ok: curSpasm <= prevSpasm,
        },
        frequency: {
          value: v.subjective.painFrequency,
          trend: trend(curF, prevF),
          ok: curF <= prevF,
        },
        rom: {
          summary: curRom.toFixed(1),
          trend: trend(curRom, prevRom),
          ok: curRom >= prevRom,
        },
        strength: {
          summary: curStrength.toFixed(2),
          trend: trend(curStrength, prevStrength),
          ok: curStrength >= prevStrength,
        },
      },
      errors: byVisit,
    };
  });
}

export function checkDocument(input: CheckInput): CheckOutput {
  const doc = input.document;
  const visits = doc.visits;
  const errors: CheckError[] = [];
  const insuranceType = input.insuranceType || "OPTUM";
  const treatmentTime = input.treatmentTime ?? 15;

  // 1. DOC rules
  for (const rule of RULE_EXECUTION_PLAN.doc) {
    errors.push(...rule.check({ visits }));
  }

  // 2. per-visit IE/TX interleaved
  const ieVisit =
    visits.find((v) => v.subjective.visitType === "INITIAL EVALUATION") ??
    null;
  visits.forEach((visit, idx) => {
    const isIE = visit.subjective.visitType === "INITIAL EVALUATION";
    if (isIE) {
      for (const rule of RULE_EXECUTION_PLAN.ie) {
        errors.push(...rule.check({ visit, visitIndex: idx }));
      }
    } else {
      const prevVisit = idx > 0 ? visits[idx - 1] : null;
      for (const rule of RULE_EXECUTION_PLAN.tx) {
        errors.push(
          ...rule.check({ visit, visitIndex: idx, ieVisit, prevVisit }),
        );
      }
    }
  });

  // 3. SEQUENCE — pair-level loop preserves original emission order
  for (let i = 1; i < visits.length; i++) {
    const prev = visits[i - 1];
    const cur = visits[i];
    if (prev.subjective.visitType === "INITIAL EVALUATION") continue;
    const ctx = { visits, prev, cur, visitIndex: i };
    for (const rule of RULE_EXECUTION_PLAN.sequence) {
      errors.push(...rule.check(ctx));
    }
  }

  // 4. CODE — per-visit with hoisted writer-mode stats
  const allMissingDx = visits.every((v) => v.diagnosisCodes.length === 0);
  const allMissingCpt = visits.every((v) => v.procedureCodes.length === 0);
  visits.forEach((visit, idx) => {
    const ctx = {
      visits,
      visit,
      visitIndex: idx,
      insuranceType,
      treatmentTime,
      allMissingDx,
      allMissingCpt,
    };
    for (const rule of RULE_EXECUTION_PLAN.code) {
      errors.push(...rule.check(ctx));
    }
  });

  // 5. GENERATOR — per-visit
  visits.forEach((visit, idx) => {
    const ctx = { visits, visit, visitIndex: idx };
    for (const rule of RULE_EXECUTION_PLAN.generator) {
      errors.push(...rule.check(ctx));
    }
  });

  const txCount = visits.filter(
    (v) => v.subjective.visitType !== "INITIAL EVALUATION",
  ).length;
  const scoring = scoreDocument(errors, txCount);

  const critical = errors.filter((e) => e.severity === "CRITICAL").length;
  const high = errors.filter((e) => e.severity === "HIGH").length;
  const medium = errors.filter((e) => e.severity === "MEDIUM").length;
  const low = errors.filter((e) => e.severity === "LOW").length;

  return {
    patient: doc.header.patient,
    summary: {
      totalVisits: visits.length,
      visitDateRange: {
        first: visits[0]?.assessment?.date || doc.header.dateOfService,
        last:
          visits[visits.length - 1]?.assessment?.date ||
          doc.header.dateOfService,
      },
      errorCount: {
        critical,
        high,
        medium,
        low,
        total: errors.length,
      },
      scoring,
    },
    timeline: buildTimeline(visits, errors),
    errors,
    corrections: generateCorrections(doc, errors),
  };
}

// Re-export `err` for any external callers that referenced it via note-checker
export { err };

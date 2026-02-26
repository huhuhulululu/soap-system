/**
 * Correction Generator - 使用标准 SOAP 生成器
 * 基于检测到的错误，调用 exportSOAPAsText 生成修正后的完整 SOAP 文本
 */

import type { OptumNoteDocument, VisitRecord } from "../types";
import type { CheckError, CorrectionItem, FieldFix } from "./types";
import { bridgeToContext, bridgeVisitToSOAPNote } from "./bridge";
import { exportSOAPAsText } from "../../../src/generator/soap-generator";
import type { GenerationContext } from "../../../src/types";
import {
  severityFromPain,
  expectedTenderMinScaleByPain,
} from "../../../src/shared/severity";
import { getPatternTonguePulse } from "../../../src/shared/tcm-mappings";
import { extractPainCurrent } from "../../../src/shared/field-parsers";

// ============ 辅助函数 ============

// ============ 修正计算 ============

import { computePatchedGoals } from "../../../src/generator/objective-patch";
import type { BodyPart } from "../../../src/types";

// 默认穴位 by bodyPart
const DEFAULT_ACUPOINTS: Record<string, string[]> = {
  KNEE: ["ST34", "ST35", "ST36", "GB34", "SP9", "SP10"],
  SHOULDER: ["LI15", "LI16", "SI9", "SI10", "GB21", "SJ14"],
  LBP: ["BL23", "BL25", "BL40", "DU4", "GB30"],
  NECK: ["GB20", "GB21", "BL10", "SI14", "DU14"],
};

function computeFixes(
  visit: VisitRecord,
  prevVisit: VisitRecord | undefined,
  errors: CheckError[],
): FieldFix[] {
  const fixes: FieldFix[] = [];
  const pain = extractPainCurrent(visit.subjective.painScale);
  const bp = (visit.subjective.bodyPartNormalized || "LBP") as BodyPart;
  const severity = severityFromPain(pain);

  for (const error of errors) {
    switch (error.ruleId) {
      case "IE01":
      case "TX01": {
        const correctedSeverity = severityFromPain(pain);
        fixes.push({
          field: "adlDifficultyLevel",
          original: error.actual,
          corrected: correctedSeverity,
          reason: `Pain=${pain} 应对应 ${correctedSeverity} 严重程度`,
        });
        break;
      }

      case "IE02":
      case "TX02": {
        const minTender = expectedTenderMinScaleByPain(pain);
        fixes.push({
          field: "tenderness",
          original: error.actual,
          corrected: `+${minTender}`,
          reason: `Pain=${pain} 应对应 +${minTender} tenderness`,
        });
        break;
      }

      case "IE04": {
        // 舌脉→证型一致：根据证型选择匹配的舌脉
        const pattern =
          visit.assessment.localPattern ||
          visit.assessment.tcmDiagnosis?.pattern ||
          "Qi Stagnation";
        const tp =
          getPatternTonguePulse(pattern) ||
          getPatternTonguePulse("Qi Stagnation")!;
        fixes.push({
          field: "tonguePulse",
          original: error.actual,
          corrected: `${tp.tongue} / ${tp.pulse}`,
          reason: `证型 ${pattern} 应对应匹配的舌脉`,
        });
        break;
      }

      case "IE05": {
        // ST Goal pain < current pain：用 computePatchedGoals 计算
        const goals = computePatchedGoals(pain, severity, bp);
        fixes.push({
          field: "shortTermGoal.painScaleTarget",
          original: error.actual,
          corrected: goals.pain.st,
          reason: `Pain=${pain} 的 ST Goal 应为 ${goals.pain.st}`,
        });
        break;
      }

      case "IE06": {
        // LT Goal pain < ST Goal pain：用 computePatchedGoals 计算
        const goals = computePatchedGoals(pain, severity, bp);
        fixes.push({
          field: "longTermGoal.painScaleTarget",
          original: error.actual,
          corrected: goals.pain.lt,
          reason: `Pain=${pain} 的 LT Goal 应为 ${goals.pain.lt}`,
        });
        break;
      }

      case "IE07": {
        // TCM diagnosis 完整：生成默认证型
        fixes.push({
          field: "tcmDiagnosis",
          original: "missing",
          corrected: "Qi Stagnation (local) + Qi Deficiency (systemic)",
          reason: "初诊应包含完整 TCM diagnosis",
        });
        break;
      }

      case "IE08": {
        // 穴位信息存在：根据 bodyPart 生成默认穴位
        const acupoints = DEFAULT_ACUPOINTS[bp] || DEFAULT_ACUPOINTS["LBP"];
        fixes.push({
          field: "acupoints",
          original: "empty",
          corrected: acupoints.join(", "),
          reason: `${bp} 的默认穴位`,
        });
        break;
      }

      case "T02":
      case "T03":
      case "TX03": {
        fixes.push({
          field: "symptomChange",
          original: error.actual,
          corrected: "similar symptom(s) as last visit",
          reason: "基于疼痛变化趋势修正",
        });
        break;
      }

      case "T06":
      case "TX04": {
        // improvement + negative reason → positive reason; exacerbate + positive reason → negative reason
        const isExacerbate = error.message?.includes("exacerbate");
        fixes.push({
          field: "progressReason",
          original: error.actual,
          corrected: isExacerbate
            ? "discontinuous treatment"
            : "maintain regular treatments",
          reason: "修正进展原因以匹配状态",
        });
        break;
      }

      case "T07":
      case "X4":
      case "IE03": {
        fixes.push({
          field: "electricalStimulation",
          original: "with",
          corrected: "without",
          reason: "Pacemaker 禁忌电刺激",
        });
        break;
      }

      case "TX05": {
        fixes.push({
          field: "tonguePulse",
          original: error.actual,
          corrected: error.expected,
          reason: "TX 舌脉应与 IE 基线一致",
        });
        break;
      }

      case "TX06": {
        fixes.push({
          field: "goals",
          original: "present",
          corrected: "removed",
          reason: "TX 不应携带 short/long term goals",
        });
        break;
      }
    }
  }

  return fixes;
}

// ============ 应用修正到 Context ============

// tenderness 等级反向映射到 severity
const TENDER_TO_SEVERITY: Record<string, string> = {
  "+4": "severe",
  "+3": "moderate to severe",
  "+2": "mild to moderate",
  "+1": "mild",
};

function applyFixesToContext(
  context: GenerationContext,
  visit: VisitRecord,
  fixes: FieldFix[],
): GenerationContext {
  const updatedContext = { ...context };

  for (const fix of fixes) {
    switch (fix.field) {
      case "adlDifficultyLevel":
        updatedContext.severityLevel = fix.corrected as any;
        break;
      case "tenderness":
        // +4 → severe, +3 → moderate to severe, etc.
        const mappedSeverity = TENDER_TO_SEVERITY[fix.corrected];
        if (mappedSeverity)
          updatedContext.severityLevel = mappedSeverity as any;
        break;
      case "electricalStimulation":
        updatedContext.hasPacemaker = true;
        break;
    }
  }

  return updatedContext;
}

// ============ 生成修正后的 SOAP 文本 ============

function generateCorrectedSOAP(
  document: OptumNoteDocument,
  visit: VisitRecord,
  visitIndex: number,
  fixes: FieldFix[],
): string {
  // 1. 从 document 构建 context（基于 IE 基线）
  const ieIndex = document.visits.findIndex(
    (v) => v.subjective.visitType === "INITIAL EVALUATION",
  );
  // 如果没有 IE，用当前 visit 的 index
  const contextIndex = ieIndex >= 0 ? ieIndex : visitIndex;
  const context = bridgeToContext(document, contextIndex);

  // 对 TX visit，覆盖 severity 为当前 visit 的实际值
  if (visitIndex !== contextIndex) {
    const pain = extractPainCurrent(visit.subjective.painScale);
    context.severityLevel = severityFromPain(pain);
  }

  // 2. 应用修正
  const correctedContext = applyFixesToContext(context, visit, fixes);

  // 3. 判断是 IE 还是 TX
  const isIE = visit.subjective.visitType === "INITIAL EVALUATION";

  if (isIE) {
    // IE: 直接调用标准生成器（不需要 visitState）
    correctedContext.noteType = "IE";
    return exportSOAPAsText(correctedContext);
  } else {
    // TX: 需要从 visit 构建 visitState
    correctedContext.noteType = "TX";

    // 处理 tonguePulse fix: 从 IE 继承
    const tonguePulseFix = fixes.find((f) => f.field === "tonguePulse");
    let tonguePulse = visit.objective.tonguePulse || {
      tongue: "pale",
      pulse: "thready",
    };
    if (tonguePulseFix && tonguePulseFix.corrected) {
      // expected 格式: "pale, thin white coat / thready"
      const parts = tonguePulseFix.corrected.split(" / ");
      if (parts.length === 2) {
        tonguePulse = { tongue: parts[0], pulse: parts[1] };
      }
    }

    // 从 VisitRecord 提取 visitState 关键字段
    const visitState = {
      visitIndex,
      progress: 0.5, // 简化处理
      painScaleCurrent: extractPainCurrent(visit.subjective.painScale),
      painScaleLabel: String(extractPainCurrent(visit.subjective.painScale)),
      severityLevel: correctedContext.severityLevel,
      symptomChange:
        fixes.find((f) => f.field === "symptomChange")?.corrected ||
        "improvement of symptom(s)",
      reasonConnector: "because of",
      reason:
        fixes.find((f) => f.field === "progressReason")?.corrected ||
        "maintain regular treatments",
      associatedSymptom: "soreness",
      painFrequency: visit.subjective.painFrequency || "Frequent",
      generalCondition: "good",
      treatmentFocus: "focus",
      tightnessGrading:
        visit.objective.tightnessMuscles?.gradingScale || "moderate",
      tendernessGrading:
        visit.objective.tendernessMuscles?.scaleDescription ||
        "(+2) = Patient states that the area is moderately tender",
      spasmGrading:
        visit.objective.spasmMuscles?.scaleDescription ||
        "(+2)=Occasional spontaneous spasms",
      needlePoints: visit.plan.acupoints || ["LI4", "LI11", "GB34"],
      tonguePulse,
      objectiveFactors: {
        sessionGapDays: 3,
        sleepLoad: 0.5,
        workloadLoad: 0.5,
        weatherExposureLoad: 0.3,
        adherenceLoad: 0.2,
      },
      soaChain: {
        subjective: {
          painChange: "improved" as const,
          adlChange: "improved" as const,
          frequencyChange: "stable" as const,
        },
        objective: {
          tightnessTrend: "reduced" as const,
          tendernessTrend: "reduced" as const,
          romTrend: "improved" as const,
          strengthTrend: "improved" as const,
        },
        assessment: {
          present: "improvement of symptom(s).",
          patientChange: "decreased",
          whatChanged: "pain",
          physicalChange: "reduced",
          findingType: "local muscles tightness",
        },
      },
    };

    // 调用标准生成器
    return exportSOAPAsText(correctedContext, visitState as any);
  }
}

// ============ 标记修正 ============

function addCorrectionMarkers(soapText: string, fixes: FieldFix[]): string {
  if (fixes.length === 0) return soapText;

  let annotatedText = soapText;

  for (const fix of fixes) {
    if (fix.original === fix.corrected) continue;

    const lines = annotatedText.split("\n");
    const correctedLower = fix.corrected.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (lineLower.includes(correctedLower)) {
        if (!lines[i].includes("[CORRECTED:")) {
          lines[i] = `${lines[i]} [CORRECTED: was "${fix.original}"]`;
        }
        break;
      }
    }

    annotatedText = lines.join("\n");
  }

  return annotatedText;
}

// ============ 主导出函数 ============

export function generateCorrections(
  document: OptumNoteDocument,
  errors: CheckError[],
): CorrectionItem[] {
  const corrections: CorrectionItem[] = [];
  const visits = document.visits;

  // 按 visit 分组错误
  const errorsByVisit = new Map<number, CheckError[]>();
  for (const error of errors) {
    const idx = error.visitIndex;
    if (!errorsByVisit.has(idx)) {
      errorsByVisit.set(idx, []);
    }
    errorsByVisit.get(idx)!.push(error);
  }

  // 为每个有错误的 visit 生成完整的修正后 SOAP
  for (const [visitIndex, visitErrors] of Array.from(errorsByVisit.entries())) {
    const visit = visits[visitIndex];
    if (!visit) continue;

    const prevVisit = visitIndex > 0 ? visits[visitIndex - 1] : undefined;

    // 计算所有修正（不按 section 分组）
    const fieldFixes = computeFixes(visit, prevVisit, visitErrors);

    // 使用标准生成器生成完整的修正后 SOAP
    const correctedFullText = generateCorrectedSOAP(
      document,
      visit,
      visitIndex,
      fieldFixes,
    );

    // 添加修正标记
    const correctedAnnotatedText = addCorrectionMarkers(
      correctedFullText,
      fieldFixes,
    );

    // 生成单个修正项（包含完整 SOAP，不再按 section 分割）
    // section 取第一个 error 的 section
    const primarySection = visitErrors[0]?.section || "S";
    corrections.push({
      visitDate: visit.assessment.date || "",
      visitIndex,
      section: primarySection,
      errors: visitErrors,
      fieldFixes,
      correctedFullText,
      correctedAnnotatedText,
    });
  }

  return corrections;
}

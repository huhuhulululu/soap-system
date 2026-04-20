/**
 * Export orchestrator — W3 Step 8
 *
 * Exports:
 * - exportSOAPSections / exportSOAP / exportSOAPAsText — 单次 SOAP 渲染
 * - exportTXSeriesAsText — TX 序列批量渲染（含 ROM floor 单调性追踪 + GATE-01）
 * - SOAPFormat / SOAPSectionsOutput / TXSeriesTextItem — 公共类型
 *
 * 该 renderer 按 noteType 分派到 subjective-ie/tx、objective、assessment、
 * plan-ie/tx、needle-protocol 各个独立 renderer。
 */

import type { GenerationContext } from "../../types";
import type { TXVisitState, TXSequenceOptions } from "../tx-sequence-engine";
import { generateTXSequenceStates } from "../tx-sequence-engine";
import { createSeededRng } from "../../shared/seeded-rng";
import { generateSubjective } from "./subjective-ie";
import { generateSubjectiveTX } from "./subjective-tx";
import { generateObjective } from "./objective";
import { generateAssessment, generateAssessmentTX } from "./assessment";
import { generatePlanIE } from "./plan-ie";
import { generatePlanTX } from "./plan-tx";
import { generateNeedleProtocol } from "./needle-protocol";
import {
  assertTemplateSupported,
  plainToHtmlSection,
  type SOAPFormat,
} from "./_shared";

// Re-export SOAPFormat so consumers can import from './renderers/export' (AC6).
export type { SOAPFormat };

/**
 * 统一导出 SOAP 四段内容
 */
export interface SOAPSectionsOutput {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export function exportSOAPSections(
  context: GenerationContext,
  visitState?: TXVisitState,
  format: SOAPFormat = "text",
): SOAPSectionsOutput {
  assertTemplateSupported(context);
  const isHtml = format === "html";

  if (context.noteType === "TX") {
    // TX (Daily Note / Treatment Note)
    const subjective = generateSubjectiveTX(context, visitState, format);
    const objective = generateObjective(context, visitState, undefined, format);
    const assessment = generateAssessmentTX(context, visitState, format);
    const planTx = generatePlanTX(context, visitState, format);
    const needleProtocol = generateNeedleProtocol(context, visitState);
    const plan = isHtml
      ? `${planTx}<br><br>${plainToHtmlSection(needleProtocol)}`
      : `${planTx}\n\n${needleProtocol}`;

    return {
      subjective,
      objective,
      assessment,
      plan,
    };
  }

  // IE (Initial Evaluation)
  const { rng } = createSeededRng(context.seed);
  const subjectiveText = generateSubjective(context, rng);
  const objective = generateObjective(context, undefined, rng, format);
  const assessmentText = generateAssessment(context);
  const planText = generatePlanIE(context);
  const needleProtocol = generateNeedleProtocol(context, undefined, rng);
  const subjective = isHtml ? plainToHtmlSection(subjectiveText) : subjectiveText;
  const assessment = isHtml ? plainToHtmlSection(assessmentText) : assessmentText;
  const plan = isHtml
    ? `${plainToHtmlSection(planText)}<br><br>${plainToHtmlSection(needleProtocol)}`
    : `${planText}\n\n${needleProtocol}`;

  return {
    subjective,
    objective,
    assessment,
    plan,
  };
}

export function exportSOAP(
  context: GenerationContext,
  visitState?: TXVisitState,
  format: SOAPFormat = "text",
): string {
  const sections = exportSOAPSections(context, visitState, format);
  let output = `Subjective\n${sections.subjective}\n\n`;
  output += `Objective\n${sections.objective}\n\n`;
  output += `Assessment\n${sections.assessment}\n\n`;
  output += `Plan\n${sections.plan}`;
  return output;
}

/**
 * 向后兼容旧接口
 */
export const exportSOAPAsText = (
  context: GenerationContext,
  visitState?: TXVisitState,
): string => exportSOAP(context, visitState, "text");

export interface TXSeriesTextItem {
  visitIndex: number;
  state: TXVisitState;
  text: string;
  html?: string;
}

/**
 * 基于 IE 基线批量生成 TX 文本序列
 * - 纵向链: tx-sequence-engine
 * - 横向链: rule-engine/template rules
 * - P 保持原生成逻辑不变
 */
export function exportTXSeriesAsText(
  context: GenerationContext,
  options: TXSequenceOptions,
): TXSeriesTextItem[] {
  const txContext: GenerationContext = {
    ...context,
    noteType: "TX",
  };
  assertTemplateSupported(txContext);

  const { states } = generateTXSequenceStates(txContext, options);
  const ieBaselinePain = context.painCurrent ?? 8;
  const includeHtml = options.includeHtml === true;

  // Track per-movement ROM degree floors across visits (monotonicity guard)
  let romFloors: Record<string, number> = {};

  return states.map((state) => {
    // Inject accumulated ROM floors from previous visits
    const stateWithFloors = romFloors && Object.keys(romFloors).length > 0
      ? { ...state, romFloors }
      : state;

    let text = exportSOAP(txContext, stateWithFloors, "text");
    let html: string | undefined;
    if (includeHtml) {
      html = exportSOAP(txContext, stateWithFloors, "html");
    }

    // Extract ROM degrees from rendered text to update floors for next visit
    // Format: "4/5 Flexion: 40 Degrees (moderate)" or "4/5 Flexion: 40 degree (moderate)"
    const romPattern = /^\d[+-]?\/5\s+(.+?):\s+(\d+)\s+(?:Degrees|degree)/gim;
    const nextFloors: Record<string, number> = { ...romFloors };
    for (const line of text.split("\n")) {
      const m = romPattern.exec(line.trim());
      if (m) {
        const movement = m[1];
        const degrees = parseInt(m[2]);
        nextFloors[movement] = Math.max(nextFloors[movement] ?? 0, degrees);
      }
      romPattern.lastIndex = 0;
    }
    romFloors = nextFloors;

    // GATE-01: Medicare phase gate — annotate visit 12 for ELDERPLAN with NCD 30.3.3 evidence
    if (context.insuranceType === "ELDERPLAN" && state.visitIndex === 12) {
      const painDrop = ieBaselinePain - state.painScaleCurrent;
      const improvementPct =
        ieBaselinePain > 0 ? Math.round((painDrop / ieBaselinePain) * 100) : 0;
      const annotation = [
        "\n--- NCD 30.3.3 Phase Gate (Visit 12) ---",
        `Baseline Pain: ${ieBaselinePain}/10`,
        `Current Pain: ${state.painScaleCurrent}/10`,
        `Cumulative Improvement: ${improvementPct}% reduction`,
        `Severity: ${state.severityLevel}`,
        `Progress: ${Math.round(state.progress * 100)}%`,
        `Recommendation: ${improvementPct >= 15 ? "Continue treatment — measurable functional improvement documented" : "Re-evaluate treatment plan — insufficient improvement"}`,
        "--- End Phase Gate ---",
      ].join("\n");
      text += annotation;
      if (html != null) {
        html += `<br>${plainToHtmlSection(annotation)}`;
      }
    }

    return { visitIndex: state.visitIndex, state, text, html };
  });
}

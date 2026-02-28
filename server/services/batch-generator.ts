/**
 * 批量生成服务
 *
 * 将 Excel 解析后的 BatchData 中每个 visit 调用 SOAP 生成引擎：
 * - IE/RE: exportSOAPAsText(context)
 * - TX: exportTXSeriesAsText(context, options) → 一次性生成同患者所有 TX
 *
 * 生成后将 SOAP 文本拆分为 S/O/A/P 四段，附加到 visit.generated
 */

import type { TXSequenceOptions } from "../../src/generator/tx-sequence-engine";
import {
  exportSOAPAsText,
  exportTXSeriesAsText,
} from "../../src/generator/soap-generator";
import { patchSOAPText } from "../../src/generator/objective-patch";
import {
  normalizeGenerationContext,
  type NormalizeInput,
} from "../../src/shared/normalize-generation-context";
import {
  extractStateFromTX,
  buildContextFromExtracted,
  buildInitialStateFromExtracted,
} from "../../src/parser/tx-extractor";
import { splitSOAPText } from "./text-to-html";
import type { BatchData, BatchPatient, BatchVisit } from "../types";

/**
 * Map BatchPatient + BatchVisit to NormalizeInput for the shared normalizer.
 * TCM patterns are inferred (no explicit overrides in batch path).
 */
function toBatchInput(
  patient: BatchPatient,
  visit: BatchVisit,
  disableChronicCaps?: boolean,
): NormalizeInput {
  const { clinical } = patient;
  return {
    noteType: visit.noteType,
    insuranceType: patient.insurance,
    primaryBodyPart: visit.bodyPart,
    laterality: visit.laterality,
    painCurrent: clinical.painCurrent,
    severityLevel: clinical.severityLevel,
    secondaryBodyParts: [...visit.secondaryParts],
    painWorst: clinical.painWorst,
    painBest: clinical.painBest,
    painTypes: [...clinical.painTypes],
    associatedSymptom:
      (clinical.associatedSymptoms[0] as NormalizeInput["associatedSymptom"]) ??
      "soreness",
    associatedSymptoms: [...clinical.associatedSymptoms],
    symptomDuration: { ...clinical.symptomDuration },
    painRadiation: clinical.painRadiation,
    symptomScale: clinical.symptomScale,
    painFrequency: clinical.painFrequency,
    causativeFactors: [...clinical.causativeFactors],
    relievingFactors: [...clinical.relievingFactors],
    recentWorse: clinical.recentWorse
      ? { ...clinical.recentWorse }
      : { value: "1", unit: "week(s)" },
    chronicityLevel: clinical.chronicityLevel ?? "Chronic",
    age: patient.age,
    gender: patient.gender,
    medicalHistory: [...visit.history],
    disableChronicCaps,
  };
}

/**
 * 为单个 visit 生成 SOAP 文本并拆分
 */
function generateSingleVisit(
  patient: BatchPatient,
  visit: BatchVisit,
  seed?: number,
  realisticPatch?: boolean,
  disableChronicCaps?: boolean,
): BatchVisit {
  const { context } = normalizeGenerationContext(
    toBatchInput(patient, visit, disableChronicCaps),
  );
  const actualSeed = seed ?? Math.floor(Math.random() * 100000);

  let fullText = exportSOAPAsText(context);
  if (realisticPatch) fullText = patchSOAPText(fullText, context);
  const soap = splitSOAPText(fullText);

  return {
    ...visit,
    generated: {
      soap,
      fullText,
      seed: actualSeed,
    },
    status: "done" as const,
  };
}

/**
 * 为同一患者的所有 TX visits 批量生成
 * 使用 TX Sequence Engine 保持纵向一致性
 */
function generateTXSeries(
  patient: BatchPatient,
  txVisits: readonly BatchVisit[],
  _ieVisit: BatchVisit | undefined,
  realisticPatch?: boolean,
  disableChronicCaps?: boolean,
): BatchVisit[] {
  if (txVisits.length === 0) return [];

  const firstTX = txVisits[0];
  const { context, initialState } = normalizeGenerationContext(
    toBatchInput(patient, firstTX, disableChronicCaps),
  );

  const options: TXSequenceOptions = {
    txCount: txVisits.length,
    seed: patient.seed ?? Math.floor(Math.random() * 100000),
    initialState,
  };

  const results = exportTXSeriesAsText(context, options);

  return txVisits.map((visit, i) => {
    const result = results[i];
    if (!result) {
      return {
        ...visit,
        status: "failed" as const,
      };
    }

    const patchedText = realisticPatch
      ? patchSOAPText(result.text, context, result.state)
      : result.text;
    const soap = splitSOAPText(patchedText);
    return {
      ...visit,
      generated: {
        soap,
        fullText: patchedText,
        seed: options.seed ?? 0,
        state: result.state,
      },
      status: "done" as const,
    };
  });
}

export interface BatchGenerationResult {
  readonly batchId: string;
  readonly totalGenerated: number;
  readonly totalFailed: number;
  readonly patients: BatchPatient[];
}

/**
 * 为整个 Batch 中所有患者的所有 visits 生成 SOAP
 *
 * 策略:
 * 1. 先生成 IE/RE (独立生成)
 * 2. 再生成 TX 序列 (使用 TX Sequence Engine 保持连续性)
 */
export function generateBatch(
  batch: BatchData,
  realisticPatch?: boolean,
  disableChronicCaps?: boolean,
): BatchGenerationResult {
  let totalGenerated = 0;
  let totalFailed = 0;

  const updatedPatients = batch.patients.map((patient) => {
    // 分类 visits
    const ieVisit = patient.visits.find((v) => v.noteType === "IE");
    const reVisits = patient.visits.filter((v) => v.noteType === "RE");
    const txVisits = patient.visits.filter((v) => v.noteType === "TX");

    // 1. 生成 IE
    const generatedIE = ieVisit
      ? generateSingleVisit(
          patient,
          ieVisit,
          undefined,
          realisticPatch,
          disableChronicCaps,
        )
      : undefined;

    // 2. 生成 RE
    const generatedRE = reVisits.map((v) =>
      generateSingleVisit(
        patient,
        v,
        undefined,
        realisticPatch,
        disableChronicCaps,
      ),
    );

    // 3. 生成 TX 序列
    const generatedTX = generateTXSeries(
      patient,
      txVisits,
      generatedIE,
      realisticPatch,
      disableChronicCaps,
    );

    // 重新组装 visits (保持原始顺序)
    const updatedVisits = patient.visits.map((originalVisit) => {
      if (originalVisit.noteType === "IE" && generatedIE) {
        return generatedIE;
      }
      const reMatch = generatedRE.find((v) => v.index === originalVisit.index);
      if (reMatch) return reMatch;
      const txMatch = generatedTX.find((v) => v.index === originalVisit.index);
      if (txMatch) return txMatch;
      return originalVisit;
    });

    // 统计
    for (const v of updatedVisits) {
      if (v.status === "done") totalGenerated++;
      else if (v.status === "failed") totalFailed++;
    }

    return {
      ...patient,
      visits: updatedVisits,
    };
  });

  return {
    batchId: batch.batchId,
    totalGenerated,
    totalFailed,
    patients: updatedPatients,
  };
}

/**
 * Continue 模式：从 TX SOAP 文本提取状态并续写
 */
export function generateContinueBatch(
  batch: BatchData,
  realisticPatch?: boolean,
  disableChronicCaps?: boolean,
): BatchGenerationResult {
  let totalGenerated = 0;
  let totalFailed = 0;

  const updatedPatients = batch.patients.map((patient) => {
    if (!patient.soapText) {
      return {
        ...patient,
        visits: patient.visits.map((v) => ({
          ...v,
          status: "failed" as const,
        })),
      };
    }

    const extracted = extractStateFromTX(patient.soapText);
    const baseContext = buildContextFromExtracted(extracted, {
      insuranceType: patient.insurance,
      age: patient.age,
      gender: patient.gender,
      medicalHistory: [...(patient.visits[0]?.history ?? [])],
    });
    const context = disableChronicCaps
      ? { ...baseContext, disableChronicCaps }
      : baseContext;
    const initialState = buildInitialStateFromExtracted(extracted);

    const txVisits = patient.visits.filter((v) => v.noteType === "TX");
    if (txVisits.length === 0) {
      return patient;
    }

    const options: TXSequenceOptions = {
      txCount: txVisits.length + extracted.estimatedVisitIndex,
      startVisitIndex: extracted.estimatedVisitIndex + 1,
      seed: Math.floor(Math.random() * 100000),
      initialState,
    };

    const results = exportTXSeriesAsText(context, options);
    const generatedTX = txVisits.map((visit, i) => {
      const result = results[i];
      if (!result) {
        totalFailed++;
        return { ...visit, status: "failed" as const };
      }
      totalGenerated++;
      const patchedText = realisticPatch
        ? patchSOAPText(result.text, context, result.state)
        : result.text;
      const soap = splitSOAPText(patchedText);
      return {
        ...visit,
        generated: {
          soap,
          fullText: patchedText,
          seed: options.seed ?? 0,
          state: result.state,
        },
        status: "done" as const,
      };
    });
    const updatedVisits = patient.visits.map(
      (v) => generatedTX.find((g) => g.index === v.index) ?? v,
    );
    return { ...patient, visits: updatedVisits };
  });

  return {
    batchId: batch.batchId,
    totalGenerated,
    totalFailed,
    patients: updatedPatients,
  };
}

/**
 * Mixed mode: generate each patient according to its own mode field
 */
export function generateMixedBatch(
  batch: BatchData,
  realisticPatch?: boolean,
  disableChronicCaps?: boolean,
): BatchGenerationResult {
  let totalGenerated = 0;
  let totalFailed = 0;

  const updatedPatients = batch.patients.map((patient) => {
    const mode = patient.mode ?? batch.mode ?? "full";

    if (mode === "continue") {
      // Reuse continue logic inline
      if (!patient.soapText) {
        return {
          ...patient,
          visits: patient.visits.map((v) => ({
            ...v,
            status: "failed" as const,
          })),
        };
      }
      const extracted = extractStateFromTX(patient.soapText);
      const baseCtx = buildContextFromExtracted(extracted, {
        insuranceType: patient.insurance,
        age: patient.age,
        gender: patient.gender,
        medicalHistory: [...(patient.visits[0]?.history ?? [])],
      });
      const context = disableChronicCaps
        ? { ...baseCtx, disableChronicCaps }
        : baseCtx;
      const initialState = buildInitialStateFromExtracted(extracted);
      const txVisits = patient.visits.filter((v) => v.noteType === "TX");
      if (txVisits.length === 0) return patient;

      const options: TXSequenceOptions = {
        txCount: txVisits.length + extracted.estimatedVisitIndex,
        startVisitIndex: extracted.estimatedVisitIndex + 1,
        seed: patient.seed ?? Math.floor(Math.random() * 100000),
        initialState,
      };
      const results = exportTXSeriesAsText(context, options);
      const generatedTX = txVisits.map((visit, i) => {
        const result = results[i];
        if (!result) {
          totalFailed++;
          return { ...visit, status: "failed" as const };
        }
        totalGenerated++;
        const patchedText = realisticPatch
          ? patchSOAPText(result.text, context, result.state)
          : result.text;
        return {
          ...visit,
          generated: {
            soap: splitSOAPText(patchedText),
            fullText: patchedText,
            seed: options.seed ?? 0,
            state: result.state,
          },
          status: "done" as const,
        };
      });
      const updatedVisits = patient.visits.map(
        (v) => generatedTX.find((g) => g.index === v.index) ?? v,
      );
      return { ...patient, visits: updatedVisits };
    }

    // full / soap-only: use standard generation
    const ieVisit = patient.visits.find((v) => v.noteType === "IE");
    const reVisits = patient.visits.filter((v) => v.noteType === "RE");
    const txVisits = patient.visits.filter((v) => v.noteType === "TX");
    const generatedIE = ieVisit
      ? generateSingleVisit(
          patient,
          ieVisit,
          patient.seed,
          realisticPatch,
          disableChronicCaps,
        )
      : undefined;
    const generatedRE = reVisits.map((v) =>
      generateSingleVisit(
        patient,
        v,
        patient.seed,
        realisticPatch,
        disableChronicCaps,
      ),
    );
    const generatedTX = generateTXSeries(
      patient,
      txVisits,
      generatedIE,
      realisticPatch,
      disableChronicCaps,
    );

    const updatedVisits = patient.visits.map((v) => {
      if (v.noteType === "IE" && generatedIE) return generatedIE;
      const reMatch = generatedRE.find((g) => g.index === v.index);
      if (reMatch) return reMatch;
      return generatedTX.find((g) => g.index === v.index) ?? v;
    });
    for (const v of updatedVisits) {
      if (v.status === "done") totalGenerated++;
      else if (v.status === "failed") totalFailed++;
    }
    return { ...patient, visits: updatedVisits };
  });

  return {
    batchId: batch.batchId,
    totalGenerated,
    totalFailed,
    patients: updatedPatients,
  };
}

/**
 * 重新生成单个 visit 的 SOAP (用于用户调整后重新生成)
 */
export function regenerateVisit(
  patient: BatchPatient,
  visit: BatchVisit,
  seed?: number,
  realisticPatch?: boolean,
  disableChronicCaps?: boolean,
): BatchVisit {
  return generateSingleVisit(
    patient,
    visit,
    seed,
    realisticPatch,
    disableChronicCaps,
  );
}

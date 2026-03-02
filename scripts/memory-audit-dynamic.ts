import { generateTXSequenceStates } from '../src/generator/tx-sequence-engine'
import { exportSOAPAsText } from '../src/generator/soap-generator'
import type { GenerationContext } from '../src/types'

const bodyParts: GenerationContext['primaryBodyPart'][] = [
  'LBP',
  'SHOULDER',
  'NECK',
  'KNEE',
  'ELBOW',
  'MID_LOW_BACK',
  'MIDDLE_BACK',
]

function makeContext(bp: GenerationContext['primaryBodyPart']): GenerationContext {
  const laterality = bp === 'LBP' || bp === 'MID_LOW_BACK' || bp === 'MIDDLE_BACK' ? 'bilateral' : 'left'
  return {
    noteType: 'TX',
    insuranceType: 'NONE',
    primaryBodyPart: bp,
    laterality,
    localPattern: 'Qi & Blood Stagnation',
    systemicPattern: 'Liver Qi Stagnation',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate to severe',
    hasPacemaker: false,
    hasMetalImplant: false,
    painCurrent: 8,
    painTypes: ['Dull','Aching'],
    associatedSymptoms: ['soreness'],
    symptomScale: '70%',
    painFrequency: 'Constant (symptoms occur between 76% and 100% of the time)',
    age: 58,
    gender: 'Female',
    medicalHistory: ['chronic pain']
  }
}

function extractRomDegrees(text: string): number[] {
  const lines = text.split(/\r?\n/)
  const out: number[] = []
  for (const line of lines) {
    // Supports both:
    // - "Flexion: 40 Degrees (moderate)"
    // - "Flexion(fully bent): 120(normal)"
    const m = line.match(/:\s*(-?\d+)\s*(?:Degrees|degree)?\s*\(/i)
    if (m) out.push(Number(m[1]))
  }
  return out
}

function normalizePlan(text: string): string {
  const m = text.match(/\nPlan\n([\s\S]*?)\nSelect Needle Size/s)
  return (m?.[1] ?? '').trim()
}

type Example = Record<string, unknown>
const issues: Record<string, { count: number; examples: Example[] }> = {
  romTrendNoRomChange: { count: 0, examples: [] },
  tightTrendButDisplaySame: { count: 0, examples: [] },
  tenderTrendButDisplaySame: { count: 0, examples: [] },
  spasmTrendButDisplaySame: { count: 0, examples: [] },
  painFallbackWithoutPainDrop: { count: 0, examples: [] },
  energySleepReasonWithoutSubjectiveDims: { count: 0, examples: [] },
  mixedDirectionEmptyFindingType: { count: 0, examples: [] },
  txPlanInvariantAcrossVisits: { count: 0, examples: [] },
}

for (const bp of bodyParts) {
  for (let seed = 1; seed <= 120; seed++) {
    const context = makeContext(bp)
    const result = generateTXSequenceStates(context, {
      txCount: 20,
      seed,
      initialState: {
        pain: 8,
        tightness: 4,
        tenderness: 3,
        spasm: 3,
        frequency: 3,
        associatedSymptom: 'soreness',
        symptomScale: '70%',
        painTypes: ['Dull', 'Aching'],
        inspection: 'weak muscles and dry skin without luster',
      },
    })

    const texts = result.states.map((s) => exportSOAPAsText(context, s))
    const plans = texts.map(normalizePlan)
    if (new Set(plans).size === 1 && plans[0].length > 0) {
      issues.txPlanInvariantAcrossVisits.count++
      if (issues.txPlanInvariantAcrossVisits.examples.length < 8) {
        issues.txPlanInvariantAcrossVisits.examples.push({ bp, seed, plan: plans[0] })
      }
    }

    for (let i = 1; i < result.states.length; i++) {
      const prev = result.states[i - 1]
      const cur = result.states[i]

      const prevRom = extractRomDegrees(texts[i - 1])
      const curRom = extractRomDegrees(texts[i])
      const comparableRom =
        prevRom.length > 0 &&
        curRom.length > 0 &&
        prevRom.length === curRom.length
      const romChanged =
        comparableRom && prevRom.some((v, idx) => v !== curRom[idx])

      if (cur.soaChain.objective.romTrend !== 'stable' && comparableRom && !romChanged) {
        issues.romTrendNoRomChange.count++
        if (issues.romTrendNoRomChange.examples.length < 12) {
          issues.romTrendNoRomChange.examples.push({
            bp, seed, visit: cur.visitIndex,
            romTrend: cur.soaChain.objective.romTrend,
            prevRom, curRom,
            painLabelPrev: prev.painScaleLabel,
            painLabelCur: cur.painScaleLabel,
          })
        }
      }

      if (cur.soaChain.objective.tightnessTrend !== 'stable' && cur.tightnessGrading === prev.tightnessGrading) {
        issues.tightTrendButDisplaySame.count++
        if (issues.tightTrendButDisplaySame.examples.length < 12) {
          issues.tightTrendButDisplaySame.examples.push({ bp, seed, visit: cur.visitIndex, trend: cur.soaChain.objective.tightnessTrend, grading: cur.tightnessGrading })
        }
      }
      if (cur.soaChain.objective.tendernessTrend !== 'stable' && cur.tendernessGrading === prev.tendernessGrading) {
        issues.tenderTrendButDisplaySame.count++
        if (issues.tenderTrendButDisplaySame.examples.length < 12) {
          issues.tenderTrendButDisplaySame.examples.push({ bp, seed, visit: cur.visitIndex, trend: cur.soaChain.objective.tendernessTrend, grading: cur.tendernessGrading })
        }
      }
      if (cur.soaChain.objective.spasmTrend !== 'stable' && cur.spasmGrading === prev.spasmGrading) {
        issues.spasmTrendButDisplaySame.count++
        if (issues.spasmTrendButDisplaySame.examples.length < 12) {
          issues.spasmTrendButDisplaySame.examples.push({ bp, seed, visit: cur.visitIndex, trend: cur.soaChain.objective.spasmTrend, grading: cur.spasmGrading })
        }
      }

      if (cur.soaChain.assessment.whatChanged === 'pain' && cur.painScaleCurrent === prev.painScaleCurrent) {
        issues.painFallbackWithoutPainDrop.count++
        if (issues.painFallbackWithoutPainDrop.examples.length < 12) {
          issues.painFallbackWithoutPainDrop.examples.push({ bp, seed, visit: cur.visitIndex, prevPain: prev.painScaleCurrent, curPain: cur.painScaleCurrent, dim: cur.soaChain.assessment.whatChanged })
        }
      }

      const reason = cur.reason.toLowerCase()
      const energySleep = reason.includes('energy') || reason.includes('sleep')
      const sPainImproved = cur.soaChain.subjective.painChange === 'improved'
      const sAdlImproved = cur.soaChain.subjective.adlChange === 'improved'
      const sFreqImproved = cur.soaChain.subjective.frequencyChange === 'improved'
      if (energySleep && !(sPainImproved || sAdlImproved || sFreqImproved)) {
        issues.energySleepReasonWithoutSubjectiveDims.count++
        if (issues.energySleepReasonWithoutSubjectiveDims.examples.length < 12) {
          issues.energySleepReasonWithoutSubjectiveDims.examples.push({ bp, seed, visit: cur.visitIndex, reason: cur.reason, painChange: cur.soaChain.subjective.painChange, adlChange: cur.soaChain.subjective.adlChange, frequencyChange: cur.soaChain.subjective.frequencyChange })
        }
      }

      const hasReduce = cur.soaChain.objective.romTrend !== 'stable' || cur.soaChain.objective.tightnessTrend !== 'stable' || cur.soaChain.objective.tendernessTrend !== 'stable' || cur.soaChain.objective.spasmTrend !== 'stable'
      const hasIncrease = cur.soaChain.objective.strengthTrend !== 'stable'
      if (hasReduce && hasIncrease && cur.soaChain.assessment.findingType === '') {
        issues.mixedDirectionEmptyFindingType.count++
        if (issues.mixedDirectionEmptyFindingType.examples.length < 12) {
          issues.mixedDirectionEmptyFindingType.examples.push({ bp, seed, visit: cur.visitIndex, physicalChange: cur.soaChain.assessment.physicalChange, findingType: cur.soaChain.assessment.findingType })
        }
      }
    }
  }
}

console.log(JSON.stringify(issues, null, 2))

import type {
  GenerationContext,
  SOAPNote,
  BodyPart,
  Laterality,
  SeverityLevel,
  InsuranceType
} from '../../../src/types'
import type { OptumNoteDocument, VisitRecord } from '../types'

const BODY_PART_MAP: Array<{ pattern: RegExp; bodyPart: BodyPart; laterality?: Laterality }> = [
  { pattern: /\bright\s+knee\b/i, bodyPart: 'KNEE', laterality: 'right' },
  { pattern: /\bleft\s+knee\b/i, bodyPart: 'KNEE', laterality: 'left' },
  { pattern: /\bbilateral\s+knee\b/i, bodyPart: 'KNEE', laterality: 'bilateral' },
  { pattern: /\bright\s+shoulder\b/i, bodyPart: 'SHOULDER', laterality: 'right' },
  { pattern: /\bleft\s+shoulder\b/i, bodyPart: 'SHOULDER', laterality: 'left' },
  { pattern: /\bbilateral\s+shoulder\b/i, bodyPart: 'SHOULDER', laterality: 'bilateral' },
  { pattern: /\bcervical\b|\bneck\b/i, bodyPart: 'NECK' },
  { pattern: /\blower back\b|\blbp\b|\blumbar\b/i, bodyPart: 'LBP' },
  { pattern: /\bmid\s*back\b|\bmiddle\s*back\b|\bthoracic\b/i, bodyPart: 'MIDDLE_BACK' },
  { pattern: /\bhip\b/i, bodyPart: 'HIP' },
  { pattern: /\belbow\b/i, bodyPart: 'ELBOW' }
]

export function parseBodyPartString(raw: string): { bodyPart: BodyPart; laterality: Laterality } {
  for (const c of BODY_PART_MAP) {
    if (c.pattern.test(raw)) {
      return { bodyPart: c.bodyPart, laterality: c.laterality || inferLaterality(raw) }
    }
  }
  return { bodyPart: 'SHOULDER', laterality: inferLaterality(raw) }
}

function inferLaterality(raw: string): Laterality {
  if (/\bbilateral\b/i.test(raw)) return 'bilateral'
  if (/\bleft\b/i.test(raw)) return 'left'
  if (/\bright\b/i.test(raw)) return 'right'
  return 'unspecified'
}

export function extractLocalPattern(currentPattern: string): string {
  if (!currentPattern) return 'Qi Stagnation'
  return currentPattern
    .replace(/\sin\s+local\s+meridian.*$/i, '')
    .replace(/\s+that\s+cause.*$/i, '')
    .trim()
}

function inferSystemicPattern(doc: OptumNoteDocument, fallback = 'Blood Deficiency'): string {
  const ie = doc.visits.find(v => v.subjective.visitType === 'INITIAL EVALUATION')
  const fromIE = ie?.assessment?.tcmDiagnosis?.pattern?.trim()
  return fromIE || fallback
}

function parseSeverityFromAdlText(adlText: string): SeverityLevel {
  const t = (adlText || '').toLowerCase()
  if (t.includes('moderate to severe')) return 'moderate to severe'
  if (t.includes('mild to moderate')) return 'mild to moderate'
  if (t.includes('severe')) return 'severe'
  if (t.includes('moderate')) return 'moderate'
  return 'mild'
}

function parseSeverityFromVisit(visit: VisitRecord): SeverityLevel {
  const level = visit.subjective.adlDifficultyLevel
  if (level) return level
  return parseSeverityFromAdlText(visit.subjective.adlImpairment)
}

function parsePainCurrent(visit: VisitRecord): number {
  const ps = visit.subjective.painScale as any
  if (typeof ps?.current === 'number') return ps.current
  if (typeof ps?.value === 'number') return ps.value
  if (typeof ps?.range?.max === 'number') return ps.range.max
  return 7
}

function inferInsurance(visit: VisitRecord): InsuranceType {
  const has97810 = visit.procedureCodes.some(x => x.cpt === '97810')
  return has97810 ? 'OPTUM' : 'WC'
}

export function bridgeVisitToSOAPNote(visit: VisitRecord): SOAPNote {
  const { bodyPart, laterality } = parseBodyPartString(visit.subjective.bodyPart || visit.subjective.chiefComplaint)
  const current = parsePainCurrent(visit)
  const best = (visit.subjective.painScale as any)?.best
  const bestNum = typeof best === 'number' ? best : (best?.min || current - 2)
  const localPattern = extractLocalPattern(visit.assessment.currentPattern || '')
  const systemicPattern = visit.assessment.tcmDiagnosis?.pattern || 'Blood Deficiency'

  return {
    header: {
      patientId: '',
      visitDate: visit.assessment.date || '',
      noteType: visit.subjective.visitType === 'INITIAL EVALUATION' ? 'IE' : 'TX',
      insuranceType: inferInsurance(visit)
    },
    subjective: {
      visitType: visit.subjective.visitType,
      chronicityLevel: visit.subjective.chronicityLevel || (/\bchronic\b/i.test(visit.subjective.chiefComplaint) ? 'Chronic' : /\bsub\s*acute\b/i.test(visit.subjective.chiefComplaint) ? 'Sub Acute' : 'Acute'),
      primaryBodyPart: { bodyPart, laterality },
      secondaryBodyParts: [],
      painTypes: visit.subjective.painTypes as any,
      painRadiation: visit.subjective.radiation ? 'with radiation' : 'without radiation',
      symptomDuration: { value: 1, unit: 'month(s)' },
      associatedSymptoms: [],
      symptomPercentage: visit.subjective.muscleWeaknessScale || '70%',
      causativeFactors: [],
      exacerbatingFactors: [],
      relievingFactors: [],
      adlDifficulty: {
        level: parseSeverityFromVisit(visit),
        activities: visit.subjective.adlImpairment ? [visit.subjective.adlImpairment] : []
      },
      activityChanges: [],
      painScale: {
        worst: typeof (visit.subjective.painScale as any).worst === 'number' ? (visit.subjective.painScale as any).worst : Math.max(current, 8),
        best: bestNum,
        current
      },
      painFrequency: visit.subjective.painFrequency,
      walkingAid: visit.subjective.walkingAid,
      medicalHistory: visit.subjective.medicalHistory
    },
    objective: {
      muscleTesting: {
        tightness: {
          muscles: visit.objective.tightnessMuscles.muscles,
          gradingScale: visit.objective.tightnessMuscles.gradingScale
        },
        tenderness: {
          muscles: visit.objective.tendernessMuscles.muscles,
          gradingScale: visit.objective.tendernessMuscles.scaleDescription
        },
        spasm: {
          muscles: visit.objective.spasmMuscles.muscles,
          gradingScale: visit.objective.spasmMuscles.scaleDescription
        }
      },
      rom: visit.objective.rom.items.map(item => ({
        movement: item.movement,
        strength: item.strength,
        degrees: `${item.degrees} degree(${item.severity})`
      })),
      inspection: [visit.objective.inspection],
      tonguePulse: {
        tongue: visit.objective.tonguePulse.tongue,
        pulse: visit.objective.tonguePulse.pulse
      }
    },
    assessment: {
      tcmDiagnosis: {
        localPattern,
        systemicPattern,
        bodyPart: visit.subjective.bodyPart
      },
      treatmentPrinciples: {
        focusOn: 'focus',
        harmonize: 'yin/yang',
        purpose: visit.assessment.tcmDiagnosis?.treatmentPrinciples || 'promote good essence'
      },
      evaluationArea: visit.subjective.bodyPart,
      patientCondition: visit.assessment.generalCondition,
      changeFromLastVisit: visit.assessment.symptomChange
    },
    plan: {
      evaluationType: visit.subjective.visitType === 'INITIAL EVALUATION' ? 'Initial Evaluation' : 'Re-Evaluation',
      contactTime: `${visit.plan.treatmentTime}`,
      steps: [],
      shortTermGoal: {
        treatmentFrequency: 12,
        weeksDuration: '5-6 weeks',
        painScaleTarget: visit.plan.shortTermGoal?.painScaleTarget || '5-6',
        symptomTargets: []
      },
      longTermGoal: {
        treatmentFrequency: 8,
        weeksDuration: '5-6 weeks',
        painScaleTarget: visit.plan.longTermGoal?.painScaleTarget || '3',
        symptomTargets: []
      },
      needleProtocol: {
        needleSizes: visit.plan.needleSpecs.map(n => `${n.gauge}x${n.length}`),
        totalTime: visit.plan.treatmentTime,
        sections: []
      }
    },
    diagnosisCodes: visit.diagnosisCodes.map(d => ({ icd10: d.icd10, description: d.description, bodyPart, laterality })),
    procedureCodes: visit.procedureCodes.map(p => ({
      cpt: p.cpt,
      description: p.description,
      units: 1,
      electricalStimulation: false
    }))
  }
}

export function bridgeToContext(doc: OptumNoteDocument, visitIndex: number): GenerationContext {
  const visit = doc.visits[visitIndex]
  if (!visit) throw new Error(`visitIndex out of range: ${visitIndex}`)

  const parsedFromRaw = parseBodyPartString(visit.subjective.bodyPart || visit.subjective.chiefComplaint)
  const normalized = visit.subjective.bodyPartNormalized
  const bodyPart = (normalized && normalized !== 'UNKNOWN' ? normalized as BodyPart : parsedFromRaw.bodyPart)
  const laterality = visit.subjective.laterality || parsedFromRaw.laterality
  const localPattern = extractLocalPattern(visit.assessment.currentPattern || visit.assessment.tcmDiagnosis?.pattern || visit.assessment.tcmDiagnosis?.diagnosis || 'Qi Stagnation')
  const systemicPattern = visit.assessment.systemicPattern || visit.assessment.tcmDiagnosis?.pattern || inferSystemicPattern(doc)

  const context: GenerationContext = {
    noteType: visit.subjective.visitType === 'INITIAL EVALUATION' ? 'IE' : 'TX',
    insuranceType: inferInsurance(visit),
    primaryBodyPart: bodyPart,
    laterality,
    severityLevel: parseSeverityFromVisit(visit),
    chronicityLevel: visit.subjective.chronicityLevel || (/\bchronic\b/i.test(visit.subjective.chiefComplaint) ? 'Chronic' : /\bsub\s*acute\b/i.test(visit.subjective.chiefComplaint) ? 'Sub Acute' : 'Acute'),
    localPattern,
    systemicPattern,
    hasPacemaker: !!visit.subjective.medicalHistory?.some(x => /pacemaker/i.test(x))
  }

  if (context.noteType === 'TX') {
    const ieVisit = doc.visits.find(v => v.subjective.visitType === 'INITIAL EVALUATION')
    if (ieVisit) {
      context.previousIE = bridgeVisitToSOAPNote(ieVisit)
    }
  }

  return context
}

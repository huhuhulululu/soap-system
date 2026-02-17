/**
 * TX 文本提取器
 * 从 TX 文本中提取状态和推断上下文
 */

import type { BodyPart, Laterality } from '../types'

export interface ExtractedTXState {
  bodyPart: BodyPart
  laterality: Laterality
  localPattern: string
  painScale: number
  painFrequency: number
  symptomScale: string
  tightness: number
  tenderness: number
  spasm: number
  associatedSymptom: string
  estimatedProgress: number
  estimatedVisitIndex: number
}

const BODY_PART_MAP: Record<string, BodyPart> = {
  'lower back': 'LBP', 'lumbar': 'LBP', 'lumbosacral': 'LBP',
  'neck': 'NECK', 'cervical': 'NECK',
  'shoulder': 'SHOULDER',
  'knee': 'KNEE',
  'elbow': 'ELBOW',
  'hip': 'HIP',
  'upper back': 'UPPER_BACK',
  'middle back': 'MIDDLE_BACK', 'mid back': 'MIDDLE_BACK',
  'ankle': 'ANKLE', 'foot': 'FOOT',
  'wrist': 'WRIST', 'hand': 'HAND'
}

const PATTERN_MAP: Record<string, string> = {
  'qi stagnation': 'Qi Stagnation',
  'blood stasis': 'Blood Stasis',
  'phlegm-damp': 'Phlegm-Damp',
  'phlegm damp': 'Phlegm-Damp',
  'damp-heat': 'Damp-Heat',
  'wind-cold': 'Wind-Cold Invasion',
  'blood deficiency': 'Blood Deficiency',
  'qi & blood deficiency': 'Qi & Blood Deficiency'
}

const TIGHTNESS_MAP: Record<string, number> = {
  'severe': 4, 'moderate to severe': 3.5, 'moderate': 3, 'mild to moderate': 2, 'mild': 1
}

const FREQUENCY_MAP: Record<string, number> = {
  'constant': 3, 'frequent': 2, 'occasional': 1, 'intermittent': 0
}

export function extractStateFromTX(text: string): ExtractedTXState {
  const lower = text.toLowerCase()
  
  // Body part
  let bodyPart: BodyPart = 'LBP'
  for (const [key, val] of Object.entries(BODY_PART_MAP)) {
    if (lower.includes(key)) { bodyPart = val; break }
  }
  
  // Laterality
  let laterality: Laterality = 'bilateral'
  if (/\bleft\b/.test(lower) && !/\bright\b/.test(lower)) laterality = 'left'
  else if (/\bright\b/.test(lower) && !/\bleft\b/.test(lower)) laterality = 'right'
  
  // Local pattern
  let localPattern = 'Qi Stagnation'
  const patternMatch = text.match(/(?:has|still has)\s+([\w\s&-]+)\s+in local/i)
  if (patternMatch) {
    const p = patternMatch[1].toLowerCase().trim()
    localPattern = PATTERN_MAP[p] || 'Qi Stagnation'
  }
  
  // Pain scale
  const painMatch = text.match(/Pain Scale[:\s]*(\d+)/i)
  const painScale = painMatch ? parseInt(painMatch[1]) : 7
  
  // Pain frequency
  let painFrequency = 2
  const freqMatch = text.match(/Pain frequency[:\s]*(\w+)/i)
  if (freqMatch) {
    painFrequency = FREQUENCY_MAP[freqMatch[1].toLowerCase()] ?? 2
  }
  
  // Symptom scale
  const scaleMatch = text.match(/scale as\s*(\d+%)/i)
  const symptomScale = scaleMatch ? scaleMatch[1] : '70%'
  
  // Tightness
  let tightness = 3
  const tightMatch = text.match(/Grading Scale[:\s]*([\w\s]+)\n/i)
  if (tightMatch) {
    tightness = TIGHTNESS_MAP[tightMatch[1].toLowerCase().trim()] ?? 3
  }
  
  // Tenderness
  const tenderMatch = text.match(/\(\+(\d)\)/)
  const tenderness = tenderMatch ? parseInt(tenderMatch[1]) : 3
  
  // Spasm
  const spasmMatch = text.match(/Frequency Grading Scale[:\s]*\(\+(\d)\)/i)
  const spasm = spasmMatch ? parseInt(spasmMatch[1]) : 2
  
  // Associated symptom
  const assocMatch = text.match(/associated with muscles\s+(\w+)/i)
  const associatedSymptom = assocMatch ? assocMatch[1].toLowerCase() : 'soreness'
  
  // Estimate progress based on indicators
  const painProgress = (8 - painScale) / 5  // 8→3 = 0→1
  const tightProgress = (4 - tightness) / 3  // 4→1 = 0→1
  const tenderProgress = (4 - tenderness) / 3
  const freqProgress = (3 - painFrequency) / 3
  const estimatedProgress = Math.min(0.95, Math.max(0.1, 
    (painProgress + tightProgress + tenderProgress + freqProgress) / 4
  ))
  
  // Estimate visit index (assuming 11 TX total)
  const estimatedVisitIndex = Math.max(1, Math.round(estimatedProgress * 10))
  
  return {
    bodyPart, laterality, localPattern,
    painScale, painFrequency, symptomScale,
    tightness, tenderness, spasm, associatedSymptom,
    estimatedProgress, estimatedVisitIndex
  }
}

export function buildContextFromExtracted(extracted: ExtractedTXState) {
  return {
    noteType: 'TX' as const,
    insuranceType: 'OPTUM' as const,
    primaryBodyPart: extracted.bodyPart,
    laterality: extracted.laterality,
    localPattern: extracted.localPattern,
    systemicPattern: 'Kidney Yang Deficiency',
    chronicityLevel: 'Chronic' as const,
    severityLevel: 'moderate' as const
  }
}

export function buildInitialStateFromExtracted(extracted: ExtractedTXState) {
  return {
    pain: extracted.painScale,
    tightness: extracted.tightness,
    tenderness: extracted.tenderness,
    spasm: extracted.spasm,
    frequency: extracted.painFrequency,
    symptomScale: extracted.symptomScale,
    associatedSymptom: extracted.associatedSymptom
  }
}

// ICD/CPT 推断
const ICD_MAP: Record<BodyPart, { code: string, desc: string, hasLaterality: boolean }> = {
  LBP: { code: 'M54.5', desc: 'Low back pain', hasLaterality: false },
  NECK: { code: 'M54.2', desc: 'Cervicalgia', hasLaterality: false },
  UPPER_BACK: { code: 'M54.6', desc: 'Pain in thoracic spine', hasLaterality: false },
  MIDDLE_BACK: { code: 'M54.6', desc: 'Pain in thoracic spine', hasLaterality: false },
  MID_LOW_BACK: { code: 'M54.5', desc: 'Pain in thoracolumbar spine', hasLaterality: false },
  SHOULDER: { code: 'M25.51', desc: 'Pain in shoulder', hasLaterality: true },
  ELBOW: { code: 'M25.52', desc: 'Pain in elbow', hasLaterality: true },
  WRIST: { code: 'M25.53', desc: 'Pain in wrist', hasLaterality: true },
  HAND: { code: 'M79.64', desc: 'Pain in hand and fingers', hasLaterality: true },
  HIP: { code: 'M25.55', desc: 'Pain in hip', hasLaterality: true },
  KNEE: { code: 'M25.56', desc: 'Pain in knee', hasLaterality: true },
  ANKLE: { code: 'M25.57', desc: 'Pain in ankle and joints of foot', hasLaterality: true },
  FOOT: { code: 'M79.67', desc: 'Pain in foot and toes', hasLaterality: true },
  THIGH: { code: 'M79.65', desc: 'Pain in thigh', hasLaterality: true },
  CALF: { code: 'M79.66', desc: 'Pain in lower leg', hasLaterality: true },
  ARM: { code: 'M79.62', desc: 'Pain in upper arm', hasLaterality: true },
  FOREARM: { code: 'M79.63', desc: 'Pain in forearm', hasLaterality: true }
}

const LATERALITY_SUFFIX: Record<Laterality, string> = {
  right: '1', left: '2', bilateral: '9'
}

export function inferDiagnosisCodes(bodyPart: BodyPart, laterality: Laterality) {
  const icd = ICD_MAP[bodyPart] || ICD_MAP.LBP
  const code = icd.hasLaterality ? `${icd.code}${LATERALITY_SUFFIX[laterality]}` : icd.code
  const desc = icd.hasLaterality && laterality !== 'bilateral' 
    ? `${icd.desc}, ${laterality}` 
    : icd.desc
  return [{ icd10: code, description: desc, bodyPart, laterality }]
}

export function inferProcedureCodes(insuranceType: string, treatmentTime: number, hasElectricalStim = false) {
  // HF/OPTUM: 简化协议，15min，无电刺激
  if (insuranceType === 'HF' || insuranceType === 'OPTUM') {
    return [{ cpt: '97810', description: 'Acupuncture w/o estim, initial 15 min', units: 1, electricalStimulation: false }]
  }
  
  // WC full code: 97813×1 + 97814×2 + 97811×1
  if (insuranceType === 'WC') {
    return [
      { cpt: '97813', description: 'Acupuncture w/ estim, initial 15 min', units: 1, electricalStimulation: true },
      { cpt: '97814', description: 'Acupuncture w/ estim, each addl 15 min', units: 2, electricalStimulation: true },
      { cpt: '97811', description: 'Acupuncture w/o estim, each addl 15 min', units: 1, electricalStimulation: false }
    ]
  }
  
  // VC full code: 97813×1 + 97814×1 + 97811×2
  if (insuranceType === 'VC') {
    return [
      { cpt: '97813', description: 'Acupuncture w/ estim, initial 15 min', units: 1, electricalStimulation: true },
      { cpt: '97814', description: 'Acupuncture w/ estim, each addl 15 min', units: 1, electricalStimulation: true },
      { cpt: '97811', description: 'Acupuncture w/o estim, each addl 15 min', units: 2, electricalStimulation: false }
    ]
  }
  
  // 其他: 默认 97810
  return [{ cpt: '97810', description: 'Acupuncture w/o estim, initial 15 min', units: 1, electricalStimulation: false }]
}

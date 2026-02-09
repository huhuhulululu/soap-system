/**
 * Assessment Section Generator
 * Generates HTML for IE (Initial Evaluation) and TX (Treatment) Assessment sections
 * Matches exact template format with all dropdown options preserved
 */

import type { GenerationContext } from '../types'
import {
  selectLocalPattern,
  selectSystemicPattern,
  selectTreatmentPrinciples,
  selectGeneralCondition,
  GeneratorContext
} from './weight-integration'

// ============================================================================
// DROPDOWN OPTIONS - Complete lists from templates
// ============================================================================

/**
 * Body part options for Assessment
 */
const BODY_PART_OPTIONS = [
  'Lower back',
  'Middle back'
] as const

/**
 * Local pattern (证型) options - used in TCM diagnosis
 */
const LOCAL_PATTERN_OPTIONS = [
  'Qi Stagnation',
  'Blood Stasis',
  'Liver Qi Stagnation',
  'Blood Deficiency',
  'Qi & Blood Deficiency',
  'Wind-Cold Invasion',
  'Cold-Damp + Wind-Cold',
  'LV/GB Damp-Heat',
  'Phlegm-Damp',
  'Phlegm-Heat',
  'Damp-Heat'
] as const

/**
 * Systemic pattern options - for general body condition
 */
const SYSTEMIC_PATTERN_OPTIONS = [
  'Kidney Yang Deficiency',
  'Kidney Yin Deficiency',
  'Kidney Qi Deficiency',
  'LU & KI Deficiency',
  'Kidney Essence Deficiency',
  'Yin Deficiency Fire',
  'Qi Deficiency',
  'Blood Deficiency',
  'Qi & Blood Deficiency',
  'Phlegm-Damp',
  'Phlegm-Heat',
  'Liver Yang Rising',
  'LV/GB Fire',
  'LV/GB Damp-Heat',
  'Spleen Deficiency',
  'Damp-Heat',
  'ST & Intestine Damp-Heat',
  'Stomach Heat',
  'Food Retention',
  'Wei Qi Deficiency',
  'Ying & Wei Disharmony',
  'LU Wind-Heat',
  'Excessive Heat Flaring'
] as const

/**
 * Treatment principle focus options
 */
const TREATMENT_FOCUS_OPTIONS = [
  'continue to be emphasize',
  'consist of promoting',
  'promote',
  'pay attention',
  'focus',
  'emphasize'
] as const

/**
 * Treatment method options
 */
const TREATMENT_METHOD_OPTIONS = [
  'moving qi',
  'regulates qi',
  'activating Blood circulation to dissipate blood stagnant',
  'dredging channel and activating collaterals',
  'activate blood and relax tendons',
  'eliminates accumulation',
  'resolve stagnation, clears heat',
  'promote circulation, relieves pain',
  'expelling pathogens',
  'dispelling cold, drain the dampness',
  'strengthening muscles and bone',
  'clear heat, dispelling the flame',
  'clear damp-heat',
  'drain the dampness, clear damp'
] as const

/**
 * Harmonize target options
 */
const HARMONIZE_OPTIONS = [
  'yin/yang',
  '5 elements',
  'healthy qi and to expel pathogen factor to promote',
  'internal and external',
  'Liver and Kidney'
] as const

/**
 * Treatment purpose options
 */
const PURPOSE_OPTIONS = [
  'enhance good health',
  'promote good body mind health',
  'promote healthy joint and lessen dysfunction in all aspects',
  'to reduce stagnation and improve circulation',
  'promote good essence',
  'promote zheng qi',
  'promote qi'
] as const

/**
 * Laterality options for evaluation area
 */
const LATERALITY_OPTIONS = [
  'along right',
  'along left',
  'along bilateral',
  'on left',
  'on right',
  'on bilateral'
] as const

/**
 * Body part area options
 */
const BODY_AREA_OPTIONS = [
  'midback',
  'mid and lower back',
  'lower back',
  'lower back and buttocks'
] as const

// ============================================================================
// TX-SPECIFIC OPTIONS
// ============================================================================

/**
 * General condition options (TX only)
 */
const GENERAL_CONDITION_OPTIONS = [
  'good',
  'fair',
  'poor'
] as const

/**
 * Symptom change options (TX only)
 */
const SYMPTOM_CHANGE_OPTIONS = [
  'slight improvement of symptom(s).',
  'improvement of symptom(s).',
  'exacerbate of symptom(s).',
  'no change.'
] as const

/**
 * Change level options (TX only)
 */
const CHANGE_LEVEL_OPTIONS = [
  'reduced',
  'slightly reduced',
  'increased',
  'slight increased',
  'remained the same'
] as const

/**
 * Symptom type options for TX assessment
 */
const SYMPTOM_TYPE_OPTIONS = [
  'pain',
  'pain frequency',
  'pain duration',
  'numbness sensation',
  'muscles weakness',
  'muscles soreness sensation',
  'muscles stiffness sensation',
  'heaviness sensation',
  'difficulty in performing ADLs',
  'as last time visit'
] as const

/**
 * Physical finding options (TX only)
 */
const PHYSICAL_FINDING_OPTIONS = [
  'local muscles tightness',
  'local muscles tenderness',
  'local muscles spasms',
  'local muscles trigger points',
  'joint ROM',
  'joint ROM limitation',
  'muscles strength',
  'joints swelling',
  'last visit'
] as const

/**
 * Session type options (TX only)
 */
const SESSION_TYPE_OPTIONS = [
  'session',
  'treatment',
  'acupuncture session',
  'acupuncture treatment'
] as const

/**
 * Treatment response options (TX only)
 */
const TREATMENT_RESPONSE_OPTIONS = [
  'well',
  'with good positioning technique',
  'with good draping technique',
  'with positive verbal response',
  'with good response',
  'with positive response',
  'with good outcome in reducing spasm',
  'with excellent outcome due reducing pain',
  'with good outcome in improving ROM',
  'good outcome in improving ease with functional mobility',
  'with increase ease with functional mobility',
  'with increase ease with function'
] as const

// ============================================================================
// HTML GENERATION HELPERS
// ============================================================================

/**
 * Creates a single-select dropdown span (ppnSelectComboSingle)
 */
function createSingleSelect(options: readonly string[], selectedValue: string): string {
  const optionsStr = options.join('|')
  return `<span class="ppnSelectComboSingle ${optionsStr}">${selectedValue}</span>`
}

/**
 * Creates a multi-select dropdown span (ppnSelectCombo)
 */
function createMultiSelect(options: readonly string[], selectedValue: string): string {
  const optionsStr = options.join('|')
  return `<span class="ppnSelectCombo ${optionsStr}">${selectedValue}</span>`
}

/**
 * Common inline style for text elements
 */
const INLINE_STYLE = 'font-variant-ligatures: normal; orphans: 2; widows: 2; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial;'

/**
 * Wraps text with standard span styling
 */
function styledSpan(content: string): string {
  return `<span style="${INLINE_STYLE}">${content}</span>`
}

/**
 * Creates a line break with standard styling
 */
function styledBr(): string {
  return `<br style="${INLINE_STYLE}">`
}

// ============================================================================
// MAIN GENERATOR FUNCTIONS
// ============================================================================

/**
 * Generates Assessment HTML based on template type
 */
export function generateAssessmentHTML(context: GenerationContext, template: 'IE' | 'TX'): string {
  if (template === 'IE') {
    return generateAssessmentIE(context)
  }
  return generateAssessmentTX(context)
}

/**
 * Generates IE Assessment - Complete TCM Diagnosis
 *
 * Structure:
 * 1. TCM Dx header
 * 2. Body part + local pattern + systemic pattern
 * 3. Treatment principles
 * 4. Acupuncture evaluation area
 */
function generateAssessmentIE(context: GenerationContext): string {
  const bodyPart = getBodyPartDisplay(context.primaryBodyPart)

  // Convert to GeneratorContext for weight selection
  const weightContext = toGeneratorContext(context)

  // Use weight-based selection for patterns
  const localPattern = selectLocalPattern([...LOCAL_PATTERN_OPTIONS], weightContext)
  const systemicPattern = selectSystemicPattern([...SYSTEMIC_PATTERN_OPTIONS], weightContext)

  // Use weight-based selection for treatment principles
  const treatmentPrinciples = selectTreatmentPrinciples([...TREATMENT_METHOD_OPTIONS], weightContext, 1)
  const treatmentMethod = treatmentPrinciples[0] || getTreatmentMethodFromPattern(localPattern)

  // Select treatment focus based on pattern
  const treatmentFocus = selectTreatmentFocusFromPattern(localPattern)
  const harmonize = 'yin/yang'
  const purpose = 'promote good essence'
  const laterality = getLateralityDisplay(context.laterality)
  const bodyArea = getBodyAreaDisplay(context.primaryBodyPart)

  const html = `<body id="tinymce" class="mceContentBody " onload="window.parent.tinyMCE.get('Assessment').onLoad.dispatch();" contenteditable="true" dir="ltr">` +
    `<strong style="${INLINE_STYLE}">TCM Dx:<br></strong>` +
    `${createMultiSelect(BODY_PART_OPTIONS, bodyPart)}` +
    styledSpan(' pain due to ') +
    `${createMultiSelect(LOCAL_PATTERN_OPTIONS, localPattern)}` +
    styledSpan(' in local meridian, but patient also has ') +
    `${createMultiSelect(SYSTEMIC_PATTERN_OPTIONS, systemicPattern)}` +
    styledSpan(' in the general.') +
    styledBr() +
    styledSpan("Today's TCM treatment principles:") +
    styledBr() +
    `${createMultiSelect(TREATMENT_FOCUS_OPTIONS, treatmentFocus)}` +
    styledSpan(' on ') +
    `${createMultiSelect(TREATMENT_METHOD_OPTIONS, treatmentMethod)}` +
    styledSpan(' and harmonize ') +
    `${createMultiSelect(HARMONIZE_OPTIONS, harmonize)}` +
    styledSpan(' balance in order to ') +
    `${createMultiSelect(PURPOSE_OPTIONS, purpose)}` +
    styledSpan('.') +
    styledBr() +
    styledSpan(`Acupuncture Eval was done today ${createSingleSelect(LATERALITY_OPTIONS, laterality)} ${createMultiSelect(BODY_AREA_OPTIONS, bodyArea)}.`) +
    `${createMultiSelect(['on', 'on right', 'on left', 'on B/L', 'on upper', 'on lower', 'on upper & lower', 'for', 'for left', 'for right'], '')}` +
    styledBr() +
    `</body>`

  return html
}

/**
 * Generates TX Assessment - Simplified Progress Comparison
 *
 * Structure:
 * 1. Continue treatment statement
 * 2. General condition + comparison with last treatment
 * 3. Symptom changes + physical finding changes
 * 4. Treatment tolerance statement
 * 5. Current TCM pattern
 */
function generateAssessmentTX(context: GenerationContext): string {
  const bodyArea = getBodyAreaDisplay(context.primaryBodyPart)

  // Convert to GeneratorContext for weight selection
  const weightContext = toGeneratorContext(context)

  // Use weight-based selection for general condition
  const generalCondition = selectGeneralCondition([...GENERAL_CONDITION_OPTIONS], weightContext)

  // Select symptom change based on changeFromLastVisit
  const symptomChange = selectSymptomChangeFromVisit(weightContext.changeFromLastVisit)

  // Select change level based on symptom change
  const changeLevel1 = selectChangeLevelFromSymptomChange(weightContext.changeFromLastVisit)
  const symptomType = 'pain duration'
  const changeLevel2 = 'remained the same'
  const physicalFinding = 'last visit'
  const sessionType = 'acupuncture treatment'
  const treatmentResponse = 'with positive verbal response'

  // Use weight-based selection for local pattern
  const localPattern = selectLocalPattern([...LOCAL_PATTERN_OPTIONS], weightContext)

  const html = `<body id="tinymce" class="mceContentBody " onload="window.parent.tinyMCE.get('Assessment').onLoad.dispatch();" contenteditable="true" dir="ltr">` +
    styledSpan('The patient continues treatment for ') +
    `${createMultiSelect(BODY_AREA_OPTIONS, bodyArea)}` +
    styledSpan(' area today.') +
    styledBr() +
    styledSpan("The patient's general condition is ") +
    `${createSingleSelect(GENERAL_CONDITION_OPTIONS, generalCondition)}` +
    styledSpan(', compared with last treatment, the patient presents with ') +
    `${createSingleSelect(SYMPTOM_CHANGE_OPTIONS, symptomChange)}` +
    styledSpan(` The patient has ${createSingleSelect(CHANGE_LEVEL_OPTIONS, changeLevel1)} `) +
    styledSpan(`${createMultiSelect(SYMPTOM_TYPE_OPTIONS, symptomType)}, physical finding has `) +
    styledSpan(`${createSingleSelect(CHANGE_LEVEL_OPTIONS, changeLevel2)} ${createMultiSelect(PHYSICAL_FINDING_OPTIONS, physicalFinding)}. Patient tolerated `) +
    styledSpan(` ${createMultiSelect(SESSION_TYPE_OPTIONS, sessionType)} ${createMultiSelect(TREATMENT_RESPONSE_OPTIONS, treatmentResponse)}. No adverse side effect post treatment.`) +
    styledBr() +
    styledSpan('Current patient still has ') +
    `${createMultiSelect(LOCAL_PATTERN_OPTIONS, localPattern)}` +
    styledSpan(' in local meridian that cause the pain.') +
    `</body>`

  return html
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Converts GenerationContext to GeneratorContext for weight selection
 */
function toGeneratorContext(context: GenerationContext): GeneratorContext {
  return {
    noteType: context.noteType === 'IE' ? 'IE' : 'TX',
    insuranceType: context.insuranceType,
    bodyPart: context.primaryBodyPart as GeneratorContext['bodyPart'],
    laterality: context.laterality as GeneratorContext['laterality'],
    chronicityLevel: context.chronicityLevel as GeneratorContext['chronicityLevel'],
    painScore: 7,
    severityLevel: context.severityLevel as GeneratorContext['severityLevel'],
    localPattern: context.localPattern,
    systemicPattern: context.systemicPattern,
    age: undefined,
    occupation: undefined,
    weather: undefined,
    changeFromLastVisit: undefined,
    visitNumber: undefined
  }
}

/**
 * Selects treatment focus based on pattern type
 */
function selectTreatmentFocusFromPattern(pattern: string): string {
  const stagnationPatterns = ['Qi Stagnation', 'Blood Stasis', 'Liver Qi Stagnation', 'Phlegm-Damp', 'Phlegm-Heat']
  const deficiencyPatterns = ['Blood Deficiency', 'Qi & Blood Deficiency']
  const invasionPatterns = ['Wind-Cold Invasion', 'Cold-Damp + Wind-Cold']

  if (stagnationPatterns.includes(pattern)) {
    return 'promote'
  }
  if (deficiencyPatterns.includes(pattern)) {
    return 'focus'
  }
  if (invasionPatterns.includes(pattern)) {
    return 'emphasize'
  }
  return 'promote'
}

/**
 * Selects symptom change description based on visit change status
 */
function selectSymptomChangeFromVisit(changeFromLastVisit?: 'improvement' | 'no change' | 'exacerbate'): string {
  const mapping: Record<string, string> = {
    'improvement': 'improvement of symptom(s).',
    'no change': 'no change.',
    'exacerbate': 'exacerbate of symptom(s).'
  }
  return mapping[changeFromLastVisit || 'improvement'] || 'slight improvement of symptom(s).'
}

/**
 * Selects change level based on symptom change status
 */
function selectChangeLevelFromSymptomChange(changeFromLastVisit?: 'improvement' | 'no change' | 'exacerbate'): string {
  const mapping: Record<string, string> = {
    'improvement': 'reduced',
    'no change': 'remained the same',
    'exacerbate': 'increased'
  }
  return mapping[changeFromLastVisit || 'improvement'] || 'slightly reduced'
}

/**
 * Maps internal body part code to display name
 */
function getBodyPartDisplay(bodyPart: string): string {
  const mapping: Record<string, string> = {
    'LBP': 'Lower back',
    'MIDDLE_BACK': 'Middle back',
    'NECK': 'Neck',
    'UPPER_BACK': 'Upper back',
    'SHOULDER': 'Shoulder',
    'KNEE': 'Knee',
    'HIP': 'Hip',
    'ELBOW': 'Elbow',
    'WRIST': 'Wrist',
    'ANKLE': 'Ankle'
  }
  return mapping[bodyPart] || 'Lower back'
}

/**
 * Maps internal body part code to body area dropdown value
 */
function getBodyAreaDisplay(bodyPart: string): string {
  const mapping: Record<string, string> = {
    'LBP': 'lower back',
    'MIDDLE_BACK': 'midback',
    'NECK': 'neck',
    'UPPER_BACK': 'upper back'
  }
  return mapping[bodyPart] || 'lower back'
}

/**
 * Maps laterality to display format
 */
function getLateralityDisplay(laterality: string): string {
  const mapping: Record<string, string> = {
    'left': 'on left',
    'right': 'on right',
    'bilateral': 'on bilateral',
    'unspecified': 'on bilateral'
  }
  return mapping[laterality] || 'on bilateral'
}

/**
 * Gets appropriate treatment method based on pattern
 */
function getTreatmentMethodFromPattern(pattern: string): string {
  const mapping: Record<string, string> = {
    'Qi Stagnation': 'moving qi',
    'Blood Stasis': 'activating Blood circulation to dissipate blood stagnant',
    'Liver Qi Stagnation': 'regulates qi',
    'Blood Deficiency': 'activate blood and relax tendons',
    'Qi & Blood Deficiency': 'dredging channel and activating collaterals',
    'Wind-Cold Invasion': 'dispelling cold, drain the dampness',
    'Cold-Damp + Wind-Cold': 'dispelling cold, drain the dampness',
    'LV/GB Damp-Heat': 'clear damp-heat',
    'Phlegm-Damp': 'drain the dampness, clear damp',
    'Phlegm-Heat': 'resolve stagnation, clears heat',
    'Damp-Heat': 'clear damp-heat'
  }
  return mapping[pattern] || 'promote circulation, relieves pain'
}

// ============================================================================
// PLAIN TEXT GENERATORS (for compatibility)
// ============================================================================

/**
 * Generates plain text Assessment for IE
 */
export function generateAssessmentTextIE(context: GenerationContext): string {
  const bodyPart = getBodyPartDisplay(context.primaryBodyPart)
  const localPattern = context.localPattern || 'Phlegm-Damp'
  const systemicPattern = context.systemicPattern || 'Kidney Yin Deficiency'
  const treatmentMethod = getTreatmentMethodFromPattern(localPattern)
  const laterality = getLateralityDisplay(context.laterality)
  const bodyArea = getBodyAreaDisplay(context.primaryBodyPart)

  let text = `**TCM Dx:**\n`
  text += `${bodyPart} pain due to ${localPattern} in local meridian, but patient also has ${systemicPattern} in the general.\n`
  text += `Today's TCM treatment principles:\n`
  text += `promote on ${treatmentMethod} and harmonize yin/yang balance in order to promote good essence.\n`
  text += `Acupuncture Eval was done today ${laterality} ${bodyArea}.`

  return text
}

/**
 * Generates plain text Assessment for TX
 */
export function generateAssessmentTextTX(context: GenerationContext): string {
  const bodyArea = getBodyAreaDisplay(context.primaryBodyPart)
  const localPattern = context.localPattern || 'Phlegm-Damp'

  let text = `The patient continues treatment for ${bodyArea} area today.\n`
  text += `The patient's general condition is good, compared with last treatment, the patient presents with slight improvement of symptom(s). `
  text += `The patient has slightly reduced pain duration, physical finding has remained the same last visit. `
  text += `Patient tolerated acupuncture treatment with positive verbal response. No adverse side effect post treatment.\n`
  text += `Current patient still has ${localPattern} in local meridian that cause the pain.`

  return text
}

/**
 * Export all dropdown options for use in other modules
 */
export const ASSESSMENT_OPTIONS = {
  bodyPart: BODY_PART_OPTIONS,
  localPattern: LOCAL_PATTERN_OPTIONS,
  systemicPattern: SYSTEMIC_PATTERN_OPTIONS,
  treatmentFocus: TREATMENT_FOCUS_OPTIONS,
  treatmentMethod: TREATMENT_METHOD_OPTIONS,
  harmonize: HARMONIZE_OPTIONS,
  purpose: PURPOSE_OPTIONS,
  laterality: LATERALITY_OPTIONS,
  bodyArea: BODY_AREA_OPTIONS,
  generalCondition: GENERAL_CONDITION_OPTIONS,
  symptomChange: SYMPTOM_CHANGE_OPTIONS,
  changeLevel: CHANGE_LEVEL_OPTIONS,
  symptomType: SYMPTOM_TYPE_OPTIONS,
  physicalFinding: PHYSICAL_FINDING_OPTIONS,
  sessionType: SESSION_TYPE_OPTIONS,
  treatmentResponse: TREATMENT_RESPONSE_OPTIONS
} as const

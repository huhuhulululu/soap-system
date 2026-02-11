/**
 * Plan Section Generator
 * Generates Plan HTML for IE (Initial Evaluation) and TX (Treatment) templates
 * Matches original template format exactly with all dropdown options preserved
 * Integrates weight-based selection for intelligent defaults
 */

import type {
  GenerationContext,
  InsuranceType,
  BodyPart
} from '../types'

import {
  selectTreatmentFrequency,
  selectAcupoints,
  selectElectricalStimulation,
  selectOperationTime,
  selectTreatmentPrinciples,
  selectWeightedSingle,
  GeneratorContext
} from './weight-integration'

// =============================================================================
// Constants and Mappings
// =============================================================================

/**
 * Insurance type to needle protocol format mapping
 * HF/OPTUM use simplified 97810 code, others use full code
 */
const INSURANCE_NEEDLE_MAP: Record<InsuranceType, '97810' | 'full'> = {
  'NONE': 'full',
  'HF': '97810',
  'OPTUM': '97810',
  'WC': 'full',
  'VC': 'full',
  'ELDERPLAN': 'full'
}

/**
 * Body part display names
 */
const BODY_PART_NAMES: Record<BodyPart, string> = {
  'LBP': 'lower back',
  'NECK': 'neck',
  'UPPER_BACK': 'upper back',
  'MIDDLE_BACK': 'middle back',
  'SHOULDER': 'shoulder',
  'ELBOW': 'elbow',
  'WRIST': 'wrist',
  'HAND': 'hand',
  'HIP': 'hip',
  'KNEE': 'knee',
  'ANKLE': 'ankle',
  'FOOT': 'foot',
  'THIGH': 'thigh',
  'CALF': 'calf',
  'ARM': 'arm',
  'FOREARM': 'forearm'
}

// =============================================================================
// Dropdown Options
// =============================================================================

/**
 * All dropdown options for Plan section
 */
const PLAN_DROPDOWNS = {
  // IE Plan dropdowns
  evaluationType: ['Initial Evaluation', 'Re-Evaluation'],
  contactTime: ['5-10', '10-15', '15-20', '20-30', '30-44'],
  evaluationExamType: ['Initial evaluation', 'Re evaluation'],

  // Short/Long Term Goal dropdowns
  treatmentFrequency: ['2', '4', '6', '8', '10', '12'],
  weeksDuration: ['2-3', '3-4', '4-5', '5-6'],
  longTermWeeks: ['3-4', '4-5', '5-6'],
  painScaleTarget: ['3', '3-4', '4', '4-5', '5', '5-6', '6'],
  longTermPainScale: ['3', '3-4', '4', '4-5', '5'],
  symptomTypes: ['soreness', 'stiffness', 'heaviness', 'weakness', 'numbness'],
  percentageScale: ['10%', '10%-20%', '20%', '20%-30%', '30%', '30%-40%', '40%', '40%-50%', '50%', '50%-60%', '60%', '60%-70%', '70%', '70%-80%', '80%', '80%-90%', '90%', '100%'],
  tightnessLevel: ['mild', 'mild-moderate', 'moderate'],
  longTermTightness: ['mild', 'mild-moderate'],
  tendernessGrade: ['2', '1'],
  spasmsGrade: ['2', '1'],
  muscleStrength: ['5', '4+', '4'],
  romPercentage: ['20%', '30%', '40%', '50%', '60%', '70%', '80%'],
  adlLevel: ['mild', 'mild-moderate'],

  // TX Plan dropdowns
  treatmentPrinciplesFocus: ['continue to emphasize', 'emphasize', 'consist of promoting', 'promote', 'focus', 'pay attention'],
  treatmentActions: [
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
  ],

  // Needle protocol dropdowns
  needleSize1_5: ['30#', '32#', '34#'],
  needleSize2: ['30#', '32#'],
  totalOperationTime: ['15', '30', '45', '60'],
  sectionTime: ['15', '30'],
  withWithout: ['with', 'without'],
  preparationSteps: ['Greeting patient', 'Review of the chart', 'Routine examination of the patient current condition', 'Preparation'],
  bodyPartArea: ['lower back', 'mid and lower back'],
  sideOptions: ['right', 'left']
}

// =============================================================================
// Acupoint Data by Body Part
// =============================================================================

interface AcupointConfig {
  frontPoints1: string[]
  frontPoints2: string[]
  backPoints1: string[]
  backPoints2: string[]
  backPointsSimple: string[] // For 97810 simplified protocol
  needleSizes: string
}

const ACUPOINT_DATA: Record<string, AcupointConfig> = {
  'LBP': {
    frontPoints1: ['ST40', 'REN4', 'REN6', 'GB26', 'GB34', 'ST36', 'KD3', 'SP6', 'LV3', 'SI3', 'YAO TONG XUE'],
    frontPoints2: ['ST40', 'REN4', 'REN6', 'GB26', 'GB34', 'ST36', 'KD3', 'SP6', 'LV3', 'SI3', 'YAO TONG XUE'],
    backPoints1: ['BL22', 'BL23', 'BL24', 'BL25', 'BL26', 'BL29', 'BL40', 'BL52', 'BL53', 'BL54', 'DU4', 'GB30', 'YAO JIA JI', 'A SHI POINTS'],
    backPoints2: ['BL22', 'BL23', 'BL24', 'BL25', 'BL26', 'BL29', 'BL40', 'BL52', 'BL53', 'BL54', 'DU4', 'GB30', 'YAO JIA JI', 'A SHI POINTS'],
    backPointsSimple: ['BL22', 'BL23', 'BL24', 'BL25', 'BL26', 'BL29', 'BL40', 'BL52', 'BL53', 'BL54', 'DU4', 'GB30', 'SI 3', 'YAO JIA JI', 'A SHI POINTS', 'YAO TONG XUE'],
    needleSizes: 'Select Needle Size : 34#x1\" ,<span class="ppnSelectComboSingle 30#|32#|34#">30#</span>&nbsp;x1.5\",<span class="ppnSelectComboSingle 30#|32#">30#</span>&nbsp;x2\",30#x3\"'
  },
  'NECK': {
    frontPoints1: ['GB34', 'ST36', 'SI3', 'SJ5', 'SP6', 'REN4', 'REN6', 'LV3', 'LI11', 'DU20'],
    frontPoints2: ['GB34', 'ST36', 'SI3', 'SJ5', 'SP6', 'REN4', 'REN6', 'LV3', 'LI11', 'DU20'],
    backPoints1: ['BL23', 'BL20', 'BL40', 'BL55', 'BL38', 'BL55', 'BL56', 'A SHI POINTS'],
    backPoints2: ['BAI LAO', 'GB14', 'GB20', 'GB21', 'BL9', 'BL10', 'BL11', 'BL12', 'BL13', 'BL14', 'SI13', 'SI14', 'DU14', 'JIN JIA JI', 'A SHI POINTS'],
    backPointsSimple: ['GB14', 'GB20', 'GB19', 'GB21', 'BL9', 'BL10', 'BL11', 'BL12', 'BL13', 'BL14', 'SI13', 'SI14', 'DU14', 'JIN JIA JI', 'A SHI POINTS', 'LAO ZHEN XUE', 'BAI LAO'],
    needleSizes: 'Select Needle Size :36#x0.5\" , 34#x1\" ,<span class="ppnSelectComboSingle 30#|32#|34#">30#</span>&nbsp;x1.5\"'
  },
  'SHOULDER': {
    frontPoints1: ['JIAN QIAN', 'PC2', 'LU3', 'LU4', 'LU5', 'LI4', 'LI11', 'ST3', 'GB34', 'SI3', 'ST38'],
    frontPoints2: ['JIAN QIAN', 'PC2', 'LU3', 'LU4', 'LU5', 'LI4', 'LI11', 'ST3', 'GB34', 'SI3', 'ST38'],
    backPoints1: ['GB21', 'BL10', 'BL11', 'BL17', 'LI15', 'LI16', 'SI9', 'SI10', 'SI11', 'SI12', 'SI14', 'SI15', 'SJ10', 'A SHI POINTS'],
    backPoints2: ['GB21', 'BL10', 'BL11', 'BL17', 'LI15', 'LI16', 'SI9', 'SI10', 'SI11', 'SI12', 'SI14', 'SI15', 'SJ10', 'A SHI POINTS'],
    backPointsSimple: ['GB21', 'BL10', 'BL11', 'BL17', 'LI15', 'LI16', 'SI9', 'SI10', 'SI11', 'SI12', 'SI14', 'SI15', 'SJ10', 'A SHI POINTS'],
    needleSizes: 'Select Needle Size :36#x0.5\" , 34#x1\" ,<span class="ppnSelectComboSingle 30#|32#|34#">30#</span>&nbsp;x1.5\"'
  },
  'KNEE': {
    frontPoints1: ['GB33', 'GB34', 'GB36', 'GB39', 'UB40', 'ST34', 'ST35', 'ST36', 'ST40', 'SP3', 'SP9', 'SP10', 'KD3', 'KD10', 'XI YAN', 'LV4', 'REN4', 'HE DING', 'A SHI POINT'],
    frontPoints2: ['GB33', 'GB34', 'GB36', 'GB39', 'ST34', 'ST35', 'ST36', 'ST40', 'SP3', 'SP9', 'SP10', 'KD3', 'KD10', 'XI YAN', 'LV4', 'REN4', 'HE DING', 'A SHI POINT'],
    backPoints1: ['BL23', 'BL20', 'BL40', 'BL55', 'BL38', 'BL55', 'BL56', 'A SHI POINTS', 'BL57'],
    backPoints2: ['BL23', 'BL20', 'BL40', 'BL55', 'BL38', 'BL55', 'BL56', 'BL57', 'A SHI POINTS'],
    backPointsSimple: ['GB33', 'GB34', 'GB36', 'GB39', 'ST34', 'ST35', 'ST36', 'ST40', 'SP3', 'SP9', 'SP10', 'KD3', 'KD10', 'XI YAN', 'LV4', 'HE DING', 'A SHI POINT'],
    needleSizes: 'Select Needle Size : 34#x1\" ,<span class="ppnSelectComboSingle 30#|32#|34#">30#</span>&nbsp;x1.5\",<span class="ppnSelectComboSingle 30#|32#">30#</span>&nbsp;x2\"'
  },
  'HIP': {
    frontPoints1: ['GB30', 'GB29', 'GB31', 'GB34', 'UB31', 'UB32', 'UB33', 'UB34', 'UB25', 'UB27', 'A SHI POINTS'],
    frontPoints2: ['GB30', 'GB29', 'GB31', 'GB34', 'UB31', 'UB32', 'UB33', 'UB34', 'UB25', 'UB27', 'A SHI POINTS'],
    backPoints1: ['GB30', 'GB29', 'GB31', 'GB34', 'UB31', 'UB32', 'UB33', 'UB34', 'UB25', 'UB27', 'A SHI POINTS'],
    backPoints2: ['GB30', 'GB29', 'GB31', 'GB34', 'UB31', 'UB32', 'UB33', 'UB34', 'UB25', 'UB27', 'A SHI POINTS'],
    backPointsSimple: ['GB30', 'GB29', 'GB31', 'GB34', 'UB31', 'UB32', 'UB33', 'UB34', 'UB25', 'UB27', 'A SHI POINTS'],
    needleSizes: 'Select Needle Size : 34#x1\" ,<span class="ppnSelectComboSingle 30#|32#|34#">30#</span>&nbsp;x1.5\",<span class="ppnSelectComboSingle 30#|32#">30#</span>&nbsp;x2\",30#x3\"'
  },
  'ELBOW': {
    frontPoints1: ['SJ5', 'SJ6', 'SJ7', 'SJ8', 'SJ9', 'SJ12', 'LI6', 'LI7', 'LI8', 'LI9', 'LI10', 'LI11', 'LI12', 'LI13', 'LU3', 'LU4', 'LU7', 'LU8', 'LU9', 'A SHI POINTS'],
    frontPoints2: ['SJ5', 'SJ6', 'SJ7', 'SJ8', 'SJ9', 'SJ12', 'LI6', 'LI7', 'LI8', 'LI9', 'LI10', 'LI11', 'LI12', 'LI13', 'LU3', 'LU4', 'LU5', 'LU6', 'LU7', 'LU8', 'LU9', 'A SHI POINTS'],
    backPoints1: ['LU5', 'LU6', 'PC3', 'PC4', 'HT2', 'HT3', 'A SHI POINTS'],
    backPoints2: ['LU5', 'LU6', 'PC3', 'PC4', 'HT2', 'HT3', 'A SHI POINTS'],
    backPointsSimple: ['SJ5', 'SJ6', 'LI9', 'LI10', 'LI11', 'LI12', 'LI13', 'LU5', 'LU6', 'PC3', 'PC4', 'HT2', 'HT3', 'A SHI POINTS'],
    needleSizes: 'Select Needle Size :36#x0.5\" , 34#x1\" ,<span class="ppnSelectComboSingle 30#|32#|34#">30#</span>&nbsp;x1.5\"'
  },
  'ANKLE': {
    frontPoints1: ['ST41', 'ST42', 'GB40', 'SP5', 'KD3', 'KD6', 'BL60', 'BL62', 'LV4', 'A SHI POINTS'],
    frontPoints2: ['ST41', 'ST42', 'GB40', 'SP5', 'KD3', 'KD6', 'BL60', 'BL62', 'LV4', 'A SHI POINTS'],
    backPoints1: ['BL60', 'BL62', 'KD3', 'KD6', 'GB40', 'A SHI POINTS'],
    backPoints2: ['BL60', 'BL62', 'KD3', 'KD6', 'GB40', 'A SHI POINTS'],
    backPointsSimple: ['ST41', 'ST42', 'GB40', 'SP5', 'KD3', 'KD6', 'BL60', 'BL62', 'LV4', 'A SHI POINTS'],
    needleSizes: 'Select Needle Size : 34#x1\" ,<span class="ppnSelectComboSingle 30#|32#|34#">30#</span>&nbsp;x1.5\",<span class="ppnSelectComboSingle 30#|32#">30#</span>&nbsp;x2\"'
  },
  'WRIST': {
    frontPoints1: ['LI5', 'SJ4', 'SJ5', 'SI4', 'SI5', 'LU7', 'LU9', 'PC6', 'PC7', 'HT7', 'A SHI POINTS'],
    frontPoints2: ['LI5', 'SJ4', 'SJ5', 'SI4', 'SI5', 'LU7', 'LU9', 'PC6', 'PC7', 'HT7', 'A SHI POINTS'],
    backPoints1: ['LI5', 'SJ4', 'SJ5', 'SI4', 'SI5', 'A SHI POINTS'],
    backPoints2: ['LI5', 'SJ4', 'SJ5', 'SI4', 'SI5', 'A SHI POINTS'],
    backPointsSimple: ['LI5', 'SJ4', 'SJ5', 'SI4', 'SI5', 'LU7', 'LU9', 'PC6', 'PC7', 'HT7', 'A SHI POINTS'],
    needleSizes: 'Select Needle Size :36#x0.5\" , 34#x1\" ,<span class="ppnSelectComboSingle 30#|32#|34#">30#</span>&nbsp;x1.5\"'
  },
  'MIDDLE_BACK': {
    frontPoints1: ['GB34', 'ST36', 'SP6', 'LV3', 'REN4', 'REN6', 'KD3'],
    frontPoints2: ['GB34', 'ST36', 'SP6', 'LV3', 'REN4', 'REN6', 'KD3'],
    backPoints1: ['BL15', 'BL16', 'BL17', 'BL18', 'BL19', 'BL20', 'BL21', 'DU9', 'DU10', 'DU11', 'HUATUO JIA JI', 'A SHI POINTS'],
    backPoints2: ['BL15', 'BL16', 'BL17', 'BL18', 'BL19', 'BL20', 'BL21', 'DU9', 'DU10', 'DU11', 'HUATUO JIA JI', 'A SHI POINTS'],
    backPointsSimple: ['BL15', 'BL17', 'BL18', 'BL20', 'DU9', 'DU10', 'HUATUO JIA JI', 'A SHI POINTS'],
    needleSizes: 'Select Needle Size : 34#x1\" ,<span class="ppnSelectComboSingle 30#|32#|34#">30#</span>&nbsp;x1.5\",<span class="ppnSelectComboSingle 30#|32#">30#</span>&nbsp;x2\",30#x3\"'
  }
}

// Default config for body parts not explicitly defined
const DEFAULT_ACUPOINT_CONFIG: AcupointConfig = {
  frontPoints1: ['ST36', 'SP6', 'LV3', 'GB34', 'LI4', 'A SHI POINTS'],
  frontPoints2: ['ST36', 'SP6', 'LV3', 'GB34', 'LI4', 'A SHI POINTS'],
  backPoints1: ['BL23', 'BL25', 'A SHI POINTS'],
  backPoints2: ['BL23', 'BL25', 'A SHI POINTS'],
  backPointsSimple: ['BL23', 'BL25', 'A SHI POINTS'],
  needleSizes: 'Select Needle Size : 34#x1\" ,<span class="ppnSelectComboSingle 30#|32#|34#">30#</span>&nbsp;x1.5\",<span class="ppnSelectComboSingle 30#|32#">30#</span>&nbsp;x2\"'
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a single-select dropdown span
 */
function createSingleSelectDropdown(options: readonly string[], selected: string): string {
  const optionsStr = options.join('|')
  return `<span class="ppnSelectComboSingle ${optionsStr}">${selected}</span>`
}

/**
 * Create a multi-select dropdown span
 */
function createMultiSelectDropdown(options: readonly string[], selected: string): string {
  const optionsStr = options.join('|')
  return `<span class="ppnSelectCombo ${optionsStr}">${selected}</span>`
}

/**
 * Get acupoint configuration for body part
 */
function getAcupointConfig(bodyPart: BodyPart): AcupointConfig {
  return ACUPOINT_DATA[bodyPart] || DEFAULT_ACUPOINT_CONFIG
}

/**
 * Convert GenerationContext to GeneratorContext for weight functions
 */
function toGeneratorContext(context: GenerationContext): GeneratorContext {
  return {
    noteType: context.noteType === 'TX' ? 'TX' : 'IE',
    insuranceType: context.insuranceType,
    bodyPart: context.primaryBodyPart,
    laterality: context.laterality || 'bilateral',
    secondaryBodyParts: context.secondaryBodyParts,
    chronicityLevel: context.chronicityLevel,
    painScore: 7,
    severityLevel: context.severityLevel,
    localPattern: context.localPattern,
    systemicPattern: context.systemicPattern,
    age: undefined,
    occupation: undefined,
    habits: undefined,
    medicalHistory: undefined,
    hasPacemaker: context.hasPacemaker,
    weather: undefined,
    changeFromLastVisit: undefined,
    visitNumber: undefined
  }
}

/**
 * Select weeks duration based on chronicity level
 */
function selectWeeksDuration(ctx: GeneratorContext): string {
  if (ctx.chronicityLevel === 'Acute') {
    return '2-3'
  } else if (ctx.chronicityLevel === 'Sub Acute') {
    return '3-4'
  }
  // Chronic or default
  return '5-6'
}

/**
 * Select pain scale target based on current pain score
 */
function selectPainScaleTarget(ctx: GeneratorContext): string {
  const painScore = ctx.painScore || 7
  if (painScore >= 8) {
    return '5-6'
  } else if (painScore >= 6) {
    return '4-5'
  } else if (painScore >= 4) {
    return '3-4'
  }
  return '3'
}

/**
 * Select long term pain scale target
 */
function selectLongTermPainScale(ctx: GeneratorContext): string {
  const painScore = ctx.painScore || 7
  if (painScore >= 8) {
    return '4'
  } else if (painScore >= 6) {
    return '3-4'
  }
  return '3'
}

/**
 * Determine if insurance uses simplified 97810 protocol
 */
function isSimplifiedProtocol(insuranceType: InsuranceType): boolean {
  return INSURANCE_NEEDLE_MAP[insuranceType] === '97810'
}

// =============================================================================
// Main Generator Functions
// =============================================================================

/**
 * Generate complete Plan HTML based on template type
 */
export function generatePlanHTML(context: GenerationContext, template: 'IE' | 'TX'): string {
  if (template === 'IE') {
    return generatePlanIE(context)
  }
  return generatePlanTX(context)
}

/**
 * Generate IE (Initial Evaluation) Plan
 * Includes: Initial Evaluation section, Short Term Goal, Long Term Goal, Needle Protocol
 * Uses weight-based selection for intelligent defaults
 */
export function generatePlanIE(context: GenerationContext): string {
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart]
  const genCtx = toGeneratorContext(context)

  // Weight-based selections
  const treatmentFrequency = selectTreatmentFrequency(PLAN_DROPDOWNS.treatmentFrequency, genCtx)
  const weeksDuration = selectWeeksDuration(genCtx)
  const painScaleTarget = selectPainScaleTarget(genCtx)
  const longTermPainScale = selectLongTermPainScale(genCtx)

  let html = `<body id="tinymce" class="mceContentBody " contenteditable="true" dir="ltr">`

  // Initial Evaluation Header
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.evaluationType, 'Initial Evaluation')}`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;"> - Personal one on one contact with the patient (total </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; background-color: #ccccff;">`
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.contactTime, '20-30')} </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;">mins)</span><br/>`

  // Steps 1-4
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;">1. Greeting patient.</span><br/>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;">2. Detail explanation from patient of past medical history and current symptom.</span><br/>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;">3. `
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.evaluationExamType, 'Initial evaluation')}`
  html += ` examination of the patient current condition.</span><br/>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;">4. Explanation with patient for medical decision/treatment plan.</span><br/><br/>`

  // Short Term Goal - using weight-based selections
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Short Term Goal (</span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;">RELIEF </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">TREATMENT FREQUENCY: </span>`
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.treatmentFrequency, treatmentFrequency)}`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;"> treatments in </span>`
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.weeksDuration, weeksDuration)}`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;"> weeks)</span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">:</span>`

  // Short Term Goal Details - using weight-based pain scale target
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: arial, helvetica, sans-serif;">`
  html += `<span style="font-family: verdana, geneva;"><br/>Decrease Pain Scale to</span></span>`
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.painScaleTarget, painScaleTarget)}`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;">.</span>`

  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: arial, helvetica, sans-serif;">`
  html += `<span style="font-family: verdana, geneva;"><br/>Decrease </span></span>`
  html += `${createMultiSelectDropdown(PLAN_DROPDOWNS.symptomTypes, 'weakness')}`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;"> sensation </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: arial, helvetica, sans-serif;">`
  html += `<span style="font-family: verdana, geneva;">Scale to </span></span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">`
  html += `${createMultiSelectDropdown(PLAN_DROPDOWNS.percentageScale, '50%')}`

  html += `<br/>Decrease Muscles </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;">Tightness </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">to `
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.tightnessLevel, 'moderate')}</span>`

  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;"><br/>Decrease </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Muscles Tenderness to </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Grade</span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;"> `
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.tendernessGrade, '2')}</span>`

  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: arial, helvetica, sans-serif;">`
  html += `<span style="font-family: verdana, geneva;"><br/></span></span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Decrease </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Muscles Spasms to </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Grade</span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;"> `
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.spasmsGrade, '2')}</span>`

  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;"><br/></span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Increase </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Muscles Strength to</span>`
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.muscleStrength, '4')}<br/><br/>`

  // Long Term Goal
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Long Term Goal (</span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;">ADDITIONAL MAINTENANCE &amp; SUPPORTING TREATMENTS FREQUENCY: </span>`
  html += `${createSingleSelectDropdown(['2', '4', '6', '8', '10'], '8')}`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;"> treatments in </span>`
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.longTermWeeks, '5-6')}`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;"> weeks)</span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">:</span>`

  // Long Term Goal Details - using weight-based long term pain scale
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: arial, helvetica, sans-serif;">`
  html += `<span style="font-family: verdana, geneva;"><br/>Decrease Pain Scale to</span></span>`
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.longTermPainScale, longTermPainScale)}`

  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: arial, helvetica, sans-serif;">`
  html += `<span style="font-family: verdana, geneva;"><br/>Decrease </span></span>`
  html += `${createMultiSelectDropdown(PLAN_DROPDOWNS.symptomTypes, 'weakness')}`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;"> sensation </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: arial, helvetica, sans-serif;">`
  html += `<span style="font-family: verdana, geneva;">Scale to </span></span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">`
  html += `${createMultiSelectDropdown(PLAN_DROPDOWNS.percentageScale, '30%')}`

  html += `<br/>Decrease Muscles </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;">Tightness </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">to `
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.longTermTightness, 'mild-moderate')}</span>`

  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;"><br/>Decrease </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Muscles Tenderness to </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Grade</span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;"> `
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.tendernessGrade, '1')}</span>`

  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: arial, helvetica, sans-serif;">`
  html += `<span style="font-family: verdana, geneva;"><br/></span></span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Decrease </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Muscles Spasms to </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Grade</span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;"> `
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.spasmsGrade, '1')}</span>`

  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;"><br/></span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Increase </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Muscles Strength to</span>`
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.muscleStrength, '4+')}`

  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;"><br/>Increase ROM `
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.romPercentage, '60%')}<br/></span>`

  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">Decrease </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;">impaired Activities of Daily Living </span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;">to</span>`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2; font-family: verdana, geneva;"> `
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.adlLevel, 'mild-moderate')}.</span>`

  html += `</body>`

  return html
}

/**
 * Generate TX (Treatment) Plan
 * Includes: Treatment principles only, followed by Needle Protocol
 * Uses weight-based selection for treatment principles
 */
export function generatePlanTX(context: GenerationContext): string {
  const genCtx = toGeneratorContext(context)

  // Weight-based treatment principle selection
  const treatmentPrinciples = selectTreatmentPrinciples(PLAN_DROPDOWNS.treatmentActions, genCtx, 2)
  const selectedPrinciples = treatmentPrinciples.length > 0
    ? treatmentPrinciples.join(', ')
    : 'drain the dampness, clear damp'

  let html = `<body id="tinymce" class="mceContentBody " contenteditable="true" dir="ltr">`

  html += `<strong style="font-variant-ligatures: normal; orphans: 2; widows: 2;">Today's treatment principles:</strong><br/>`

  html += `${createMultiSelectDropdown(PLAN_DROPDOWNS.treatmentPrinciplesFocus, 'consist of promoting')}`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;"> on </span>`
  html += `${createMultiSelectDropdown(PLAN_DROPDOWNS.treatmentActions, selectedPrinciples)}`
  html += `<span style="font-variant-ligatures: normal; orphans: 2; widows: 2;"> to speed up the recovery, soothe the tendon.</span>`

  html += `</body>`

  return html
}

/**
 * Generate Needle Protocol HTML based on insurance type and body part
 * Full code (60 mins, 4 steps) for most insurances
 * 97810 code (15 mins, simplified) for HF/OPTUM
 */
export function generateNeedleProtocolHTML(context: GenerationContext): string {
  const isSimplified = isSimplifiedProtocol(context.insuranceType)
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart]
  const acupointConfig = getAcupointConfig(context.primaryBodyPart)
  const eStim = context.hasPacemaker ? 'without' : 'with'

  if (isSimplified) {
    return generateSimplifiedNeedleProtocol(context, bodyPartName, acupointConfig)
  }
  return generateFullNeedleProtocol(context, bodyPartName, acupointConfig, eStim)
}

/**
 * Generate full needle protocol (60 mins, 4 steps with front/back points)
 */
function generateFullNeedleProtocol(
  context: GenerationContext,
  bodyPartName: string,
  config: AcupointConfig,
  eStim: string
): string {
  const hasLaterality = ['SHOULDER', 'KNEE', 'ELBOW', 'HIP', 'ANKLE', 'WRIST'].includes(context.primaryBodyPart)
  const areaDropdown = context.primaryBodyPart === 'LBP'
    ? createSingleSelectDropdown(['lower back', 'mid and lower back'], 'mid and lower back')
    : bodyPartName

  let html = `<body id="tinymce" class="mceContentBody " contenteditable="true" dir="ltr">`

  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += config.needleSizes
  html += `<br/>Daily acupuncture treatment for&nbsp;${areaDropdown}&nbsp;- Personal one on one contact with the patient (Total Operation Time:&nbsp;`
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.totalOperationTime, '60')}&nbsp;mins)</p>`

  // Front Points Section
  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `Front Points: (${createSingleSelectDropdown(PLAN_DROPDOWNS.sectionTime, '30')}&nbsp;mins) - personal one on one contact with the patient</p>`

  // Step 1 - Front Points Initial
  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `1.&nbsp;${createMultiSelectDropdown(PLAN_DROPDOWNS.preparationSteps, 'Greeting patient, Review of the chart, Routine examination of the patient current condition')}`
  html += `&nbsp;, washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, marking and cleaning the points, Initial Acupuncture needle inserted&nbsp;`

  if (hasLaterality) {
    html += `for&nbsp;${createMultiSelectDropdown(PLAN_DROPDOWNS.sideOptions, 'right')}&nbsp;${bodyPartName}&nbsp;`
  }

  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.withWithout, eStim)}&nbsp;electrical stimulation&nbsp;`
  html += `${createMultiSelectDropdown(config.frontPoints1, config.frontPoints1.slice(0, 3).join(', '))}&nbsp;&nbsp;</p>`

  // Step 2 - Front Points Additional
  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `2. Explanation with patient for future treatment plan,&nbsp;washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, marking and cleaning the points,&nbsp;re-insertion of additional needles&nbsp;`

  if (hasLaterality) {
    html += `for&nbsp;${createMultiSelectDropdown(PLAN_DROPDOWNS.sideOptions, 'left')}&nbsp;${bodyPartName}&nbsp;`
  }

  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.withWithout, eStim)}&nbsp;electrical stimulation&nbsp;`
  html += `${createMultiSelectDropdown(config.frontPoints2, config.frontPoints2.slice(3, 6).join(', '))}&nbsp;</p>`

  // Remove front needles
  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `Removing and properly disposing of needles&nbsp;</p>`

  // Back Points Section
  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `Back Points (30 mins) - personal one on one contact with the patient</p>`

  // Step 3 - Back Points Initial
  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `3. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, marking and cleaning the points,&nbsp;re-insertion of additional needles&nbsp;`

  if (hasLaterality) {
    html += `for&nbsp;${createMultiSelectDropdown(PLAN_DROPDOWNS.sideOptions, 'right')}&nbsp;${bodyPartName}&nbsp;`
  }

  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.withWithout, eStim)}&nbsp;electrical stimulation&nbsp;`
  html += `${createMultiSelectDropdown(config.backPoints1, config.backPoints1.slice(0, 3).join(', '))}&nbsp;&nbsp;</p>`

  // Step 4 - Back Points Additional
  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, marking and cleaning the points,&nbsp;re-insertion of additional needles&nbsp;`

  if (hasLaterality) {
    html += `for&nbsp;${createMultiSelectDropdown(PLAN_DROPDOWNS.sideOptions, 'left')}&nbsp;${bodyPartName}&nbsp;`
  }

  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.withWithout, 'without')}&nbsp;electrical stimulation&nbsp;`
  html += `${createMultiSelectDropdown(config.backPoints2, config.backPoints2.slice(3, 6).join(', '))}&nbsp;</p>`

  // Remove back needles and closing
  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `<span style="background-color: #ffffff;">Removing and properly disposing of needles</span></p>`

  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `Post treatment service and education patient about precautions at home after treatment.</p>`

  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `Documentation&nbsp;</p>`

  html += `</body>`

  return html
}

/**
 * Generate simplified needle protocol (97810 - 15 mins, 1 step, no e-stim)
 */
function generateSimplifiedNeedleProtocol(
  context: GenerationContext,
  bodyPartName: string,
  config: AcupointConfig
): string {
  let html = `<body id="tinymce" class="mceContentBody " contenteditable="true" dir="ltr">`

  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += config.needleSizes
  html += `<br/>Daily acupuncture treatment for ${bodyPartName} - Personal one on one contact with the patient (Total Operation Time:&nbsp;`
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.totalOperationTime, '15')}&nbsp;mins)</p>`

  // Back Points Section Only
  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `Back Points: (${createSingleSelectDropdown(PLAN_DROPDOWNS.sectionTime, '15')}&nbsp;mins) - personal one on one contact with the patient</p>`

  // Single Step - Back Points
  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `1.&nbsp;${createMultiSelectDropdown(PLAN_DROPDOWNS.preparationSteps, 'Preparation')}`
  html += `&nbsp;, washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, marking and cleaning the points, Initial Acupuncture needle inserted&nbsp;`
  html += `${createSingleSelectDropdown(PLAN_DROPDOWNS.withWithout, 'without')}&nbsp;electrical stimulation&nbsp;`
  html += `${createMultiSelectDropdown(config.backPointsSimple, config.backPointsSimple.slice(0, 4).join(', '))}&nbsp;&nbsp;</p>`

  // Closing
  html += `<p class="MsoNormal" style="font-variant-ligatures: normal; orphans: 2; widows: 2;">`
  html += `Removing and properly disposing of needles<br/>`
  html += `Post treatment service and education patient about precautions at home after treatment.<br/>`
  html += `Documentation&nbsp;</p>`

  html += `</body>`

  return html
}

/**
 * Generate combined Plan section (for IE: goals + needle protocol, for TX: principles + needle protocol)
 */
export function generateCompletePlanSection(context: GenerationContext): string {
  const template: 'IE' | 'TX' = context.noteType === 'TX' ? 'TX' : 'IE'
  const planContent = generatePlanHTML(context, template)
  const needleProtocol = generateNeedleProtocolHTML(context)

  // Extract inner content from body tags and combine
  const planInner = planContent.replace(/<body[^>]*>/, '').replace(/<\/body>/, '')
  const needleInner = needleProtocol.replace(/<body[^>]*>/, '').replace(/<\/body>/, '')

  return `<body id="tinymce" class="mceContentBody " contenteditable="true" dir="ltr">${planInner}<br/><br/>${needleInner}</body>`
}

// =============================================================================
// Exports
// =============================================================================

export {
  PLAN_DROPDOWNS,
  ACUPOINT_DATA,
  INSURANCE_NEEDLE_MAP,
  BODY_PART_NAMES,
  isSimplifiedProtocol,
  getAcupointConfig
}

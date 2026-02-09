/**
 * Subjective Section HTML Generator
 * Generates HTML that precisely matches the template structure with ppnSelectCombo dropdowns
 */

import type { GenerationContext, BodyPart, Laterality, SeverityLevel } from '../types'
import {
  selectPainTypes,
  selectCausativeFactors,
  selectExacerbatingFactors,
  selectADLDifficultyLevel,
  selectADLActivities,
  selectPainFrequency,
  selectDurationUnit,
  GeneratorContext as WeightContext
} from './weight-integration'

// ==================== Dropdown Option Definitions ====================

const DROPDOWN_OPTIONS = {
  visitType: ['INITIAL EVALUATION', 'RE-EVALUATIOIN', 'DAILY NOTE'],
  chronicity: ['Acute', 'Sub Acute', 'Chronic'],
  lateralityLong: ['along right', 'along left', 'along bilateral', 'in left', 'in right', 'in bilateral'],
  bodyAreaLBP: ['midback', 'mid and lower back', 'lower back', 'lower back and buttocks'],
  painTypes: ['Dull', 'Burning', 'Freezing', 'Shooting', 'Tingling', 'Stabbing', 'Aching', 'Squeezing', 'Cramping', 'pricking', 'weighty', 'cold', 'pin &amp; needles'],
  radiation: ['without radiation', 'with radiation to BLUE', 'with radiation to R leg', 'with radiation to L leg'],
  radiationTX: ['without radiation', 'with radiation to R leg', 'with radiation to L leg', 'with radiation to BLLE', 'with radiation to toes'],
  durationNumber: ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'more than 10', 'many'],
  durationUnit: ['week(s)', 'month(s)', 'year(s)', 'day(s)'],
  associatedSymptoms: ['soreness', 'stiffness', 'heaviness', 'weakness', 'numbness'],
  percentageScale: ['10%', '10%-20%', '20%', '20%-30%', '30%', '30%-40%', '40%', '40%-50%', '50%', '50%-60%', '60%', '60%-70%', '70%', '70%-80%', '80%', '80%-90%', '90%', '100%'],
  causeType: ['because of', 'may related of', 'due to'],
  causeTypeTX: ['because of', 'may related of', 'due to', 'and'],
  causativeFactors: ['age related/degenerative changes', 'expose to the cold air for more than 20 mins', 'live in too cold environment', 'weather change', 'poor sleep', 'over used due to heavy household chores', 'over used due to nature of work', 'excessive used of phone/tablet', 'overworking in computer', 'prolong walking', 'prolong sitting', 'longtime driving', 'sitting over 30 mins with bad posture', 'climb too much stairs', 'intense excise', 'lifting too much weight', 'hurt myself during exercise', 'repetitive injury from past work', 'repetitive strain from activities in the past', 'strain when pick up heavy object from floor', 'sprain when pick up heavy object from floor', 'recent sprain', 'sprain', 'fell (no sign of fracture)'],
  exacerbationType: ['exacerbated by', 'aggravated by'],
  exacerbatingFactors: ['any strenuous activities', 'repetitive motions', 'poor sleep', 'mental stress', 'extension', 'flexion', 'abduction', 'adduction', 'internal rotation', 'external rotation', 'sleep to the side', 'Standing after sitting for long time', 'Stair climbing', 'Sitting on a low chair', 'Sitting cross leg', 'Prolong walking'],
  severityLevel: ['severe', 'moderate to severe', 'moderate', 'mild to moderate', 'mild'],
  adlActivities: ['performing household chores', 'working long time in front of computer', 'long hours of driving', 'doing laundry', 'Cooking', 'Going up and down stairs', 'Lifting objects', 'Bending over to wear/tie a shoe', 'Rising from a chair', 'Standing for long periods of time', 'Walking for long periods of time', 'sitting for long periods of time', 'Getting out of bed', 'standing for cooking'],
  relievingFactors: ['Moving around', 'Changing positions', 'Stretching', 'Resting', 'Lying down', 'Applying heating pad', 'Applying ice pad', 'Leaning forward onto something', 'Using of joint support', 'Massage', 'Medications'],
  activityChanges: ['decrease outside activity', 'stay in bed', 'decrease housework', 'decrease standing time', 'decrease walking time', 'decrease sitting time', 'decrease time working with computer', 'decrease climb stairs', 'decrease exercise', 'normal activity', 'maintain regular schedule', 'irregular schedule'],
  improvementTime: ['after a week', 'over-the-counter pain medication'],
  secondaryBodyParts: ['neck', 'upper back', 'middle back', 'lower back', 'shoulder', 'arm', 'elbow', 'wrist', 'hand', 'hip', 'leg', 'knee', 'ankle', 'foot'],
  painScale: ['10', '10-9', '9', '9-8', '8', '8-7', '7', '7-6', '6', '6-5', '5', '5-4', '4', '4-3', '3', '3-2', '2', '2-1', '1', '1-0', '0'],
  painFrequency: ['Intermittent (symptoms occur less than 25% of the time)', 'Occasional (symptoms occur between 26% and 50% of the time)', 'Frequent (symptoms occur between 51% and 75% of the time)', 'Constant (symptoms occur between 76% and 100% of the time)'],
  walkingAid: ['none', 'cane', 'wheel chair', 'assitant', 'walker'],
  medicalHistory: ['N/A', 'Smoking', 'Alcohol', 'Diabetes', 'Hypertension', 'Heart Disease', 'Liver Disease', 'Pacemaker', 'Anemia', 'Lung Disease', 'Kidney Disease', 'Heart Murmur', 'Thyroid', 'Stroke', 'Asthma', 'Herniated Disk', 'tinnitus', 'Pinched Nerve', 'Osteoporosis', 'Fractures', 'Hysterectomy', 'Hyperlipidemia', 'stomach trouble', 'C-section', 'Parkinson', 'Cholesterol', 'Joint Replacement', 'Prostate'],
  // TX specific
  progressStatus: ['improvement of symptom(s)', 'exacerbate of symptom(s)', 'similar symptom(s) as last visit', 'improvement after treatment, but pain still came back next day'],
  progressReasons: ['can move joint more freely and with less pain', 'physical activity no longer causes distress', 'reduced level of pain', 'reduced joint stiffness and swelling', 'less difficulty performing daily activities', 'energy level improved', 'sleep quality improved', 'more energy level throughout the day', 'continuous treatment', 'maintain regular treatments', 'still need more treatments to reach better effect', 'weak constitution', 'skipped treatments', 'stopped treatment for a while', 'discontinuous treatment', 'did not have good rest', 'intense work', 'excessive time using cell phone', 'excessive time using computer', 'bad posture', 'carrying/lifting heavy object(s)', 'lack of exercise', 'exposure to cold air', 'uncertain reason']
} as const

// ==================== Style Constants ====================

const SPAN_STYLE = 'font-variant-ligatures: normal; orphans: 2; widows: 2; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial;'
const BR_STYLE = SPAN_STYLE
const SMALL_FONT_STYLE = `${SPAN_STYLE} font-family: arial, helvetica, sans-serif; font-size: small;`

// ==================== Helper Functions ====================

/**
 * Creates a single-select dropdown (ppnSelectComboSingle)
 */
function createSingleDropdown(options: readonly string[], selected: string): string {
  const optionsStr = options.join('|')
  return `<span class="ppnSelectComboSingle ${optionsStr}" style="${SPAN_STYLE}">${selected}</span>`
}

/**
 * Creates a multi-select dropdown (ppnSelectCombo)
 */
function createMultiDropdown(options: readonly string[], selected: string | string[]): string {
  const optionsStr = options.join('|')
  const selectedStr = Array.isArray(selected) ? selected.join(', ') : selected
  return `<span class="ppnSelectCombo ${optionsStr}" style="${SPAN_STYLE}">${selectedStr}</span>`
}

/**
 * Creates a styled span with text
 */
function styledSpan(content: string, additionalStyle: string = ''): string {
  const style = additionalStyle ? `${SPAN_STYLE} ${additionalStyle}` : SPAN_STYLE
  return `<span style="${style}">${content}</span>`
}

/**
 * Creates a styled line break
 */
function styledBr(): string {
  return `<br style="${BR_STYLE}">`
}

/**
 * Gets the body area options based on body part
 */
function getBodyAreaOptions(bodyPart: BodyPart): readonly string[] {
  const areaMap: Partial<Record<BodyPart, readonly string[]>> = {
    'LBP': DROPDOWN_OPTIONS.bodyAreaLBP,
    'MIDDLE_BACK': ['midback', 'mid and lower back'],
    'NECK': ['neck', 'neck and upper back'],
    'SHOULDER': ['shoulder', 'shoulder and upper back'],
    'KNEE': ['knee', 'knee and thigh'],
    'HIP': ['hip', 'hip and buttocks']
  }
  return areaMap[bodyPart] || DROPDOWN_OPTIONS.bodyAreaLBP
}

/**
 * Gets display name for body area based on body part
 */
function getBodyAreaDisplay(bodyPart: BodyPart): string {
  const displayMap: Record<BodyPart, string> = {
    'LBP': 'lower back',
    'NECK': 'neck',
    'UPPER_BACK': 'upper back',
    'MIDDLE_BACK': 'midback',
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
  return displayMap[bodyPart]
}

/**
 * Gets laterality display format
 */
function getLateralityDisplay(laterality: Laterality, format: 'in' | 'along' = 'in'): string {
  const inMap: Record<Laterality, string> = {
    'left': 'in left',
    'right': 'in right',
    'bilateral': 'in bilateral',
    'unspecified': 'in bilateral'
  }
  const alongMap: Record<Laterality, string> = {
    'left': 'along left',
    'right': 'along right',
    'bilateral': 'along bilateral',
    'unspecified': 'along bilateral'
  }
  return format === 'in' ? inMap[laterality] : alongMap[laterality]
}

/**
 * Converts GenerationContext to WeightContext for weight-based selection
 */
function toWeightContext(ctx: GenerationContext, noteType: 'IE' | 'TX'): WeightContext {
  return {
    noteType,
    insuranceType: ctx.insuranceType,
    bodyPart: ctx.primaryBodyPart,
    laterality: ctx.laterality,
    secondaryBodyParts: ctx.secondaryBodyParts,
    chronicityLevel: ctx.chronicityLevel,
    painScore: 7,
    severityLevel: ctx.severityLevel,
    localPattern: ctx.localPattern,
    systemicPattern: ctx.systemicPattern,
    hasPacemaker: ctx.hasPacemaker,
    age: undefined,
    occupation: undefined,
    habits: undefined,
    medicalHistory: undefined,
    weather: undefined,
    changeFromLastVisit: undefined,
    visitNumber: undefined
  }
}

// ==================== IE Subjective Generator ====================

/**
 * Generates IE (Initial Evaluation) Subjective HTML
 */
function generateIESubjectiveHTML(context: GenerationContext): string {
  const bodyAreaOptions = getBodyAreaOptions(context.primaryBodyPart)
  const bodyAreaDisplay = getBodyAreaDisplay(context.primaryBodyPart)
  const lateralityDisplay = getLateralityDisplay(context.laterality)

  // Convert to weight context for intelligent selection
  const weightCtx = toWeightContext(context, 'IE')

  // Use weight-based selection for dynamic values
  const selectedPainTypes = selectPainTypes(DROPDOWN_OPTIONS.painTypes, weightCtx, 2)
  const selectedCausativeFactors = selectCausativeFactors(DROPDOWN_OPTIONS.causativeFactors, weightCtx, 2)
  const selectedExacerbatingFactors = selectExacerbatingFactors(DROPDOWN_OPTIONS.exacerbatingFactors, weightCtx, 3)
  const selectedADLLevel = selectADLDifficultyLevel(DROPDOWN_OPTIONS.severityLevel, weightCtx)
  const selectedADLActivities = selectADLActivities(DROPDOWN_OPTIONS.adlActivities, weightCtx, 2)
  const selectedPainFrequency = selectPainFrequency(DROPDOWN_OPTIONS.painFrequency, weightCtx)
  const selectedDurationUnit = selectDurationUnit(DROPDOWN_OPTIONS.durationUnit, weightCtx)

  // Build secondary body parts list
  const secondaryParts = context.secondaryBodyParts?.map(bp => getBodyAreaDisplay(bp)) || ['neck', 'upper back', 'shoulder', 'knee']

  let html = ''

  // Line 1: Visit Type
  html += `<span class="ppnSelectComboSingle ${DROPDOWN_OPTIONS.visitType.join('|')}" style="${SPAN_STYLE}">INITIAL EVALUATION<br></span>`
  html += styledBr()

  // Line 2: Patient complaint with chronicity
  html += styledSpan('Patient c/o ')
  html += createSingleDropdown(DROPDOWN_OPTIONS.chronicity, context.chronicityLevel)
  html += styledSpan(' pain')

  // Laterality and body area
  html += styledSpan(` ${createSingleDropdown(DROPDOWN_OPTIONS.lateralityLong, lateralityDisplay)} `)
  html += createMultiDropdown(bodyAreaOptions, bodyAreaDisplay)
  html += styledSpan(' which is ')

  // Pain types - using weight-based selection
  html += styledSpan(` ${createMultiDropdown(DROPDOWN_OPTIONS.painTypes, selectedPainTypes)} `)
  html += createMultiDropdown(DROPDOWN_OPTIONS.radiation, 'without radiation')
  html += styledSpan('. The patient has been complaining of the pain for ')
  html += createSingleDropdown(DROPDOWN_OPTIONS.durationNumber, '8')
  html += styledSpan(' ')

  // Duration unit and worsening - using weight-based selection
  html += styledSpan(` ${createSingleDropdown(DROPDOWN_OPTIONS.durationUnit, selectedDurationUnit)} which got worse in recent`)
  html += styledSpan(` ${createSingleDropdown(DROPDOWN_OPTIONS.durationNumber, '3')} `)
  html += createSingleDropdown(DROPDOWN_OPTIONS.durationUnit, 'week(s)')
  html += styledSpan(' . The pain is associated with muscles ')

  // Associated symptoms and percentage
  html += createMultiDropdown(DROPDOWN_OPTIONS.associatedSymptoms, ['soreness', 'weakness'])
  html += styledSpan(' (scale as ')
  html += createMultiDropdown(DROPDOWN_OPTIONS.percentageScale, '70%')
  html += styledSpan(') ')
  html += createSingleDropdown(DROPDOWN_OPTIONS.causeType, 'due to')
  html += styledSpan(' ')

  // Causative factors - using weight-based selection
  html += createMultiDropdown(DROPDOWN_OPTIONS.causativeFactors, selectedCausativeFactors)
  html += styledSpan('.')
  html += styledBr()
  html += styledBr()

  // Exacerbating factors - using weight-based selection
  html += styledSpan(`The pain is ${createSingleDropdown(DROPDOWN_OPTIONS.exacerbationType, 'exacerbated by')} `)
  html += styledSpan(` ${createMultiDropdown(DROPDOWN_OPTIONS.exacerbatingFactors, selectedExacerbatingFactors)}. There is `)

  // ADL difficulty - using weight-based selection
  html += createSingleDropdown(DROPDOWN_OPTIONS.severityLevel, selectedADLLevel)
  html += styledSpan(' difficulty with ADLs like ')
  html += createMultiDropdown(DROPDOWN_OPTIONS.adlActivities, selectedADLActivities)
  html += styledSpan('.')
  html += styledBr()
  html += styledBr()

  // Relieving factors and activity changes
  html += createMultiDropdown(DROPDOWN_OPTIONS.relievingFactors, ['Changing positions', 'Resting', 'Massage'])
  html += styledSpan(' can temporarily relieve the pain. Due to this condition patient has ')
  html += createMultiDropdown(DROPDOWN_OPTIONS.activityChanges, ['decrease outside activity', 'decrease walking time'])
  html += styledSpan(' The pain did not')

  // Improvement time
  html += `<span style="${SPAN_STYLE} color: #040404; font-family: 'Open Sans', sans-serif; font-size: 15px;">`
  html += `<span style="font-family: arial, helvetica, sans-serif; font-size: small;"> improved ${createMultiDropdown(DROPDOWN_OPTIONS.improvementTime, 'after a week')}</span></span>`
  html += styledSpan(' which promoted the patient to seek acupuncture and oriental medicine intervention.')
  html += styledBr()
  html += styledBr()

  // Secondary body parts
  html += styledSpan('Patient also complaints of chronic pain on the ')
  html += createMultiDropdown(DROPDOWN_OPTIONS.secondaryBodyParts, secondaryParts)
  html += styledSpan(` comes and goes, which is less severe compared to the ${createSingleDropdown(DROPDOWN_OPTIONS.lateralityLong, lateralityDisplay)} `)
  html += styledSpan(`${createMultiDropdown(bodyAreaOptions, bodyAreaDisplay)} pain.`)
  html += styledBr()
  html += styledBr()

  // Pain Scale section
  html += `<span class="s1" style="${SMALL_FONT_STYLE}">Pain Scale: Worst: ${createSingleDropdown(DROPDOWN_OPTIONS.painScale, '8')} </span>`
  html += `<span class="s1" style="${SMALL_FONT_STYLE}">; </span>`
  html += `<span class="s1" style="${SMALL_FONT_STYLE}">Best: ${createSingleDropdown(DROPDOWN_OPTIONS.painScale, '4')} ; </span>`
  html += `<span class="s1" style="${SMALL_FONT_STYLE}">Current: ${createSingleDropdown(DROPDOWN_OPTIONS.painScale, '8')}<br></span>`

  // Pain Frequency - using weight-based selection
  html += `<span style="${SMALL_FONT_STYLE}">Pain Frequency: </span>`
  html += createSingleDropdown(DROPDOWN_OPTIONS.painFrequency, selectedPainFrequency)
  html += styledBr()

  // Walking aid
  html += styledSpan('Walking aid :')
  html += `<span class="ppnSelectComboSingle ${DROPDOWN_OPTIONS.walkingAid.join('|')}" style="${SPAN_STYLE}">none<br><br>`
  html += `<span style="font-family: arial, helvetica, sans-serif; font-size: small;">Medical history/Contraindication or Precision: </span>`
  html += createMultiDropdown(DROPDOWN_OPTIONS.medicalHistory, 'Cholesterol')
  html += `</span>`

  return html
}

// ==================== TX Subjective Generator ====================

/**
 * Generates TX (Treatment) Subjective HTML
 */
function generateTXSubjectiveHTML(context: GenerationContext): string {
  const bodyAreaOptions = getBodyAreaOptions(context.primaryBodyPart)
  const bodyAreaDisplay = getBodyAreaDisplay(context.primaryBodyPart)

  // Convert to weight context for intelligent selection
  const weightCtx = toWeightContext(context, 'TX')

  // Use weight-based selection for dynamic values
  const selectedPainTypes = selectPainTypes(DROPDOWN_OPTIONS.painTypes, weightCtx, 2)
  const selectedADLLevel = selectADLDifficultyLevel(DROPDOWN_OPTIONS.severityLevel, weightCtx)
  const selectedADLActivities = selectADLActivities(DROPDOWN_OPTIONS.adlActivities, weightCtx, 2)
  const selectedPainFrequency = selectPainFrequency(DROPDOWN_OPTIONS.painFrequency, weightCtx)

  let html = ''

  // Follow up visit header
  html += styledSpan('Follow up visit')
  html += styledBr()

  // Progress report - nested span structure matching template
  html += `<span class="ppnSelectComboSingle Normal|Emotion stress|Lack of motivation|Anxiety|Restless|Irritability|Lassitude" style="${SPAN_STYLE}">`
  html += `<span class="ppnSelectComboSingle Normal|Emotion stress|Lack of motivation|Anxiety|Restless|Irritability|Lassitude">`
  html += `<span class="ppnSelectCombo Normal|Stressful|Anxious|Depressed|Irritable|Sad|Negative|Positive">`
  html += `<span style="background-color: #ffffff;">Patient reports: there is </span></span></span>`

  // Progress status
  html += `<span class="ppnSelectComboSingle improvement of symptom(s)|exacerbate of symptom(s)|similar symptom(s) as last visit|improvement after treatment, but pain still came back next day">improvement of symptom(s)</span> `

  // Reason
  html += `<span class="ppnSelectCombo maintain regular treatments|still need more treatments to reach better effect|uncertain reason|discontinuous treatments|stopped treatment for a while|intense work|working on computer day by day|excessive time using cell phone|bad posture day by day|carrying/lifting heavy object(s)|lack of exercise|exposure to cold air">`
  html += `<span class="ppnSelectComboSingle because of|may related of|due to|and">because of</span> </span></span>`

  // Progress reasons
  html += createMultiDropdown(DROPDOWN_OPTIONS.progressReasons, 'more energy level throughout the day')
  html += `<span style="${SPAN_STYLE} background-color: #ccccff;"> .</span>`
  html += styledBr()

  // Continuing complaint - using weight-based selection for pain types
  html += styledSpan('Patient still c/o ')
  html += createMultiDropdown(DROPDOWN_OPTIONS.painTypes, selectedPainTypes)
  html += styledSpan(' pain on')
  html += styledSpan(` ${createMultiDropdown(bodyAreaOptions, bodyAreaDisplay)} area `)

  // Radiation
  html += createSingleDropdown(DROPDOWN_OPTIONS.radiationTX, 'without radiation')
  html += styledSpan(', associated with muscles ')

  // Associated symptoms
  html += createMultiDropdown(DROPDOWN_OPTIONS.associatedSymptoms, 'weakness')
  html += styledSpan(' (scale as ')
  html += createMultiDropdown(DROPDOWN_OPTIONS.percentageScale, '70%')
  html += styledSpan('), impaired performing ADL\'s with ')

  // ADL difficulty - nested structure with weight-based selection
  html += `<span class="ppnSelectComboSingle Normal|Emotion stress|Lack of motivation|Anxiety|Restless|Irritability|Lassitude" style="${SPAN_STYLE}">`
  html += `<span class="ppnSelectComboSingle severe|moderate to severe|moderate|mild to moderate|mild">${selectedADLLevel}</span>`
  html += `<span style="background-color: #ffffff;"> difficulty with ADLs like </span>`
  html += createMultiDropdown(DROPDOWN_OPTIONS.adlActivities, selectedADLActivities)
  html += `<span style="background-color: #ffffff;">.</span><br></span>`
  html += styledBr()

  // Pain Scale
  html += `<span class="s1" style="${SMALL_FONT_STYLE}">Pain Scale: </span>`
  html += `<span class="s1" style="${SMALL_FONT_STYLE}">${createSingleDropdown(DROPDOWN_OPTIONS.painScale, '8')} /10</span>`
  html += styledBr()

  // Pain frequency - using weight-based selection
  html += `<span style="${SMALL_FONT_STYLE}">Pain frequency: </span>`
  html += createSingleDropdown(DROPDOWN_OPTIONS.painFrequency, selectedPainFrequency)

  return html
}

// ==================== Main Export Functions ====================

/**
 * Generates complete Subjective HTML with body wrapper
 */
export function generateSubjectiveHTML(context: GenerationContext, template: 'IE' | 'TX'): string {
  const innerHtml = template === 'IE'
    ? generateIESubjectiveHTML(context)
    : generateTXSubjectiveHTML(context)

  return `<body id="tinymce" class="mceContentBody " onload="window.parent.tinyMCE.get('Subjective').onLoad.dispatch();" contenteditable="true" dir="ltr">${innerHtml}</body>`
}

/**
 * Creates a dropdown element for external use
 */
export function createDropdown(
  type: 'single' | 'multi',
  options: string[],
  selected: string | string[]
): string {
  return type === 'single'
    ? createSingleDropdown(options, Array.isArray(selected) ? selected[0] : selected)
    : createMultiDropdown(options, selected)
}

/**
 * Export dropdown options for external use
 */
export { DROPDOWN_OPTIONS }

/**
 * Generates raw Subjective content without body wrapper (for preview/editing)
 */
export function generateSubjectiveContent(context: GenerationContext, template: 'IE' | 'TX'): string {
  return template === 'IE'
    ? generateIESubjectiveHTML(context)
    : generateTXSubjectiveHTML(context)
}

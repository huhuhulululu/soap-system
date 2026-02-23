import type { GenerationContext, SeverityLevel } from '../types'
import { getWeightedOptions, type RuleContext } from '../parser/rule-engine'
import { getTemplateOptionsForField } from '../parser/template-rule-whitelist'
import { inferCondition, inferProgressMultiplier, inferInitialAdjustments } from '../knowledge/medical-history-engine'

/**
 * Body part specific muscle mapping for objective findings
 */
export const MUSCLE_MAP: Record<string, string[]> = {
  SHOULDER: [
    'trapezius',
    'deltoid',
    'supraspinatus',
    'infraspinatus',
    'subscapularis',
    'teres minor',
    'teres major',
    'rhomboid',
    'levator scapulae',
    'pectoralis major',
    'pectoralis minor',
    'serratus anterior'
  ],
  KNEE: [
    'quadriceps',
    'hamstrings',
    'gastrocnemius',
    'popliteus',
    'sartorius',
    'gracilis',
    'tensor fasciae latae',
    'iliotibial band',
    'vastus medialis',
    'vastus lateralis',
    'rectus femoris'
  ],
  NECK: [
    'sternocleidomastoid',
    'scalenes',
    'trapezius',
    'levator scapulae',
    'splenius capitis',
    'splenius cervicis',
    'semispinalis capitis',
    'longus colli',
    'longus capitis',
    'suboccipital muscles'
  ],
  LBP: [
    'erector spinae',
    'quadratus lumborum',
    'psoas',
    'iliacus',
    'multifidus',
    'transversus abdominis',
    'internal oblique',
    'external oblique',
    'rectus abdominis',
    'gluteus maximus',
    'gluteus medius',
    'piriformis'
  ],
  ELBOW: [
    'biceps brachii',
    'triceps brachii',
    'brachialis',
    'brachioradialis',
    'pronator teres',
    'supinator',
    'extensor carpi radialis longus',
    'extensor carpi radialis brevis',
    'flexor carpi radialis',
    'flexor carpi ulnaris'
  ],
  HIP: [
    'iliopsoas',
    'gluteus maximus',
    'gluteus medius',
    'gluteus minimus',
    'piriformis',
    'tensor fasciae latae',
    'rectus femoris',
    'sartorius',
    'adductor longus',
    'adductor magnus',
    'pectineus',
    'gracilis'
  ],
  MID_LOW_BACK: [
    'erector spinae',
    'quadratus lumborum',
    'psoas',
    'iliacus',
    'multifidus',
    'transversus abdominis',
    'internal oblique',
    'external oblique',
    'rectus abdominis',
    'gluteus maximus',
    'gluteus medius',
    'piriformis',
    'rhomboids',
    'middle trapezius',
    'latissimus dorsi',
    'serratus posterior'
  ]
}

/**
 * Body part specific ADL (Activities of Daily Living) mapping
 */
export const ADL_MAP: Record<string, string[]> = {
  SHOULDER: [
    'reaching overhead',
    'lifting objects',
    'carrying groceries',
    'dressing',
    'combing hair',
    'washing back',
    'sleeping on affected side',
    'driving',
    'performing household chores',
    'opening doors'
  ],
  KNEE: [
    'walking',
    'climbing stairs',
    'descending stairs',
    'squatting',
    'kneeling',
    'getting up from chair',
    'standing for prolonged periods',
    'running',
    'jumping',
    'driving'
  ],
  NECK: [
    'turning head',
    'looking up',
    'looking down',
    'reading',
    'driving',
    'working at computer',
    'sleeping',
    'lifting objects',
    'carrying bags',
    'talking on phone'
  ],
  LBP: [
    'bending forward',
    'lifting objects',
    'sitting for prolonged periods',
    'standing for prolonged periods',
    'walking',
    'getting out of bed',
    'putting on shoes',
    'driving',
    'performing household chores',
    'carrying objects'
  ],
  ELBOW: [
    'gripping objects',
    'lifting objects',
    'turning doorknobs',
    'opening jars',
    'typing',
    'writing',
    'carrying bags',
    'shaking hands',
    'using tools',
    'cooking'
  ],
  HIP: [
    'walking',
    'climbing stairs',
    'getting up from chair',
    'sitting cross-legged',
    'putting on shoes',
    'getting in and out of car',
    'lying on affected side',
    'squatting',
    'running',
    'standing on one leg'
  ],
  MID_LOW_BACK: [
    'bending forward',
    'lifting objects',
    'sitting for prolonged periods',
    'standing for prolonged periods',
    'walking',
    'getting out of bed',
    'putting on shoes',
    'driving',
    'performing household chores',
    'carrying objects',
    'twisting motions'
  ]
}

export interface TXSequenceOptions {
  txCount: number
  seed?: number
  /** 从第几个 TX 开始生成（1-based）。省略时从 1 开始。 */
  startVisitIndex?: number
  /** 从用户最后一个 TX 提取的实际状态，作为续写起点。 */
  initialState?: {
    pain: number
    tightness: number
    tenderness: number
    spasm: number
    frequency: number
    painTypes?: string[]
    associatedSymptom?: string
    symptomScale?: string
    generalCondition?: string
    inspection?: string
    tightnessGrading?: string
    tendernessGrade?: string
    tonguePulse?: { tongue: string; pulse: string }
    acupoints?: string[]
    electricalStimulation?: boolean
    treatmentTime?: number
  }
}

export interface TXVisitState {
  visitIndex: number
  progress: number
  painScaleCurrent: number
  /** 吸附到模板下拉框有效刻度的标签 (如 "8", "8-7", "7", "7-6") */
  painScaleLabel: string
  severityLevel: SeverityLevel
  symptomChange: string
  reasonConnector: string
  reason: string
  associatedSymptom: string
  painFrequency: string
  generalCondition: string
  treatmentFocus: string
  tightnessGrading: string
  tendernessGrading: string
  spasmGrading: string
  needlePoints: string[]
  /** 舌脉信息，从 IE 继承保持一致 */
  tonguePulse: {
    tongue: string
    pulse: string
  }
  /** 续写继承字段 */
  painTypes?: string[]
  inspection?: string
  symptomScale?: string
  electricalStimulation?: boolean
  treatmentTime?: number
  sideProgress?: {
    left: number
    right: number
  }
  objectiveFactors: {
    sessionGapDays: number
    sleepLoad: number
    workloadLoad: number
    weatherExposureLoad: number
    adherenceLoad: number
  }
  soaChain: {
    subjective: {
      painChange: 'improved'
      adlChange: 'improved' | 'stable'
      frequencyChange: 'improved' | 'stable'
    }
    objective: {
      tightnessTrend: 'reduced' | 'slightly reduced' | 'stable'
      tendernessTrend: 'reduced' | 'slightly reduced' | 'stable'
      romTrend: 'improved' | 'slightly improved' | 'stable'
      strengthTrend: 'improved' | 'slightly improved' | 'stable'
    }
    assessment: {
      present: string
      patientChange: string
      whatChanged: string
      physicalChange: string
      findingType: string
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 创建 RNG。
 * - 传入 seed: 纯确定性，可复现
 * - 不传 seed: 混合运行时熵，不可复现
 * 返回 { rng, seed } — seed 用于记录和复现
 */
function createSeededRng(seed?: number): { rng: () => number; seed: number } {
  if (seed != null) {
    // 确定性模式：相同 seed 产生相同序列
    return { rng: mulberry32(seed >>> 0), seed: seed >>> 0 }
  }
  // 熵模式：生成随机 seed
  const now = Date.now()
  const randomBits = Math.floor(Math.random() * 0xffffffff)
  const perfBits = (() => {
    try {
      return Number(process.hrtime.bigint() % BigInt(0xffffffff))
    } catch {
      return Math.floor(Math.random() * 0xffffffff)
    }
  })()
  const generatedSeed = (now ^ randomBits ^ perfBits) >>> 0
  return { rng: mulberry32(generatedSeed), seed: generatedSeed }
}

function parsePainTarget(target: string | undefined, fallback: number): number {
  if (!target) return fallback
  const nums = (target.match(/\d+/g) || []).map(n => parseInt(n, 10)).filter(n => !isNaN(n))
  if (nums.length === 0) return fallback
  if (nums.length === 1) return nums[0]
  return (nums[0] + nums[1]) / 2
}

/**
 * 模板 Pain Scale 下拉框有效选项 (来自 ppnSelectComboSingle)
 * 选项: 10|10-9|9|9-8|8|8-7|7|7-6|6|6-5|5|5-4|4|4-3|3|3-2|2|2-1|1|1-0|0
 *
 * 刻度是整数 (10,9,8,...,0)
 * "X-(X-1)" 是过渡范围, 代表"在 X 和 X-1 之间"
 *
 * 吸附逻辑:
 *   raw >= N+0.75        → N+1 (整数)
 *   N+0.25 <= raw < N+0.75 → "(N+1)-N" (范围)
 *   raw < N+0.25         → N (整数)
 */
function snapPainToGrid(rawPain: number): { value: number; label: string } {
  const clamped = Math.max(0, Math.min(10, rawPain))
  const floor = Math.floor(clamped)
  const frac = clamped - floor

  if (frac >= 0.75) {
    // 接近上一个整数
    const val = Math.min(10, floor + 1)
    return { value: val, label: `${val}` }
  } else if (frac >= 0.25) {
    // 在两个整数之间 → 范围标签 "(floor+1)-floor"
    // value 用实际 rawPain 而非上界, 确保纵向约束能检测到下降
    const hi = Math.min(10, floor + 1)
    return { value: clamped, label: `${hi}-${floor}` }
  } else {
    // 接近当前整数
    return { value: floor, label: `${floor}` }
  }
}

function severityFromPain(pain: number): SeverityLevel {
  // 与模板整数刻度对齐:
  // 9-10 → severe
  // 7-8  → moderate to severe
  // 6    → moderate
  // 4-5  → mild to moderate
  // 0-3  → mild
  if (pain >= 9) return 'severe'
  if (pain >= 7) return 'moderate to severe'
  if (pain >= 6) return 'moderate'
  if (pain >= 4) return 'mild to moderate'
  return 'mild'
}

function findTemplateOption(fieldPath: string, preferred: string[], fallback: string): string {
  const options = getTemplateOptionsForField(fieldPath)
  if (options.length === 0) return fallback
  const lowerMap = new Map(options.map(o => [o.toLowerCase(), o]))
  for (const p of preferred) {
    const hit = lowerMap.get(p.toLowerCase())
    if (hit) return hit
  }
  return options[0]
}

function deriveAssessmentFromSOA(input: {
  painDelta: number
  adlDelta: number
  frequencyImproved: boolean
  visitIndex: number
  objectiveTightnessTrend: 'reduced' | 'slightly reduced' | 'stable'
  objectiveTendernessTrend: 'reduced' | 'slightly reduced' | 'stable'
  objectiveSpasmTrend: 'reduced' | 'slightly reduced' | 'stable'
  objectiveRomTrend: 'improved' | 'slightly improved' | 'stable'
  objectiveStrengthTrend: 'improved' | 'slightly improved' | 'stable'
}): {
  present: string
  patientChange: string
  whatChanged: string
  physicalChange: string
  findingType: string
} {
  const present = input.painDelta >= 0.7
    ? 'improvement of symptom(s).'
    : 'slight improvement of symptom(s).'

  const patientChange = input.painDelta >= 0.7
    ? 'decreased'
    : 'slightly decreased'

  // Hard chain rule:
  // S frequency improved -> A must mention "pain frequency".
  // Rotate among equivalent options by visitIndex to avoid identical assessments
  const adlOptions = ['difficulty in performing ADLs', 'pain and discomfort', 'symptom severity']
  const whatChanged = input.frequencyImproved
    ? 'pain frequency'
    : input.adlDelta > 0.2
      ? adlOptions[input.visitIndex % adlOptions.length]
      : 'pain'

  const strongPhysicalImprove =
    input.objectiveRomTrend === 'improved' ||
    input.objectiveStrengthTrend === 'improved' ||
    input.objectiveTightnessTrend === 'reduced' ||
    input.objectiveTendernessTrend === 'reduced' ||
    input.objectiveSpasmTrend === 'reduced'

  const hasAnyObjectiveImprove =
    input.objectiveRomTrend !== 'stable' ||
    input.objectiveStrengthTrend !== 'stable' ||
    input.objectiveTightnessTrend !== 'stable' ||
    input.objectiveTendernessTrend !== 'stable' ||
    input.objectiveSpasmTrend !== 'stable'

  const physicalChange = !hasAnyObjectiveImprove
    ? 'remained the same'
    : strongPhysicalImprove
      ? 'reduced'
      : 'slightly reduced'

  // 修复: 当所有客观趋势都是 stable 时, 不能用 "last visit" 作为 findingType
  // 因为 "slightly reduced last visit" 语法不通, 需要回退到具体体征名
  const findingType = (() => {
    if (input.objectiveRomTrend !== 'stable') {
      return 'joint ROM limitation'
    }
    if (input.objectiveStrengthTrend !== 'stable') {
      return 'muscles strength'
    }
    if (input.objectiveTightnessTrend !== 'stable') {
      return 'local muscles tightness'
    }
    if (input.objectiveTendernessTrend !== 'stable') {
      return 'local muscles tenderness'
    }
    if (input.objectiveSpasmTrend !== 'stable') {
      return 'local muscles spasms'
    }
    return 'joint ROM limitation'
  })()

  return { present, patientChange, whatChanged, physicalChange, findingType }
}

function buildRuleContext(ctx: GenerationContext, painScaleCurrent: number, severityLevel: SeverityLevel): RuleContext {
  return {
    header: {
      noteType: 'TX',
      insuranceType: ctx.insuranceType
    },
    subjective: {
      chronicityLevel: ctx.chronicityLevel,
      primaryBodyPart: {
        bodyPart: ctx.primaryBodyPart,
        laterality: ctx.laterality
      },
      painScale: {
        current: painScaleCurrent
      },
      symptomChange: 'improvement of symptom(s)',
      adlDifficulty: {
        level: severityLevel
      }
    },
    assessment: {
      tcmDiagnosis: {
        localPattern: ctx.localPattern,
        systemicPattern: ctx.systemicPattern
      }
    },
    patient: {
      medicalHistory: ctx.hasPacemaker ? ['Pacemaker'] : []
    }
  }
}

function addProgressBias(
  fieldPath: string,
  weighted: Array<{ option: string; weight: number; reasons: string[] }>,
  progress: number
): Array<{ option: string; weight: number; reasons: string[] }> {
  const isLate = progress >= 0.67
  const isMid = progress >= 0.34 && progress < 0.67
  const isEarly = progress < 0.34

  return weighted
    .map(item => {
      let bias = 0
      const text = item.option.toLowerCase()

      if (fieldPath === 'subjective.symptomChange') {
        // 遵循现有规则：早期允许多样性，后期倾向改善
        if (text.includes('improvement of symptom')) bias += isLate ? 60 : (isMid ? 25 : 5)
        if (text.includes('exacerbate')) bias -= 70 // 加重少见
        if (text.includes('similar')) bias -= isLate ? 60 : (isMid ? 25 : 0)
        if (text.includes('came back')) bias -= isLate ? 55 : (isMid ? 15 : -5)
      }

      if (fieldPath === 'subjective.reason') {
        if (!isLate && (text.includes('energy level improved') || text.includes('sleep quality improved'))) bias += 35
        if (isMid && text.includes('reduced level of pain')) bias += 30
        if (isLate && text.includes('less difficulty performing daily activities')) bias += 40
      }

      // generalCondition 不再参与进度偏置
      // 它是基于患者基础体质(年龄/基础病/证型)的固定属性，在循环外一次性确定

      if (fieldPath === 'subjective.painFrequency') {
        if (isLate && text.includes('occasional')) bias += 35
        if (isMid && text.includes('frequent')) bias += 20
        if (!isLate && text.includes('constant')) bias += 15
      }

      if (fieldPath === 'objective.muscleTesting.tightness.gradingScale') {
        if (isLate && text === 'mild') bias += 40
        if (isMid && text === 'moderate') bias += 25
        // 修复: 好转分支中 "severe" 在中后期应强制压低
        if (text === 'severe') bias -= isMid ? 50 : (isLate ? 80 : 10)
        if (text === 'moderate to severe') bias -= isMid ? 30 : (isLate ? 60 : 5)
      }

      if (fieldPath === 'objective.muscleTesting.tenderness.gradingScale') {
        if (isLate && (text.includes('+1') || text.includes('mild'))) bias += 40
        if (isMid && text.includes('+2')) bias += 25
        // 修复: +4 在中后期强制压低
        if (text.includes('+4') || text.includes('severe tenderness')) bias -= isMid ? 50 : (isLate ? 80 : 15)
        if (text.includes('+3') && !text.includes('+3)')) bias -= isLate ? 40 : 10
      }

      return { ...item, weight: item.weight + bias }
    })
    .sort((a, b) => b.weight - a.weight)
}

function pickSingle(
  fieldPath: string,
  ruleContext: RuleContext,
  progress: number,
  rng: () => number,
  fallback: string
): string {
  const options = getTemplateOptionsForField(fieldPath)
  if (options.length === 0) return fallback

  const weighted = getWeightedOptions(fieldPath, options, ruleContext)
  const withBias = addProgressBias(fieldPath, weighted, progress)
  const top = withBias.slice(0, Math.min(3, withBias.length))
  if (top.length === 0) return fallback

  const total = top.reduce((sum, item) => sum + Math.max(1, item.weight), 0)
  let roll = rng() * total
  for (const item of top) {
    roll -= Math.max(1, item.weight)
    if (roll <= 0) return item.option
  }
  return top[0].option
}

function pickMultiple(
  fieldPath: string,
  count: number,
  ruleContext: RuleContext,
  progress: number,
  rng: () => number
): string[] {
  const options = getTemplateOptionsForField(fieldPath)
  if (options.length === 0) return []
  const weighted = getWeightedOptions(fieldPath, options, ruleContext)
  const withBias = addProgressBias(fieldPath, weighted, progress)
  const shuffledTop = withBias.slice(0, Math.min(8, withBias.length)).sort(() => rng() - 0.5)
  return shuffledTop.slice(0, count).map(x => x.option)
}

export interface TXSequenceResult {
  states: TXVisitState[]
  /** 用于复现的 seed，传回 options.seed 即可得到相同结果 */
  seed: number
}

export function generateTXSequenceStates(
  context: GenerationContext,
  options: TXSequenceOptions
): TXSequenceResult {
  const txCount = Math.max(1, options.txCount)
  const startIdx = options.startVisitIndex || 1
  const remainingTx = txCount - startIdx + 1
  const { rng, seed: actualSeed } = createSeededRng(options.seed)

  const ieStartPain = context.previousIE?.subjective?.painScale?.current ?? 8
  const startPain = options.initialState?.pain ?? ieStartPain
  // 与 goals-calculator 对齐: pain<=3 最优, pain<=6 积极目标, pain>=7 康复曲线
  const stFallback = ieStartPain <= 3
    ? 1
    : ieStartPain <= 6
      ? 2
      : Math.ceil(
        ieStartPain - (ieStartPain - Math.max(2, ieStartPain * 0.25)) * (1 - (1 - 0.55) * (1 - 0.55))
      )
  // CRV-01: chronic-aware ltFallback — higher floor for long treatment courses
  const chronicCapsEnabled = txCount >= 16 && !context.disableChronicCaps
  const chronicEndRatio = chronicCapsEnabled ? 0.55 : 0.25
  const ltFallback = ieStartPain <= 6
    ? 1
    : Math.ceil(Math.max(2, ieStartPain * chronicEndRatio))
  const shortTermTarget = parsePainTarget(
    context.previousIE?.plan?.shortTermGoal?.painScaleTarget,
    stFallback
  )
  const longTermTarget = parsePainTarget(
    context.previousIE?.plan?.longTermGoal?.painScaleTarget,
    ltFallback
  )
  // 续写时: 如果起点已接近短期目标，切换到长期目标
  const targetPain = (startPain - shortTermTarget) < 1.5 ? longTermTarget : shortTermTarget

  // 病史推断: progress 系数 + 初始值修正
  const medHistory = context.medicalHistory || []
  const baseMultiplier = inferProgressMultiplier(medHistory, context.age)
  // CRV-01: chronic-aware dampener — slower progression for long treatment courses
  const chronicDampener = chronicCapsEnabled ? 0.82 : 1.0
  const progressMultiplier = baseMultiplier * chronicDampener
  const medAdjustments = inferInitialAdjustments(medHistory, context.primaryBodyPart)

  let prevPain = startPain
  let prevPainScaleLabel = snapPainToGrid(startPain).label
  let prevProgress = startIdx > 1 ? (startIdx - 1) / txCount : 0
  let prevAdl = 3.5
  let prevFrequency = options.initialState?.frequency ?? 3
  // Tightness/Tenderness/Spasm 初始值: 从 pain 推导 + 病史修正
  const initSeverity = severityFromPain(startPain)
  const severityToInit: Record<string, number> = { 'severe': 4, 'moderate to severe': 3.5, 'moderate': 3, 'mild to moderate': 2, 'mild': 1 }
  const initObjLevel = severityToInit[initSeverity] ?? 3
  let prevTightness = options.initialState?.tightness ?? Math.round(initObjLevel)
  let prevTenderness = options.initialState?.tenderness ?? Math.round(initObjLevel)
  let prevSpasm = Math.min(4, (options.initialState?.spasm ?? Math.round(initObjLevel)) + medAdjustments.spasmBump)
  let prevRomDeficit = Math.min(0.7, 0.42 + medAdjustments.romDeficitBump)
  let prevStrengthDeficit = 0.35
  // 纵向单调约束追踪变量
  let prevSeverity: SeverityLevel = severityFromPain(options.initialState?.pain ?? 8)
  let prevTightnessGrading = options.initialState?.tightnessGrading ?? ''
  let prevTendernessGrade = options.initialState?.tendernessGrade ?? ''
  let prevAssociatedSymptom = options.initialState?.associatedSymptom ?? ''

  const associatedSymptomRank = (symptom: string): number => {
    const s = symptom.toLowerCase()
    if (s.includes('numbness') || s.includes('weakness')) return 4
    if (s.includes('heaviness')) return 3
    if (s.includes('stiffness')) return 2
    if (s.includes('soreness')) return 1
    return 2
  }

  // === generalCondition: 基于病史+年龄+证型的固定属性 ===
  const fixedGeneralCondition: string = (() => {
    if (options.initialState?.generalCondition) return options.initialState.generalCondition
    if (context.baselineCondition) return context.baselineCondition
    // 使用病史推断引擎
    return inferCondition(context.medicalHistory || [], context.age, context.systemicPattern)
  })()

  // === tonguePulse: 从 IE 继承或从 localPattern 推导（与 IE 生成器使用相同的 TONE_MAP 值） ===
  // 舌脉是患者体质的固定属性，TX 访问应与 IE 保持一致
  const PATTERN_TONGUE_DEFAULTS: Record<string, { tongue: string; pulse: string }> = {
    // === 局部证型 ===
    'Qi Stagnation': { tongue: 'thin white coat', pulse: 'string-taut' },
    'Liver Qi Stagnation': { tongue: 'thin white coat', pulse: 'string-taut' },
    'Blood Stasis': { tongue: 'purple', pulse: 'deep' },
    'Qi Stagnation, Blood Stasis': { tongue: 'purple, thin white coat', pulse: 'string-taut' },
    'Blood Deficiency': { tongue: 'pale, thin dry coat', pulse: 'hesitant' },
    'Qi & Blood Deficiency': { tongue: 'pale, thin white coat', pulse: 'thready' },
    'Wind-Cold Invasion': { tongue: 'thin white coat', pulse: 'superficial, tense' },
    'Wind-Cold-Damp Bi': { tongue: 'thin white coat', pulse: 'string-taut' },
    'Cold-Damp + Wind-Cold': { tongue: 'thick, white coat', pulse: 'deep' },
    'LV/GB Damp-Heat': { tongue: 'yellow, sticky (red), thick coat', pulse: 'rolling rapid (forceful)' },
    'Phlegm-Damp': { tongue: 'big tongue with white sticky coat', pulse: 'string-taut' },
    'Phlegm-Heat': { tongue: 'yellow, sticky (red), thick coat', pulse: 'rolling rapid (forceful)' },
    'Damp-Heat': { tongue: 'yellow, sticky (red), thick coat', pulse: 'rolling rapid (forceful)' },
    // === 整体证型 ===
    'Kidney Yang Deficiency': { tongue: 'delicate, white coat', pulse: 'deep' },
    'Kidney Yin Deficiency': { tongue: 'cracked', pulse: 'thready' },
    'Kidney Qi Deficiency': { tongue: 'pale, thin white coat', pulse: 'thready' },
    'Kidney Essence Deficiency': { tongue: 'cracked', pulse: 'thready' },
    'Qi Deficiency': { tongue: 'pale, thin white coat', pulse: 'thready' },
    'Spleen Deficiency': { tongue: 'pale, thin white coat', pulse: 'thready' },
    'Liver Yang Rising': { tongue: 'thin yellow', pulse: 'superficial rapid' },
  }
  const fixedTonguePulse: { tongue: string; pulse: string } = (() => {
    const ieTonguePulse = context.previousIE?.objective?.tonguePulse
    if (ieTonguePulse?.tongue && ieTonguePulse?.pulse) {
      return {
        tongue: ieTonguePulse.tongue,
        pulse: ieTonguePulse.pulse
      }
    }
    // fallback: 从 localPattern 或 systemicPattern 推导，与 IE TONE_MAP 保持一致
    const patternDefault = PATTERN_TONGUE_DEFAULTS[context.localPattern || '']
      || PATTERN_TONGUE_DEFAULTS[context.systemicPattern || '']
    if (patternDefault) return patternDefault
    return {
      tongue: 'Pink with thin white coating',
      pulse: 'Even and moderate'
    }
  })()

  const visits: TXVisitState[] = []
  // V09: 穴位纵向继承 — 首次选定后 100% 复用，保证 Jaccard=1.0
  let fixedNeedlePoints: string[] = options.initialState?.acupoints || []

  for (let i = startIdx; i <= txCount; i++) {
    // progress 基于总疗程进度，而不是当前批次
    const progressLinear = i / txCount
    // S曲线: sqrt 加速早期进度 + smoothstep 平滑过渡
    const acc = Math.sqrt(progressLinear)
    const progressBase = 3 * acc * acc - 2 * acc * acc * acc
    const progressNoise = (rng() - 0.5) * 0.08
    const rawProgress = clamp((progressBase * progressMultiplier) + progressNoise, 0.05, 1.0)
    const progress = Math.max(prevProgress, rawProgress)
    prevProgress = progress

    const objectiveFactors = {
      sessionGapDays: Math.max(1, Math.round(1 + rng() * 7)),
      sleepLoad: Number((rng() * 1.0).toFixed(2)),
      workloadLoad: Number((rng() * 1.0).toFixed(2)),
      weatherExposureLoad: Number((rng() * 1.0).toFixed(2)),
      adherenceLoad: Number((rng() * 1.0).toFixed(2))
    }

    const disruption =
      objectiveFactors.sleepLoad * 0.12 +
      objectiveFactors.workloadLoad * 0.10 +
      objectiveFactors.weatherExposureLoad * 0.10 +
      objectiveFactors.adherenceLoad * 0.12 +
      clamp((objectiveFactors.sessionGapDays - 3) / 10, 0, 0.4)

    const expectedPain = startPain - (startPain - targetPain) * progress
    // Noise cap at 0.15 to prevent erratic pain changes
    const NOISE_CAP = 0.15
    const painNoise = clamp(
      ((rng() - 0.5) * 0.2) + disruption * 0.08,
      -NOISE_CAP,
      NOISE_CAP
    )

    // 统一康复曲线: TX1-TX11 使用同一套逻辑，不强制 TX1 降幅
    // pain 只允许保持或降低（≤ prevPain），允许平稳
    const rawPain = clamp(Math.min(prevPain, expectedPain + painNoise), targetPain, startPain)
    const snapped = snapPainToGrid(rawPain)
    const painScaleCurrent = Math.min(prevPain, snapped.value)

    const painScaleLabel = painScaleCurrent < snapped.value
      ? snapPainToGrid(painScaleCurrent).label
      : snapped.label
    const painDelta = prevPain - painScaleCurrent
    prevPain = painScaleCurrent

    const adlExpected = clamp(prevAdl - (0.18 + rng() * 0.2), 0.8, 4.0)
    const adl = clamp(Math.min(prevAdl, adlExpected + (rng() - 0.5) * 0.12), 0.8, 4.0)
    const adlDelta = prevAdl - adl
    // ADL 改善判定: 先计算再更新 prevAdl
    // 跨过整数等级线 + delta 足够大才视为真正改善
    const prevAdlLevel = Math.ceil(prevAdl)
    const curAdlLevel = Math.ceil(adl)
    const adlLevelChanged = prevAdlLevel > curAdlLevel
    const adlImproved = adlLevelChanged && adlDelta > 0.3
    prevAdl = adl

    // severityLevel: 基于 pain，ADL 改善时最多降 1 档，纵向只降不升
    const baseSeverity = severityFromPain(painScaleCurrent)
    const severityOrder: SeverityLevel[] = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
    let severityLevel = baseSeverity
    if (adlImproved && progress > 0.3) {
      const baseIdx = severityOrder.indexOf(baseSeverity)
      if (baseIdx > 0) {
        severityLevel = severityOrder[baseIdx - 1]
      }
    }
    // 纵向约束: severity 只降不升
    const curSevIdx = severityOrder.indexOf(severityLevel)
    const prevSevIdx = severityOrder.indexOf(prevSeverity)
    if (curSevIdx > prevSevIdx && prevSevIdx >= 0) {
      severityLevel = prevSeverity
    }
    prevSeverity = severityLevel

    // Frequency 改善: 基于 progress 分段确定目标，与 pain 下降联动
    // Constant(3) → Frequent(2) → Occasional(1) → Intermittent(0)
    const frequencyTarget = progress >= 0.80 ? 1 :    // 后期至少 Occasional
      progress >= 0.55 ? 2 :    // 中后期至少 Frequent
        progress >= 0.30 ? 3 : 3  // 早期保持 Constant
    const nextFrequency = Math.min(prevFrequency, Math.max(frequencyTarget, prevFrequency - (rng() > 0.6 ? 1 : 0)))
    const frequencyImproved = nextFrequency < prevFrequency
    prevFrequency = nextFrequency

    // Tightness/Tenderness: 慢于 pain，有随机因子
    // 递减概率随 progress 增加，但比 pain 滞后
    const tightnessGate = progress > 0.40 && rng() > 0.40
    const nextTightness = Math.max(1, prevTightness - (tightnessGate ? 1 : 0))
    const tendernessGate = progress > 0.45 && rng() > 0.45
    // tenderness floor: 不应低于 pain 对应的最小值 (对齐 Checker TX02)
    // 使用 snapPainToGrid 的 label 第一个数字——与 Parser 提取的 pain 值一致
    const snappedForGrade = snapPainToGrid(painScaleCurrent)
    const painInt = parseInt(snappedForGrade.label, 10)
    const tenderFloor = painInt >= 7 ? 3 : painInt >= 5 ? 2 : 1
    const nextTenderness = Math.max(tenderFloor, prevTenderness - (tendernessGate ? 1 : 0))
    const tightnessTrend: 'reduced' | 'slightly reduced' | 'stable' =
      nextTightness < prevTightness ? (prevTightness - nextTightness >= 1 ? 'reduced' : 'slightly reduced') : 'stable'
    const tendernessTrend: 'reduced' | 'slightly reduced' | 'stable' =
      nextTenderness < prevTenderness ? (prevTenderness - nextTenderness >= 1 ? 'reduced' : 'slightly reduced') : 'stable'
    prevTightness = nextTightness
    prevTenderness = nextTenderness

    // Spasm: 基于 progress 分段目标 + rng 随机因子，纵向只降不升
    const spasmTarget = progress >= 0.85 ? 0 : progress >= 0.60 ? 1 : progress >= 0.40 ? 2 : 3
    const spasmGate = rng() > 0.4
    const nextSpasm = Math.min(prevSpasm, spasmGate ? Math.max(spasmTarget, prevSpasm - 1) : prevSpasm)
    const spasmTrend: 'reduced' | 'slightly reduced' | 'stable' =
      nextSpasm < prevSpasm ? 'reduced' : 'stable'
    prevSpasm = nextSpasm

    // ROM/Strength: 独立进度，滞后于 pain，互相联动
    // romProgress 约为 pain progress 的 85%，strength 再滞后 5%
    const romProgress = progress * 0.85
    const strengthProgress = romProgress * 0.95
    const nextRomDeficit = clamp(Math.min(prevRomDeficit, prevRomDeficit - (0.03 + rng() * 0.05) * (romProgress > 0.2 ? 1 : 0.3)), 0.08, 0.6)
    const nextStrengthDeficit = clamp(Math.min(prevStrengthDeficit, prevStrengthDeficit - (0.02 + rng() * 0.04) * (strengthProgress > 0.2 ? 1 : 0.3)), 0.06, 0.6)
    let romTrend: 'improved' | 'slightly improved' | 'stable' =
      nextRomDeficit < prevRomDeficit - 0.055 ? 'improved'
        : nextRomDeficit < prevRomDeficit ? 'slightly improved'
          : 'stable'
    let strengthTrend: 'improved' | 'slightly improved' | 'stable' =
      nextStrengthDeficit < prevStrengthDeficit - 0.045 ? 'improved'
        : nextStrengthDeficit < prevStrengthDeficit ? 'slightly improved'
          : 'stable'

    const plateau =
      (progress > 0.7 && painDelta < 0.2 && adlDelta < 0.12 && !frequencyImproved) ||
      painScaleLabel === prevPainScaleLabel
    if (plateau) {
      if (progress > 0.9) {
        // 后期: 随机保留 ROM 或 strength 其中一个的自然趋势
        if (rng() > 0.5) {
          strengthTrend = 'stable'
        } else {
          romTrend = 'stable'
        }
      } else {
        romTrend = 'stable'
        strengthTrend = 'stable'
      }
    }
    prevPainScaleLabel = painScaleLabel
    prevRomDeficit = nextRomDeficit
    prevStrengthDeficit = nextStrengthDeficit

    const isBilateral = context.laterality === 'bilateral'
    let sideProgress: TXVisitState['sideProgress'] | undefined = undefined
    if (isBilateral) {
      const asym = 0.06 + rng() * 0.12
      const dominantLeft = i % 2 === 0
      const left = clamp(progress + (dominantLeft ? asym : -asym), 0.01, 0.99)
      const right = clamp(progress + (dominantLeft ? -asym : asym), 0.01, 0.99)
      sideProgress = { left, right }
    }

    const ruleContext = buildRuleContext(context, painScaleCurrent, severityLevel)

    // --- Phase 1: 选 symptomChange (用初始 ruleContext) ---
    let symptomChange = pickSingle(
      'subjective.symptomChange',
      ruleContext,
      progress,
      rng,
      'improvement of symptom(s)'
    )

    // --- T02/T03 硬约束守卫: symptomChange 必须与 painDelta 一致 ---
    if (painDelta <= 0) {
      // pain 未降: 不能说 improvement
      if (symptomChange.includes('improvement')) {
        symptomChange = 'similar symptom(s) as last visit'
      }
    } else if (painDelta >= 0.5) {
      // pain 明显下降: 不能说 exacerbate
      if (symptomChange.includes('exacerbate')) {
        symptomChange = 'improvement of symptom(s)'
      }
    }

    // 后期强制改善 — 仅在 painDelta > 0 时生效
    if (progress > 0.7 && painDelta > 0 && !symptomChange.includes('improvement of symptom')) {
      symptomChange = 'improvement of symptom(s)'
    }

    // --- Phase 2: 用实际 symptomChange 重建 ruleContext，选 reason ---
    const reasonRuleContext = {
      ...ruleContext,
      subjective: { ...ruleContext.subjective, symptomChange }
    }
    const reasonConnector = pickSingle(
      'subjective.reasonConnector',
      reasonRuleContext,
      progress,
      rng,
      'because of'
    )
    const reason = pickSingle('subjective.reason', reasonRuleContext, progress, rng, 'energy level improved')

    // --- reason↔symptomChange 一致性硬约束 ---
    const isImprovement = symptomChange.includes('improvement') && !symptomChange.includes('came back')
    const isExacerbate = symptomChange.includes('exacerbate')
    const isSimilar = symptomChange.includes('similar')
    const isCameBack = symptomChange.includes('came back')

    const POSITIVE_REASONS = new Set([
      'can move joint more freely and with less pain',
      'physical activity no longer causes distress',
      'reduced level of pain',
      'reduced joint stiffness and swelling',
      'less difficulty performing daily activities',
      'energy level improved',
      'sleep quality improved',
      'more energy level throughout the day',
    ])
    const NEGATIVE_REASONS = new Set([
      'did not have good rest', 'intense work',
      'excessive time using cell phone', 'excessive time using computer',
      'bad posture', 'carrying/lifting heavy object(s)',
      'lack of exercise', 'exposure to cold air',
      'skipped treatments', 'stopped treatment for a while',
      'discontinuous treatment', 'weak constitution',
    ])

    let finalReason = reason
    let finalConnector = reasonConnector
    if (isImprovement) {
      if (!POSITIVE_REASONS.has(finalReason)) finalReason = 'energy level improved'
      finalConnector = 'because of'
    } else if (isExacerbate) {
      if (!NEGATIVE_REASONS.has(finalReason)) finalReason = 'did not have good rest'
      if (finalConnector !== 'due to' && finalConnector !== 'because of') finalConnector = 'due to'
    } else if (isSimilar) {
      if (POSITIVE_REASONS.has(finalReason)) finalReason = 'maintain regular treatments'
      if (finalConnector !== 'and' && finalConnector !== 'may related of') finalConnector = 'and'
    } else if (isCameBack) {
      if (POSITIVE_REASONS.has(finalReason)) finalReason = 'continuous treatment'
      finalConnector = 'due to'
    }

    // Associated Symptom: 继承用户输入(initialState)，后期逐步减轻
    // 等级: soreness(1) < stiffness(2) < heaviness(3) < weakness/numbness(4)
    const rankToSymptom: Record<number, string> = { 1: 'soreness', 2: 'stiffness', 3: 'heaviness' }
    let associatedSymptom: string
    if (prevAssociatedSymptom) {
      const prevRank = associatedSymptomRank(prevAssociatedSymptom)
      // progress > 0.5 且等级 > 1 时尝试降一级
      if (progress > 0.5 && prevRank > 1 && rng() > 0.5) {
        associatedSymptom = findTemplateOption(
          'subjective.associatedSymptoms',
          [rankToSymptom[prevRank - 1] || 'soreness', prevAssociatedSymptom],
          prevAssociatedSymptom
        )
      } else {
        associatedSymptom = prevAssociatedSymptom
      }
    } else {
      // TX1: 直接用 initialState 传入的值（用户选择）
      associatedSymptom = options.initialState?.associatedSymptom || 'soreness'
    }
    prevAssociatedSymptom = associatedSymptom
    const painFrequency = pickSingle(
      'subjective.painFrequency',
      ruleContext,
      progress,
      rng,
      'Frequent (symptoms occur between 51% and 75% of the time)'
    )
    // generalCondition 是患者基础体质的固定属性，不参与逐次选择
    const generalCondition = fixedGeneralCondition
    const treatmentFocus = pickSingle('assessment.treatmentPrinciples.focusOn', ruleContext, progress, rng, 'focus')

    // --- Tightness grading: S→O 链约束 + 纵向单调约束 ---
    // S→O chain validation: tightness grade correlates with BOTH pain level AND progress
    // (镜像 tenderness 的逻辑 - 遵循 soap-generator 规范)
    // High pain (8-10) -> moderate to severe / severe
    // Moderate pain (5-7) -> moderate / moderate to severe
    // Low pain (0-4) -> mild / mild to moderate / moderate
    const TIGHTNESS_ORDER = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
    let targetTightnessGrade: string
    if (painInt >= 8) {
      // High pain: moderate to severe or severe
      targetTightnessGrade = rng() > 0.4 ? 'Severe' : 'Moderate to severe'
    } else if (painInt >= 5) {
      // Moderate pain: moderate or moderate to severe, with progress influence
      if (progress >= 0.75) {
        targetTightnessGrade = 'Moderate'
      } else if (progress >= 0.45) {
        targetTightnessGrade = rng() > 0.5 ? 'Moderate' : 'Moderate to severe'
      } else {
        targetTightnessGrade = 'Moderate to severe'
      }
    } else {
      // Low pain (0-4): mild, mild to moderate, or moderate
      if (progress >= 0.75) {
        targetTightnessGrade = 'Mild'
      } else if (progress >= 0.45) {
        targetTightnessGrade = rng() > 0.5 ? 'Mild' : 'Mild to moderate'
      } else {
        targetTightnessGrade = 'Mild to moderate'
      }
    }

    let tightnessGrading = targetTightnessGrade
    // 纵向约束: tightnessGrading 不允许比上一次更差
    if (prevTightnessGrading !== '') {
      const prevIdx = TIGHTNESS_ORDER.indexOf(prevTightnessGrading.toLowerCase())
      const curIdx = TIGHTNESS_ORDER.indexOf(tightnessGrading.toLowerCase())
      if (prevIdx >= 0 && curIdx > prevIdx) {
        tightnessGrading = prevTightnessGrading // 强制不回退
      }
    }
    prevTightnessGrading = tightnessGrading

    // --- Tenderness grading: 按身体部位过滤 + 纵向单调约束 ---
    // 修复: SHOULDER 和 KNEE 的 Tenderness 量表不同, 需按身体部位过滤
    const SHOULDER_TENDERNESS_OPTIONS: Record<string, { order: number; text: string }> = {
      '+4': { order: 4, text: '(+4) = Patient complains of severe tenderness, withdraws immediately in response to test pressure, and is unable to bear sustained pressure' },
      '+3': { order: 3, text: '(+3) = Patient complains of considerable tenderness and withdraws momentarily in response to the test pressure' },
      '+2': { order: 2, text: '(+2) = Patient states that the area is moderately tender' },
      '+1': { order: 1, text: '(+1)=Patient states that the area is mildly tender-annoying' }
    }
    const KNEE_TENDERNESS_OPTIONS: Record<string, { order: number; text: string }> = {
      '+4': { order: 4, text: '(+4) = There is severe tenderness and withdrawal response from the patient when there is noxious stimulus' },
      '+3': { order: 3, text: '(+3) = There is severe tenderness with withdrawal' },
      '+2': { order: 2, text: '(+2) = There is mild tenderness with grimace and flinch to moderate palpation' },
      '+1': { order: 1, text: '(+1)= There is mild tenderness to palpation' },
      '0': { order: 0, text: '(0) = No tenderness' }
    }
    const tenderOptions = context.primaryBodyPart === 'KNEE' ? KNEE_TENDERNESS_OPTIONS : SHOULDER_TENDERNESS_OPTIONS

    // S->O chain validation: tenderness grade correlates with BOTH pain level AND progress
    // Use rounded pain to match the integer written to text (Parser reads rounded value)
    // Use painInt from snap (same as what Parser reads from text output)
    const painForGrade = painInt
    // High pain (8-10) -> +3 or +4 tenderness
    // Moderate pain (5-7) -> +2 or +3 tenderness
    // Low pain (0-4) -> +1 or +2 tenderness
    // Progress then modifies within the pain-appropriate range
    let targetTenderGrade: string
    if (painForGrade >= 8) {
      // High pain: always +3 or +4
      targetTenderGrade = rng() > 0.4 ? '+4' : '+3'
    } else if (painForGrade >= 5) {
      // Moderate pain: +2 or +3, with progress influence
      if (progress >= 0.75) {
        targetTenderGrade = '+2'
      } else if (progress >= 0.45) {
        targetTenderGrade = rng() > 0.5 ? '+2' : '+3'
      } else {
        targetTenderGrade = '+3'
      }
    } else {
      // Low pain (0-4): +1 or +2
      if (progress >= 0.75) {
        targetTenderGrade = '+1'
      } else if (progress >= 0.45) {
        targetTenderGrade = rng() > 0.5 ? '+1' : '+2'
      } else {
        targetTenderGrade = '+2'
      }
    }

    let tendernessGrading = tenderOptions[targetTenderGrade]?.text
      || tenderOptions['+2']?.text
      || '(+2) = Patient states that the area is moderately tender'

    // Grade floor: 对齐 Checker TX02 的 expectedTenderMinScaleByPain
    // pain>=7 → 至少 +3, pain>=5 → 至少 +2, else → +1
    const gradeFloor = painForGrade >= 7 ? '+3' : painForGrade >= 5 ? '+2' : '+1'
    const floorOrder = tenderOptions[gradeFloor]?.order ?? 1
    const curGradeOrder = tenderOptions[targetTenderGrade]?.order ?? 2
    if (curGradeOrder < floorOrder) {
      targetTenderGrade = gradeFloor
      tendernessGrading = tenderOptions[gradeFloor]?.text || tendernessGrading
    }

    // 纵向约束: tenderness 不允许比上一次更差 (数字不能变大)
    if (prevTendernessGrade !== '') {
      const prevOrder = tenderOptions[prevTendernessGrade]?.order ?? 3
      const curOrder = tenderOptions[targetTenderGrade]?.order ?? 2
      if (curOrder > prevOrder) {
        // 但也不能低于 floor
        if (prevOrder >= floorOrder) {
          targetTenderGrade = prevTendernessGrade
          tendernessGrading = tenderOptions[prevTendernessGrade]?.text || tendernessGrading
        } else {
          targetTenderGrade = gradeFloor
          tendernessGrading = tenderOptions[gradeFloor]?.text || tendernessGrading
        }
      }
    }
    prevTendernessGrade = targetTenderGrade

    // V09: 穴位纵向继承 — 首次选穴后所有 TX 复用
    if (fixedNeedlePoints.length === 0) {
      fixedNeedlePoints = pickMultiple('plan.needleProtocol.points', 6, ruleContext, progress, rng)
    }
    const needlePoints = fixedNeedlePoints

    const SPASM_TEXTS = [
      '(0)=No spasm',
      '(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.',
      '(+2)=Occasional spontaneous spasms and easily induced spasms.',
      '(+3)=>1 but < 10 spontaneous spasms per hour.',
      '(+4)=>10 spontaneous spasms per hour.'
    ]
    const spasmGrading = SPASM_TEXTS[nextSpasm] || SPASM_TEXTS[3]

    const frequencyByLevel = [
      'Intermittent (symptoms occur less than 25% of the time)',
      'Occasional (symptoms occur between 26% and 50% of the time)',
      'Frequent (symptoms occur between 51% and 75% of the time)',
      'Constant (symptoms occur between 76% and 100% of the time)'
    ]
    const chainFrequency = findTemplateOption(
      'subjective.painFrequency',
      [frequencyByLevel[prevFrequency]],
      painFrequency
    )

    const assessmentFromChain = deriveAssessmentFromSOA({
      painDelta,
      adlDelta,
      frequencyImproved,
      visitIndex: i,
      objectiveTightnessTrend: tightnessTrend,
      objectiveTendernessTrend: tendernessTrend,
      objectiveSpasmTrend: spasmTrend,
      objectiveRomTrend: romTrend,
      objectiveStrengthTrend: strengthTrend
    })

    visits.push({
      visitIndex: i,
      progress,
      painScaleCurrent,
      painScaleLabel,
      severityLevel,
      symptomChange,
      reasonConnector: finalConnector,
      reason: finalReason,
      associatedSymptom,
      painFrequency: chainFrequency,
      generalCondition,
      treatmentFocus,
      tightnessGrading,
      tendernessGrading,
      spasmGrading,
      needlePoints,
      tonguePulse: fixedTonguePulse,
      painTypes: options.initialState?.painTypes,
      inspection: options.initialState?.inspection,
      symptomScale: (() => {
        const raw = options.initialState?.symptomScale || '70%'
        const m = raw.match(/(\d+)/)
        if (!m) return raw
        const base = parseInt(m[1], 10)
        // 用 progress 的平方使早期递减更平缓，避免 IE→TX1 跳变
        const reduction = Math.round(progress * progress * 40)
        const reduced = Math.max(10, base - reduction)
        const snapped = Math.round(reduced / 10) * 10
        return `${snapped}%`
      })(),
      electricalStimulation: options.initialState?.electricalStimulation,
      treatmentTime: options.initialState?.treatmentTime,
      sideProgress,
      objectiveFactors,
      soaChain: {
        subjective: {
          painChange: 'improved',
          adlChange: adlImproved ? 'improved' : 'stable',
          frequencyChange: frequencyImproved ? 'improved' : 'stable'
        },
        objective: {
          tightnessTrend,
          tendernessTrend,
          romTrend,
          strengthTrend
        },
        assessment: assessmentFromChain
      }
    })
  }

  return { states: visits, seed: actualSeed }
}

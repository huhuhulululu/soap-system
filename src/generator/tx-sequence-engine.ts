import type { GenerationContext, SeverityLevel } from '../types'
import { getWeightedOptions, type RuleContext } from '../parser/rule-engine'
import { getTemplateOptionsForField } from '../parser/template-rule-whitelist'

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
      adlChange: 'improved'
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
    const hi = Math.min(10, floor + 1)
    return { value: hi, label: `${hi}-${floor}` }
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
  const whatChanged = input.frequencyImproved
    ? 'pain frequency'
    : input.adlDelta > 0.2
      ? 'difficulty in performing ADLs'
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
  const shortTermTarget = parsePainTarget(
    context.previousIE?.plan?.shortTermGoal?.painScaleTarget,
    Math.max(3, ieStartPain - 2)
  )
  const longTermTarget = parsePainTarget(
    context.previousIE?.plan?.longTermGoal?.painScaleTarget,
    Math.max(2, ieStartPain - 4)
  )
  // 续写时: 如果起点已接近短期目标，切换到长期目标
  const targetPain = (startPain - shortTermTarget) < 1.5 ? longTermTarget : shortTermTarget

  let prevPain = startPain
  let prevPainScaleLabel = snapPainToGrid(startPain).label
  let prevProgress = startIdx > 1 ? (startIdx - 1) / txCount : 0
  let prevAdl = 3.5
  let prevFrequency = options.initialState?.frequency ?? 3
  let prevTightness = options.initialState?.tightness ?? 3
  let prevTenderness = options.initialState?.tenderness ?? 3
  let prevSpasm = options.initialState?.spasm ?? 3
  let prevRomDeficit = 0.42
  let prevStrengthDeficit = 0.35
  // 纵向单调约束追踪变量
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

  // === generalCondition: 基于患者基础体质的固定属性 ===
  // 由年龄、基础病、整体证型决定，不随治疗进度变化
  const fixedGeneralCondition: string = (() => {
    // 1) 优先从 initialState 继承（续写场景）
    if (options.initialState?.generalCondition) return options.initialState.generalCondition
    // 2) 如果用户显式指定了 baselineCondition，直接使用
    if (context.baselineCondition) return context.baselineCondition

    // 3) 根据整体证型 + 慢性程度自动推断
    const sp = (context.systemicPattern || '').toLowerCase()
    const isDeficiency = sp.includes('deficiency') || sp.includes('虚')
    const isYangDeficiency = sp.includes('yang deficiency') || sp.includes('阳虚')
    const isMultiDeficiency = (sp.includes('qi') && sp.includes('blood')) ||
                               sp.includes('essence') || sp.includes('yin deficiency fire')
    const isChronic = context.chronicityLevel === 'Chronic'

    // 严重虚证(肾阳虚/气血两虚/精虚) + 慢性 → poor (老年/体弱)
    if (isChronic && (isYangDeficiency || isMultiDeficiency)) return 'poor'
    // 一般虚证 + 慢性 → fair
    if (isChronic && isDeficiency) return 'fair'
    // 慢性但无虚证 → fair
    if (isChronic) return 'fair'
    // 亚急性 + 虚证 → fair
    if (context.chronicityLevel === 'Sub Acute' && isDeficiency) return 'fair'
    // 其他 → good
    return 'good'
  })()

  // === tonguePulse: 从 IE 继承或使用默认值 ===
  // 舌脉是患者体质的固定属性，TX 访问应与 IE 保持一致
  const fixedTonguePulse: { tongue: string; pulse: string } = (() => {
    const ieTonguePulse = context.previousIE?.objective?.tonguePulse
    if (ieTonguePulse?.tongue && ieTonguePulse?.pulse) {
      return {
        tongue: ieTonguePulse.tongue,
        pulse: ieTonguePulse.pulse
      }
    }
    return {
      tongue: 'Pink with thin white coating',
      pulse: 'Even and moderate'
    }
  })()

  const visits: TXVisitState[] = []

  for (let i = startIdx; i <= txCount; i++) {
    // progress 基于总疗程进度，而不是当前批次
    const progressLinear = i / txCount
    // S曲线: sqrt 加速早期进度 + smoothstep 平滑过渡
    const acc = Math.sqrt(progressLinear)
    const progressBase = 3 * acc * acc - 2 * acc * acc * acc
    const progressNoise = (rng() - 0.5) * 0.08
    const rawProgress = clamp(progressBase + progressNoise, 0.05, 0.98)
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

    // TX1 special handling: ensure pain decreases 0.5-1.5 from IE
    let rawPain: number
    let tx1Decrease: number | null = null
    if (i === startIdx) {
      const minDecrease = 0.5
      const maxDecrease = 1.5
      tx1Decrease = minDecrease + rng() * (maxDecrease - minDecrease)
      rawPain = clamp(startPain - tx1Decrease, targetPain, startPain - minDecrease)
    } else {
      // Improvement-only: never worse than previous visit.
      rawPain = clamp(Math.min(prevPain, expectedPain + painNoise), targetPain, startPain)
    }
    // 吸附到模板整数刻度
    const snapped = snapPainToGrid(rawPain)
    // 纵向约束: 吸附后的值不能比上次高
    let painScaleCurrent = Math.min(prevPain, snapped.value)

    // TX1: ensure final pain respects 0.5-1.5 decrease even after snapping
    if (i === startIdx && tx1Decrease !== null) {
      const minDecrease = 0.5
      const maxDecrease = 1.5
      const targetTx1Pain = startPain - tx1Decrease
      // If snapping pushed it back up, force the decrease
      if (painScaleCurrent > startPain - minDecrease) {
        painScaleCurrent = clamp(targetTx1Pain, targetPain, startPain - minDecrease)
      }
      // If it decreased too much, cap at maxDecrease
      if (painScaleCurrent < startPain - maxDecrease) {
        painScaleCurrent = startPain - maxDecrease
      }
    }

    const painScaleLabel = painScaleCurrent < snapped.value
      ? snapPainToGrid(painScaleCurrent).label
      : snapped.label
    const painDelta = prevPain - painScaleCurrent
    prevPain = painScaleCurrent

    const adlExpected = clamp(prevAdl - (0.18 + rng() * 0.2), 0.8, 4.0)
    const adl = clamp(Math.min(prevAdl, adlExpected + (rng() - 0.5) * 0.12), 0.8, 4.0)
    const adlDelta = prevAdl - adl
    prevAdl = adl
    // ADL 改善判定: 基于等级跳变而非微小数值变化
    // adl 4.0→3.0 = severe→moderate to severe, 3.0→2.0 = moderate, 2.0→1.0 = mild
    // 只有跨过整数等级线才视为真正改善，避免每次微递减都显示 improved
    const prevAdlLevel = Math.ceil(prevAdl)  // 注意: prevAdl 已经更新，用 adl + adlDelta 还原
    const curAdlLevel = Math.ceil(adl)
    const adlLevelChanged = Math.ceil(adl + adlDelta) > curAdlLevel
    const adlImproved = adlLevelChanged && adlDelta > 0.3

    // severityLevel: 综合 pain + ADL 改善
    // 基础由 pain 决定，但当 ADL 显著改善时允许下调一档
    // 确保 A 说 "ADL decreased" 时，S 中的 severity 同步降低
    const baseSeverity = severityFromPain(painScaleCurrent)
    const severityOrder: SeverityLevel[] = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
    let severityLevel = baseSeverity
    if (adlImproved && progress > 0.3) {
      const baseIdx = severityOrder.indexOf(baseSeverity)
      if (baseIdx > 0) {
        // ADL 大幅改善 (delta > 0.3) 降两档，否则降一档
        const drop = adlDelta > 0.3 ? 2 : 1
        severityLevel = severityOrder[Math.max(0, baseIdx - drop)]
      }
    }

    const frequencyImproveGate = progress > 0.55 && rng() > 0.45
    const nextFrequency = frequencyImproveGate ? Math.max(0, prevFrequency - (rng() > 0.5 ? 1 : 0)) : prevFrequency
    const frequencyImproved = nextFrequency < prevFrequency
    prevFrequency = nextFrequency

    const nextTightness = Math.max(1, prevTightness - (progress > 0.55 && rng() > 0.35 ? 1 : 0))
    const nextTenderness = Math.max(1, prevTenderness - (progress > 0.50 && rng() > 0.45 ? 1 : 0))
    const tightnessTrend: 'reduced' | 'slightly reduced' | 'stable' =
      nextTightness < prevTightness ? (prevTightness - nextTightness >= 1 ? 'reduced' : 'slightly reduced') : 'stable'
    const tendernessTrend: 'reduced' | 'slightly reduced' | 'stable' =
      nextTenderness < prevTenderness ? (prevTenderness - nextTenderness >= 1 ? 'reduced' : 'slightly reduced') : 'stable'
    prevTightness = nextTightness
    prevTenderness = nextTenderness

    // Spasm: 基于 progress 确定性递减, 比 tenderness 慢一拍
    const spasmTarget = progress >= 0.85 ? 0 : progress >= 0.60 ? 1 : progress >= 0.40 ? 2 : 3
    const nextSpasm = Math.min(prevSpasm, Math.max(spasmTarget, prevSpasm - 1))
    const spasmTrend: 'reduced' | 'slightly reduced' | 'stable' =
      nextSpasm < prevSpasm ? 'reduced' : 'stable'
    prevSpasm = nextSpasm

    const nextRomDeficit = clamp(Math.min(prevRomDeficit, prevRomDeficit - (0.04 + rng() * 0.06)), 0.08, 0.6)
    const nextStrengthDeficit = clamp(Math.min(prevStrengthDeficit, prevStrengthDeficit - (0.03 + rng() * 0.05)), 0.06, 0.6)
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
      romTrend = 'stable'
      strengthTrend = 'stable'
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

    let symptomChange = pickSingle(
      'subjective.symptomChange',
      ruleContext,
      progress,
      rng,
      'improvement of symptom(s)'
    )
    // 后期 (progress > 0.7) 强制使用改善表述
    if (progress > 0.7 && !symptomChange.includes('improvement of symptom')) {
      symptomChange = 'improvement of symptom(s)'
    }
    const reasonConnector = pickSingle(
      'subjective.reasonConnector',
      ruleContext,
      progress,
      rng,
      'because of'
    )
    const reason = pickSingle('subjective.reason', ruleContext, progress, rng, 'energy level improved')
    let associatedSymptom = pickSingle('subjective.associatedSymptoms', ruleContext, progress, rng, 'soreness')
    if (progress > 0.7) {
      associatedSymptom = findTemplateOption(
        'subjective.associatedSymptoms',
        ['soreness', 'stiffness', associatedSymptom],
        associatedSymptom
      )
    }
    if (prevAssociatedSymptom) {
      const prevRank = associatedSymptomRank(prevAssociatedSymptom)
      const curRank = associatedSymptomRank(associatedSymptom)
      if (curRank > prevRank) {
        associatedSymptom = prevAssociatedSymptom
      }
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
    if (painScaleCurrent >= 8) {
      // High pain: moderate to severe or severe
      targetTightnessGrade = rng() > 0.4 ? 'Severe' : 'Moderate to severe'
    } else if (painScaleCurrent >= 5) {
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
    // High pain (8-10) -> +3 or +4 tenderness
    // Moderate pain (5-7) -> +2 or +3 tenderness
    // Low pain (0-4) -> +1 or +2 tenderness
    // Progress then modifies within the pain-appropriate range
    let targetTenderGrade: string
    if (painScaleCurrent >= 8) {
      // High pain: always +3 or +4
      targetTenderGrade = rng() > 0.4 ? '+4' : '+3'
    } else if (painScaleCurrent >= 5) {
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

    // 纵向约束: tenderness 不允许比上一次更差 (数字不能变大)
    if (prevTendernessGrade !== '') {
      const prevOrder = tenderOptions[prevTendernessGrade]?.order ?? 3
      const curOrder = tenderOptions[targetTenderGrade]?.order ?? 2
      if (curOrder > prevOrder) {
        targetTenderGrade = prevTendernessGrade
        tendernessGrading = tenderOptions[prevTendernessGrade]?.text || tendernessGrading
      }
    }
    prevTendernessGrade = targetTenderGrade

    const needlePoints = pickMultiple('plan.needleProtocol.points', 6, ruleContext, progress, rng)

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
      reasonConnector,
      reason,
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
        const reduced = Math.max(10, base - Math.round(progress * 30))
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

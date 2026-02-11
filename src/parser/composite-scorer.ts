/**
 * 综合评分引擎 - Composite Scorer
 *
 * 整合现有规则引擎的评分逻辑，提供统一的加权计算接口。
 *
 * 分层评分架构:
 * - Level 1: 各维度内部评分 (pain, muscle, ROM, TCM)
 * - Level 2: 维度加权合成 (Assessment 40%, Treatment 35%, Plan 25%)
 *
 * 加权变量池 (friction > 0) 参与综合评分计算：
 * - Pain: 30%
 * - Muscle: 25%
 * - ROM: 20%
 * - TCM: 15%
 * - Patient Risk: 10%
 *
 * @version 1.0.0
 * @date 2026-02-08
 */

import type { RuleContext } from './rule-engine'

// ==================== 枚举与常量 ====================

/**
 * 权重调整策略
 */
export enum WeightAdjustmentStrategy {
  FIXED = 'fixed',
  SEVERITY_BASED = 'severity',
  DATA_DRIVEN = 'data_driven',
  CUSTOM = 'custom'
}

/**
 * 严重程度分级
 */
export type SeverityGrade = 'Mild' | 'Moderate' | 'Severe'

/**
 * 疼痛类型评分映射（基于临床严重程度）
 */
const PAIN_TYPE_SCORES: Readonly<Record<string, number>> = {
  'Shooting': 85,
  'Stabbing': 80,
  'Burning': 75,
  'Freezing': 70,
  'Tingling': 65,
  'pricking': 65,
  'cold': 70,
  'pin & needles': 65,
  'Cramping': 55,
  'Squeezing': 50,
  'Aching': 30,
  'weighty': 30,
  'Dull': 25
}

/**
 * 疼痛频率评分映射
 */
const PAIN_FREQUENCY_SCORES: Readonly<Record<string, number>> = {
  'Constant': 88,
  'Constant (76%-100%)': 88,
  'Frequent': 63,
  'Frequent (51%-75%)': 63,
  'Occasional': 38,
  'Occasional (26%-50%)': 38,
  'Intermittent': 12,
  'Intermittent (<25%)': 12
}

/**
 * 肌肉紧张度评分映射
 */
const TIGHTNESS_SCORES: Readonly<Record<string, number>> = {
  'severe': 90,
  'moderate to severe': 75,
  'moderate': 50,
  'mild to moderate': 35,
  'mild': 20
}

/**
 * 压痛等级评分映射
 */
const TENDERNESS_SCORES: Readonly<Record<string, number>> = {
  '+4': 100,
  '+3': 75,
  '+2': 50,
  '+1': 25
}

/**
 * 痉挛等级评分映射
 */
const SPASM_SCORES: Readonly<Record<string, number>> = {
  '+4': 100,
  '+3': 75,
  '+2': 50,
  '+1': 25,
  '0': 0
}

/**
 * 肌力等级评分映射
 */
const STRENGTH_SCORES: Readonly<Record<string, number>> = {
  '5': 100,
  '4+': 92,
  '4': 83,
  '4-': 75,
  '3+': 67,
  '3': 58,
  '3-': 50,
  '2+': 42,
  '2': 33,
  '2-': 25,
  '1+': 17,
  '1': 8,
  '0': 0
}

/**
 * 局部证型严重度评分
 */
const LOCAL_SYNDROME_SCORES: Readonly<Record<string, number>> = {
  'Blood Stasis': 80,
  'Qi Stagnation, Blood Stasis': 85,
  'Qi Stagnation': 70,
  'Cold-Damp + Wind-Cold': 75,
  'Damp-Heat': 70,
  'LV/GB Damp-Heat': 70,
  'Qi & Blood Deficiency': 65,
  'Phlegm-Damp': 60,
  'Liver Qi Stagnation': 60,
  'Wind-Cold Invasion': 55,
  'Blood Deficiency': 50,
  'Phlegm-Heat': 65
}

/**
 * 全身证型严重度评分
 */
const SYSTEMIC_SYNDROME_SCORES: Readonly<Record<string, number>> = {
  'Kidney Essence Deficiency': 80,
  'Kidney Yang Deficiency': 75,
  'Kidney Yin Deficiency': 70,
  'Kidney Qi Deficiency': 65,
  'LV/GB Fire': 75,
  'Liver Yang Rising': 70,
  'LV/GB Damp-Heat': 70,
  'Yin Deficiency Fire': 70,
  'Qi & Blood Deficiency': 60,
  'Spleen Deficiency': 55,
  'Qi Deficiency': 55,
  'Blood Deficiency': 50
}

// ==================== 接口定义 ====================

/**
 * 权重配置接口
 */
export interface WeightConfig {
  readonly pain: number
  readonly muscle: number
  readonly rom: number
  readonly tcm: number
  readonly patientRisk: number
}

/**
 * 评分分解详情
 */
export interface ScoreBreakdownItem {
  readonly value: string | number
  readonly score: number
  readonly weight: number
  readonly factor?: number
}

/**
 * 评分分解
 */
export interface ScoreBreakdown {
  readonly [key: string]: ScoreBreakdownItem
}

/**
 * 维度评分结果
 */
export interface DimensionScoreResult {
  readonly total: number
  readonly breakdown: ScoreBreakdown
}

/**
 * 综合评分结果
 */
export interface CompositeScoreResult {
  readonly totalScore: number
  readonly severity: SeverityGrade
  readonly confidence: number
  readonly breakdown: {
    readonly [dimension: string]: {
      readonly score: number
      readonly weight: number
      readonly weightedScore: number
      readonly breakdown?: ScoreBreakdown
    }
  }
}

/**
 * 动态权重结果
 */
export interface DynamicWeightResult {
  readonly originalWeights: WeightConfig
  readonly adjustedWeights: WeightConfig
  readonly adjustmentReasons: readonly string[]
  readonly strategy: WeightAdjustmentStrategy
}

/**
 * 交叉评分结果
 */
export interface CrossScoreResult {
  readonly dimensionA: string
  readonly dimensionB: string
  readonly correlation: number
  readonly interactionScore: number
  readonly synergyFactor: number
  readonly description: string
}

/**
 * 增强版综合评分结果
 */
export interface EnhancedCompositeScoreResult {
  readonly baseScore: number
  readonly severity: SeverityGrade
  readonly confidence: number
  readonly breakdown: CompositeScoreResult['breakdown']
  readonly dynamicWeights?: {
    readonly original: WeightConfig
    readonly adjusted: WeightConfig
    readonly reasons: readonly string[]
  }
  readonly adjustedScore?: number
  readonly crossScores?: readonly CrossScoreDisplayItem[]
  readonly crossEffectBonus?: number
  readonly finalScore: number
  readonly finalSeverity: SeverityGrade
}

/**
 * 交叉评分展示项
 */
export interface CrossScoreDisplayItem {
  readonly dimensions: string
  readonly correlation: number
  readonly interactionScore: number
  readonly synergyFactor: number
  readonly description: string
}

/**
 * ROM 活动评估数据
 */
export interface ROMMovementData {
  readonly movement: string
  readonly painLevel: number
  readonly strengthGrade: string
}

/**
 * 疼痛评分输入
 */
export interface PainScoreInput {
  readonly painType?: string
  readonly painScale?: number
  readonly painFrequency?: string
}

/**
 * 肌肉评分输入
 */
export interface MuscleScoreInput {
  readonly tightness?: string
  readonly tenderness?: string
  readonly spasm?: string
}

/**
 * ROM 评分输入
 */
export interface ROMScoreInput {
  readonly painLevel?: number
  readonly strengthGrade?: string
  readonly movements?: readonly ROMMovementData[]
}

/**
 * TCM 评分输入
 */
export interface TCMScoreInput {
  readonly pattern?: string
  readonly localSyndrome?: string
  readonly systemicSyndrome?: string
  readonly tongue?: string
  readonly pulse?: string
  readonly inferenceConfidence?: number
}

/**
 * 患者风险评分输入
 */
export interface PatientRiskInput {
  readonly medicalHistory?: readonly string[]
  readonly age?: number
  readonly hasContraindications?: boolean
}

/**
 * 治疗频率推荐
 */
export interface TreatmentFrequencyRecommendation {
  readonly frequency: string
  readonly duration: string
  readonly sessions: string
  readonly description: string
}

/**
 * 治疗目标
 */
export interface TreatmentGoals {
  readonly pain: {
    readonly current: number
    readonly target: number
    readonly reductionPercent: number
  }
  readonly rom: {
    readonly currentLimitation: number
    readonly targetLimitation: number
    readonly improvementPercent: number
  }
  readonly functional: {
    readonly description: string
  }
}

// ==================== 工具函数 ====================

/**
 * 创建默认权重配置
 */
export function createDefaultWeightConfig(): WeightConfig {
  return {
    pain: 0.30,
    muscle: 0.25,
    rom: 0.20,
    tcm: 0.15,
    patientRisk: 0.10
  }
}

/**
 * 验证权重配置
 */
export function validateWeightConfig(config: WeightConfig): boolean {
  const total = config.pain + config.muscle + config.rom + config.tcm + config.patientRisk
  return Math.abs(total - 1.0) < 0.001
}

/**
 * 从字典创建权重配置
 */
export function createWeightConfigFromPartial(
  partial: Partial<WeightConfig>
): WeightConfig {
  const defaults = createDefaultWeightConfig()
  return {
    pain: partial.pain ?? defaults.pain,
    muscle: partial.muscle ?? defaults.muscle,
    rom: partial.rom ?? defaults.rom,
    tcm: partial.tcm ?? defaults.tcm,
    patientRisk: partial.patientRisk ?? defaults.patientRisk
  }
}

/**
 * 归一化权重配置
 */
function normalizeWeights(weights: WeightConfig): WeightConfig {
  const total = weights.pain + weights.muscle + weights.rom + weights.tcm + weights.patientRisk

  if (Math.abs(total - 1.0) < 0.001) {
    return weights
  }

  return {
    pain: weights.pain / total,
    muscle: weights.muscle / total,
    rom: weights.rom / total,
    tcm: weights.tcm / total,
    patientRisk: weights.patientRisk / total
  }
}

/**
 * 根据疼痛等级获取 ROM 受限因子
 */
function getLimitationFactor(painLevel: number): number {
  if (painLevel <= 3) {
    return 0.85
  } else if (painLevel <= 6) {
    return 0.70
  } else {
    return 0.50
  }
}

/**
 * 分类严重程度
 */
function classifySeverity(score: number): SeverityGrade {
  if (score < 35) {
    return 'Mild'
  } else if (score < 65) {
    return 'Moderate'
  } else {
    return 'Severe'
  }
}

/**
 * 计算两个评分的相关性
 */
function calculateCorrelation(scoreA: number, scoreB: number): number {
  const normA = scoreA / 100
  const normB = scoreB / 100

  const diff = Math.abs(normA - normB)
  const similarity = 1 - diff

  const trendBonus =
    (normA > 0.5 && normB > 0.5) || (normA <= 0.5 && normB <= 0.5)
      ? 0.2
      : -0.1

  const correlation = Math.min(1.0, Math.max(-1.0, similarity + trendBonus - 0.3))
  return Math.round(correlation * 100) / 100
}

/**
 * 计算数据完整性
 */
function getDataCompleteness(
  data: Record<string, unknown> | undefined,
  requiredFields: readonly string[]
): number {
  if (!data) {
    return 0.0
  }

  const filledCount = requiredFields.filter(field => {
    const value = data[field]
    return value !== undefined && value !== null && value !== ''
  }).length

  return requiredFields.length > 0 ? filledCount / requiredFields.length : 0.0
}

// ==================== 综合评分器类 ====================

/**
 * 综合评分器
 *
 * 整合现有规则引擎的评分逻辑，提供统一的加权计算接口。
 * 仅处理加权变量池 (friction > 0)
 */
export class CompositeScorer {
  private readonly weights: WeightConfig

  constructor(weightConfig?: Partial<WeightConfig>) {
    const config = weightConfig
      ? createWeightConfigFromPartial(weightConfig)
      : createDefaultWeightConfig()

    if (!validateWeightConfig(config)) {
      throw new Error('权重配置无效：总和必须为 1.0')
    }

    this.weights = config
  }

  /**
   * 获取当前权重配置
   */
  getWeights(): WeightConfig {
    return { ...this.weights }
  }

  // ==================== Level 1: 各维度评分 ====================

  /**
   * 计算疼痛综合评分
   */
  calculatePainScore(input: PainScoreInput): DimensionScoreResult {
    const painType = input.painType ?? ''
    const painScale = input.painScale ?? 0
    const painFrequency = input.painFrequency ?? ''

    const typeScore = PAIN_TYPE_SCORES[painType] ?? 50
    const scaleScore = Math.min(Math.max(painScale, 0), 10) * 10

    let freqScore = 50
    const freqLower = painFrequency.toLowerCase()
    for (const [key, value] of Object.entries(PAIN_FREQUENCY_SCORES)) {
      if (freqLower.includes(key.toLowerCase())) {
        freqScore = value
        break
      }
    }

    const total = Math.round(typeScore * 0.3 + scaleScore * 0.5 + freqScore * 0.2)

    return {
      total,
      breakdown: {
        type: { value: painType, score: typeScore, weight: 0.3 },
        scale: { value: painScale, score: scaleScore, weight: 0.5 },
        frequency: { value: painFrequency, score: freqScore, weight: 0.2 }
      }
    }
  }

  /**
   * 计算肌肉综合评分
   */
  calculateMuscleScore(input: MuscleScoreInput): DimensionScoreResult {
    const tightness = input.tightness ?? ''
    const tenderness = input.tenderness ?? ''
    const spasm = input.spasm ?? ''

    const tScore = TIGHTNESS_SCORES[tightness.toLowerCase()] ?? 50
    const dScore = TENDERNESS_SCORES[tenderness] ?? 50
    const sScore = SPASM_SCORES[spasm] ?? 25

    const total = Math.round(tScore * 0.4 + dScore * 0.35 + sScore * 0.25)

    return {
      total,
      breakdown: {
        tightness: { value: tightness, score: tScore, weight: 0.4 },
        tenderness: { value: tenderness, score: dScore, weight: 0.35 },
        spasm: { value: spasm, score: sScore, weight: 0.25 }
      }
    }
  }

  /**
   * 计算 ROM 综合评分
   */
  calculateROMScore(input: ROMScoreInput): DimensionScoreResult {
    const painLevel = input.painLevel ?? 0
    const strengthGrade = input.strengthGrade ?? '5'
    const movements = input.movements ?? []

    const limitationFactor = getLimitationFactor(painLevel)
    const limitationScore = Math.round((1 - limitationFactor) * 100)

    const gradeClean = strengthGrade.replace('/5', '').trim()
    const strengthRaw = STRENGTH_SCORES[gradeClean] ?? 50
    const strengthScore = 100 - strengthRaw

    let movementScore = 50
    if (movements.length > 0) {
      const movementScores = movements.map(m => {
        const mPainScore = Math.round((1 - getLimitationFactor(m.painLevel)) * 100)
        const mGradeClean = m.strengthGrade.replace('/5', '').trim()
        const mStrengthRaw = STRENGTH_SCORES[mGradeClean] ?? 50
        const mStrengthScore = 100 - mStrengthRaw
        return mPainScore * 0.6 + mStrengthScore * 0.4
      })
      movementScore = Math.round(
        movementScores.reduce((sum, s) => sum + s, 0) / movementScores.length
      )
    }

    const total = movements.length > 0
      ? Math.round(movementScore * 0.7 + limitationScore * 0.15 + strengthScore * 0.15)
      : Math.round(limitationScore * 0.6 + strengthScore * 0.4)

    return {
      total,
      breakdown: {
        limitation: {
          value: `pain_level=${painLevel}`,
          score: limitationScore,
          weight: movements.length > 0 ? 0.15 : 0.6,
          factor: limitationFactor
        },
        strength: {
          value: strengthGrade,
          score: strengthScore,
          weight: movements.length > 0 ? 0.15 : 0.4
        },
        ...(movements.length > 0 && {
          movements: {
            value: `${movements.length} movements`,
            score: movementScore,
            weight: 0.7
          }
        })
      }
    }
  }

  /**
   * 计算 TCM 综合评分
   */
  calculateTCMScore(input: TCMScoreInput): DimensionScoreResult {
    const localSyndrome = input.localSyndrome ?? input.pattern ?? ''
    const systemicSyndrome = input.systemicSyndrome ?? ''
    const inferenceConfidence = input.inferenceConfidence ?? 0.5
    const tongue = input.tongue ?? ''
    const pulse = input.pulse ?? ''

    const localScore = LOCAL_SYNDROME_SCORES[localSyndrome] ?? 50
    const systemicScore = SYSTEMIC_SYNDROME_SCORES[systemicSyndrome] ?? 50

    let tongueScore = 50
    if (tongue.toLowerCase().includes('purple') || tongue.toLowerCase().includes('dark')) {
      tongueScore = 70
    } else if (tongue.toLowerCase().includes('red')) {
      tongueScore = 60
    } else if (tongue.toLowerCase().includes('pale')) {
      tongueScore = 55
    }

    let pulseScore = 50
    if (pulse.toLowerCase().includes('wiry') || pulse.toLowerCase().includes('choppy')) {
      pulseScore = 70
    } else if (pulse.toLowerCase().includes('slippery')) {
      pulseScore = 60
    } else if (pulse.toLowerCase().includes('weak')) {
      pulseScore = 55
    }

    const rawTotal = Math.round(
      localScore * 0.4 + systemicScore * 0.25 + tongueScore * 0.15 + pulseScore * 0.2
    )
    const total = Math.round(rawTotal * inferenceConfidence)

    return {
      total,
      breakdown: {
        local: { value: localSyndrome, score: localScore, weight: 0.4 },
        systemic: { value: systemicSyndrome, score: systemicScore, weight: 0.25 },
        tongue: { value: tongue, score: tongueScore, weight: 0.15 },
        pulse: { value: pulse, score: pulseScore, weight: 0.2 }
      }
    }
  }

  /**
   * 计算患者风险评分
   */
  calculatePatientRiskScore(input: PatientRiskInput): number {
    const medicalHistory = input.medicalHistory ?? []
    const age = input.age ?? 40
    const hasContraindications = input.hasContraindications ?? false

    let riskScore = 30

    const highRiskConditions = [
      'Pacemaker', 'Heart Disease', 'Diabetes', 'Cancer',
      'Blood Thinner', 'Pregnancy', 'Epilepsy'
    ]

    const mediumRiskConditions = [
      'Hypertension', 'Osteoporosis', 'Arthritis',
      'Previous Surgery', 'Metal Implant'
    ]

    for (const condition of medicalHistory) {
      const conditionLower = condition.toLowerCase()
      if (highRiskConditions.some(c => conditionLower.includes(c.toLowerCase()))) {
        riskScore += 15
      } else if (mediumRiskConditions.some(c => conditionLower.includes(c.toLowerCase()))) {
        riskScore += 8
      }
    }

    if (age >= 70) {
      riskScore += 15
    } else if (age >= 60) {
      riskScore += 10
    } else if (age >= 50) {
      riskScore += 5
    }

    if (hasContraindications) {
      riskScore += 20
    }

    return Math.min(100, riskScore)
  }

  // ==================== Level 2: 综合评分 ====================

  /**
   * 计算综合评分
   */
  calculateCompositeScore(
    painInput?: PainScoreInput,
    muscleInput?: MuscleScoreInput,
    romInput?: ROMScoreInput,
    tcmInput?: TCMScoreInput,
    patientRiskInput?: PatientRiskInput
  ): CompositeScoreResult {
    const painResult = this.calculatePainScore(painInput ?? {})
    const muscleResult = this.calculateMuscleScore(muscleInput ?? {})
    const romResult = this.calculateROMScore(romInput ?? {})
    const tcmResult = this.calculateTCMScore(tcmInput ?? {})
    const patientRiskScore = this.calculatePatientRiskScore(patientRiskInput ?? {})

    const breakdown = {
      pain: {
        score: painResult.total,
        weight: this.weights.pain,
        weightedScore: painResult.total * this.weights.pain,
        breakdown: painResult.breakdown
      },
      muscle: {
        score: muscleResult.total,
        weight: this.weights.muscle,
        weightedScore: muscleResult.total * this.weights.muscle,
        breakdown: muscleResult.breakdown
      },
      rom: {
        score: romResult.total,
        weight: this.weights.rom,
        weightedScore: romResult.total * this.weights.rom,
        breakdown: romResult.breakdown
      },
      tcm: {
        score: tcmResult.total,
        weight: this.weights.tcm,
        weightedScore: tcmResult.total * this.weights.tcm,
        breakdown: tcmResult.breakdown
      },
      patientRisk: {
        score: patientRiskScore,
        weight: this.weights.patientRisk,
        weightedScore: patientRiskScore * this.weights.patientRisk
      }
    }

    const totalScore = Math.round(
      breakdown.pain.weightedScore +
      breakdown.muscle.weightedScore +
      breakdown.rom.weightedScore +
      breakdown.tcm.weightedScore +
      breakdown.patientRisk.weightedScore
    )

    const severity = classifySeverity(totalScore)
    const confidence = this.calculateConfidence(
      painInput,
      muscleInput,
      romInput,
      tcmInput
    )

    return {
      totalScore,
      severity,
      confidence,
      breakdown
    }
  }

  /**
   * 计算评分置信度
   */
  private calculateConfidence(
    painInput?: PainScoreInput,
    muscleInput?: MuscleScoreInput,
    romInput?: ROMScoreInput,
    tcmInput?: TCMScoreInput
  ): number {
    let completeness = 0.0

    if (painInput) {
      if (painInput.painType) completeness += 0.1
      if (painInput.painScale !== undefined) completeness += 0.15
      if (painInput.painFrequency) completeness += 0.05
    }

    if (muscleInput) {
      if (muscleInput.tightness) completeness += 0.1
      if (muscleInput.tenderness) completeness += 0.1
      if (muscleInput.spasm) completeness += 0.05
    }

    if (romInput) {
      if (romInput.painLevel !== undefined) completeness += 0.1
      if (romInput.strengthGrade) completeness += 0.1
    }

    if (tcmInput) {
      if (tcmInput.localSyndrome || tcmInput.pattern) completeness += 0.1
      if (tcmInput.systemicSyndrome) completeness += 0.05
      const tcmConf = tcmInput.inferenceConfidence ?? 0.5
      completeness += 0.1 * tcmConf
    }

    return Math.min(completeness, 1.0)
  }

  // ==================== 动态权重调整 ====================

  /**
   * 计算动态权重
   */
  calculateDynamicWeights(
    painInput?: PainScoreInput,
    muscleInput?: MuscleScoreInput,
    romInput?: ROMScoreInput,
    tcmInput?: TCMScoreInput,
    patientRiskInput?: PatientRiskInput,
    strategy: WeightAdjustmentStrategy = WeightAdjustmentStrategy.SEVERITY_BASED
  ): DynamicWeightResult {
    const original = this.weights
    let adjusted: WeightConfig = { ...original }
    const reasons: string[] = []

    if (strategy === WeightAdjustmentStrategy.FIXED) {
      return {
        originalWeights: original,
        adjustedWeights: adjusted,
        adjustmentReasons: ['使用固定权重'],
        strategy
      }
    }

    if (strategy === WeightAdjustmentStrategy.SEVERITY_BASED) {
      const painScore = this.calculatePainScore(painInput ?? {}).total

      if (painScore >= 70) {
        adjusted = {
          ...adjusted,
          pain: Math.min(0.40, original.pain + 0.10),
          muscle: original.muscle - 0.05,
          tcm: original.tcm - 0.05
        }
        reasons.push(`高疼痛评分(${painScore})，增加疼痛权重`)
      }

      const muscleScore = this.calculateMuscleScore(muscleInput ?? {}).total

      if (muscleScore >= 70) {
        adjusted = {
          ...adjusted,
          muscle: Math.min(0.35, adjusted.muscle + 0.05),
          rom: original.rom - 0.05
        }
        reasons.push(`高肌肉评分(${muscleScore})，增加肌肉权重`)
      }

      if (patientRiskInput?.hasContraindications) {
        adjusted = {
          ...adjusted,
          patientRisk: Math.min(0.20, adjusted.patientRisk + 0.05),
          tcm: adjusted.tcm - 0.05
        }
        reasons.push('存在禁忌症，增加患者风险权重')
      }
    }

    if (strategy === WeightAdjustmentStrategy.DATA_DRIVEN) {
      const completeness = {
        pain: getDataCompleteness(
          painInput as Record<string, unknown>,
          ['painType', 'painScale', 'painFrequency']
        ),
        muscle: getDataCompleteness(
          muscleInput as Record<string, unknown>,
          ['tightness', 'tenderness', 'spasm']
        ),
        rom: getDataCompleteness(
          romInput as Record<string, unknown>,
          ['painLevel', 'strengthGrade']
        ),
        tcm: getDataCompleteness(
          tcmInput as Record<string, unknown>,
          ['localSyndrome', 'systemicSyndrome']
        ),
        patientRisk: patientRiskInput ? 1.0 : 0.5
      }

      const totalCompleteness = Object.values(completeness).reduce((a, b) => a + b, 0)

      if (totalCompleteness > 0) {
        adjusted = {
          pain: completeness.pain / totalCompleteness,
          muscle: completeness.muscle / totalCompleteness,
          rom: completeness.rom / totalCompleteness,
          tcm: completeness.tcm / totalCompleteness,
          patientRisk: completeness.patientRisk / totalCompleteness
        }
        reasons.push('基于数据完整性重新分配权重')
      }
    }

    adjusted = normalizeWeights(adjusted)

    if (!validateWeightConfig(adjusted)) {
      reasons.push('权重归一化')
    }

    return {
      originalWeights: original,
      adjustedWeights: adjusted,
      adjustmentReasons: reasons,
      strategy
    }
  }

  // ==================== 交叉评分 ====================

  /**
   * 计算交叉评分
   */
  calculateCrossScores(
    painInput?: PainScoreInput,
    muscleInput?: MuscleScoreInput,
    romInput?: ROMScoreInput,
    tcmInput?: TCMScoreInput
  ): readonly CrossScoreResult[] {
    const painScore = this.calculatePainScore(painInput ?? {}).total
    const muscleScore = this.calculateMuscleScore(muscleInput ?? {}).total
    const romScore = this.calculateROMScore(romInput ?? {}).total
    const tcmScore = this.calculateTCMScore(tcmInput ?? {}).total

    const results: CrossScoreResult[] = []

    const painMuscleCorr = calculateCorrelation(painScore, muscleScore)
    results.push({
      dimensionA: 'pain',
      dimensionB: 'muscle',
      correlation: painMuscleCorr,
      interactionScore: (painScore + muscleScore) / 2 * (1 + painMuscleCorr * 0.2),
      synergyFactor: 1 + painMuscleCorr * 0.15,
      description: painMuscleCorr > 0.6
        ? '疼痛与肌肉紧张高度相关，协同效应明显'
        : '疼痛与肌肉关联中等'
    })

    const painRomCorr = calculateCorrelation(painScore, romScore)
    results.push({
      dimensionA: 'pain',
      dimensionB: 'rom',
      correlation: painRomCorr,
      interactionScore: (painScore + romScore) / 2 * (1 + painRomCorr * 0.15),
      synergyFactor: 1 + painRomCorr * 0.1,
      description: painRomCorr > 0.5
        ? '疼痛影响活动范围'
        : '疼痛与ROM关联较弱'
    })

    const muscleRomCorr = calculateCorrelation(muscleScore, romScore)
    results.push({
      dimensionA: 'muscle',
      dimensionB: 'rom',
      correlation: muscleRomCorr,
      interactionScore: (muscleScore + romScore) / 2 * (1 + muscleRomCorr * 0.15),
      synergyFactor: 1 + muscleRomCorr * 0.12,
      description: muscleRomCorr > 0.5
        ? '肌肉问题限制活动范围'
        : '肌肉与ROM关联中等'
    })

    const tcmPainCorr = calculateCorrelation(tcmScore, painScore)
    results.push({
      dimensionA: 'tcm',
      dimensionB: 'pain',
      correlation: tcmPainCorr,
      interactionScore: (tcmScore + painScore) / 2 * (1 + tcmPainCorr * 0.1),
      synergyFactor: 1 + tcmPainCorr * 0.08,
      description: tcmPainCorr > 0.4
        ? '证型严重度与疼痛相关'
        : 'TCM与疼痛关联待评估'
    })

    return results
  }

  // ==================== 增强版综合评分 ====================

  /**
   * 计算增强版综合评分
   */
  calculateEnhancedCompositeScore(
    painInput?: PainScoreInput,
    muscleInput?: MuscleScoreInput,
    romInput?: ROMScoreInput,
    tcmInput?: TCMScoreInput,
    patientRiskInput?: PatientRiskInput,
    options: {
      useDynamicWeights?: boolean
      includeCrossScores?: boolean
    } = {}
  ): EnhancedCompositeScoreResult {
    const { useDynamicWeights = true, includeCrossScores = true } = options

    const baseResult = this.calculateCompositeScore(
      painInput,
      muscleInput,
      romInput,
      tcmInput,
      patientRiskInput
    )

    let result: EnhancedCompositeScoreResult = {
      baseScore: baseResult.totalScore,
      severity: baseResult.severity,
      confidence: baseResult.confidence,
      breakdown: baseResult.breakdown,
      finalScore: baseResult.totalScore,
      finalSeverity: baseResult.severity
    }

    if (useDynamicWeights) {
      const dynamicWeights = this.calculateDynamicWeights(
        painInput,
        muscleInput,
        romInput,
        tcmInput,
        patientRiskInput,
        WeightAdjustmentStrategy.SEVERITY_BASED
      )

      const adjustedScore = this.recalculateWithWeights(
        baseResult.breakdown,
        dynamicWeights.adjustedWeights
      )

      result = {
        ...result,
        dynamicWeights: {
          original: dynamicWeights.originalWeights,
          adjusted: dynamicWeights.adjustedWeights,
          reasons: dynamicWeights.adjustmentReasons
        },
        adjustedScore
      }
    }

    if (includeCrossScores) {
      const crossScores = this.calculateCrossScores(
        painInput,
        muscleInput,
        romInput,
        tcmInput
      )

      const crossScoreDisplay: CrossScoreDisplayItem[] = crossScores.map(cs => ({
        dimensions: `${cs.dimensionA}-${cs.dimensionB}`,
        correlation: cs.correlation,
        interactionScore: Math.round(cs.interactionScore * 10) / 10,
        synergyFactor: Math.round(cs.synergyFactor * 100) / 100,
        description: cs.description
      }))

      const avgSynergy = crossScores.reduce((sum, cs) => sum + cs.synergyFactor, 0) / crossScores.length
      const crossEffectBonus = Math.round((avgSynergy - 1) * 100) / 10

      const finalScore = Math.min(
        100,
        Math.round((result.adjustedScore ?? baseResult.totalScore) + crossEffectBonus)
      )

      result = {
        ...result,
        crossScores: crossScoreDisplay,
        crossEffectBonus,
        finalScore,
        finalSeverity: classifySeverity(finalScore)
      }
    } else {
      result = {
        ...result,
        finalScore: result.adjustedScore ?? baseResult.totalScore,
        finalSeverity: classifySeverity(result.adjustedScore ?? baseResult.totalScore)
      }
    }

    return result
  }

  /**
   * 使用新权重重新计算总分
   */
  private recalculateWithWeights(
    breakdown: CompositeScoreResult['breakdown'],
    weights: WeightConfig
  ): number {
    const weightMap: Record<string, keyof WeightConfig> = {
      pain: 'pain',
      muscle: 'muscle',
      rom: 'rom',
      tcm: 'tcm',
      patientRisk: 'patientRisk'
    }

    let total = 0
    for (const [dim, data] of Object.entries(breakdown)) {
      const weightKey = weightMap[dim]
      if (weightKey && weights[weightKey] !== undefined) {
        total += data.score * weights[weightKey]
      }
    }

    return Math.round(total)
  }

  // ==================== 推荐功能 ====================

  /**
   * 根据严重程度推荐治疗频率
   */
  getTreatmentFrequencyRecommendation(severity: SeverityGrade): TreatmentFrequencyRecommendation {
    const recommendations: Record<SeverityGrade, TreatmentFrequencyRecommendation> = {
      'Mild': {
        frequency: '1-2 times per week',
        duration: '4-6 weeks',
        sessions: '6-12 sessions',
        description: '轻度症状，建议每周1-2次治疗'
      },
      'Moderate': {
        frequency: '2-3 times per week',
        duration: '6-8 weeks',
        sessions: '12-18 sessions',
        description: '中度症状，建议每周2-3次治疗'
      },
      'Severe': {
        frequency: '3-4 times per week',
        duration: '8-12 weeks',
        sessions: '18-24 sessions',
        description: '重度症状，建议每周3-4次密集治疗'
      }
    }

    return recommendations[severity]
  }

  /**
   * 根据当前状态生成治疗目标
   */
  getTargetGoals(
    currentPain: number,
    currentRomLimitation: number
  ): TreatmentGoals {
    const painReduction = currentPain >= 7 ? 0.4 : 0.3
    const targetPain = Math.max(0, Math.round(currentPain * (1 - painReduction)))

    const romImprovement = currentRomLimitation > 0.5 ? 0.3 : 0.2
    const targetRom = Math.min(1.0, currentRomLimitation + romImprovement)

    return {
      pain: {
        current: currentPain,
        target: targetPain,
        reductionPercent: Math.round(painReduction * 100)
      },
      rom: {
        currentLimitation: currentRomLimitation,
        targetLimitation: targetRom,
        improvementPercent: Math.round(romImprovement * 100)
      },
      functional: {
        description: `Reduce pain from ${currentPain}/10 to ${targetPain}/10, improve ROM by ${Math.round(romImprovement * 100)}%`
      }
    }
  }

  // ==================== 规则引擎集成 ====================

  /**
   * 从 RuleContext 提取评分输入
   */
  static extractFromRuleContext(context: RuleContext): {
    painInput: PainScoreInput
    muscleInput: MuscleScoreInput
    romInput: ROMScoreInput
    tcmInput: TCMScoreInput
    patientRiskInput: PatientRiskInput
  } {
    const painInput: PainScoreInput = {
      painType: context.subjective?.painTypes?.[0],
      painScale: context.subjective?.painScale?.current,
      painFrequency: undefined
    }

    const muscleInput: MuscleScoreInput = {
      tightness: undefined,
      tenderness: undefined,
      spasm: undefined
    }

    const romInput: ROMScoreInput = {
      painLevel: context.subjective?.painScale?.current,
      strengthGrade: '5',
      movements: []
    }

    const tcmInput: TCMScoreInput = {
      localSyndrome: context.assessment?.localPattern,
      systemicSyndrome: context.assessment?.systemicPattern,
      tongue: context.objective?.tonguePulse?.tongue,
      pulse: context.objective?.tonguePulse?.pulse,
      inferenceConfidence: 0.7
    }

    const patientRiskInput: PatientRiskInput = {
      medicalHistory: context.patient?.medicalHistory,
      age: context.patient?.age,
      hasContraindications: context.patient?.medicalHistory?.some(h =>
        ['pacemaker', 'pregnancy'].includes(h.toLowerCase())
      )
    }

    return {
      painInput,
      muscleInput,
      romInput,
      tcmInput,
      patientRiskInput
    }
  }

  /**
   * 从 RuleContext 计算综合评分
   */
  calculateFromRuleContext(context: RuleContext): CompositeScoreResult {
    const inputs = CompositeScorer.extractFromRuleContext(context)
    return this.calculateCompositeScore(
      inputs.painInput,
      inputs.muscleInput,
      inputs.romInput,
      inputs.tcmInput,
      inputs.patientRiskInput
    )
  }

  /**
   * 从 RuleContext 计算增强版综合评分
   */
  calculateEnhancedFromRuleContext(
    context: RuleContext,
    options?: {
      useDynamicWeights?: boolean
      includeCrossScores?: boolean
    }
  ): EnhancedCompositeScoreResult {
    const inputs = CompositeScorer.extractFromRuleContext(context)
    return this.calculateEnhancedCompositeScore(
      inputs.painInput,
      inputs.muscleInput,
      inputs.romInput,
      inputs.tcmInput,
      inputs.patientRiskInput,
      options
    )
  }
}

// ==================== 导出便捷函数 ====================

/**
 * 创建默认评分器实例
 */
export function createCompositeScorer(
  weightConfig?: Partial<WeightConfig>
): CompositeScorer {
  return new CompositeScorer(weightConfig)
}

/**
 * 快速计算综合评分
 */
export function quickCalculateCompositeScore(
  painInput?: PainScoreInput,
  muscleInput?: MuscleScoreInput,
  romInput?: ROMScoreInput,
  tcmInput?: TCMScoreInput,
  patientRiskInput?: PatientRiskInput
): CompositeScoreResult {
  const scorer = createCompositeScorer()
  return scorer.calculateCompositeScore(
    painInput,
    muscleInput,
    romInput,
    tcmInput,
    patientRiskInput
  )
}

/**
 * 从 RuleContext 快速计算综合评分
 */
export function calculateScoreFromContext(
  context: RuleContext
): CompositeScoreResult {
  const scorer = createCompositeScorer()
  return scorer.calculateFromRuleContext(context)
}

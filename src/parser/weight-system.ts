/**
 * 下拉框选项权重系统
 * 根据上下文动态计算选项权重
 */

import type { TCMPattern } from '../types'
import { TCM_PATTERNS } from '../knowledge/tcm-patterns'

export interface WeightContext {
  bodyPart: string
  localPattern: string
  systemicPattern: string
  chronicityLevel: 'Acute' | 'Sub Acute' | 'Chronic'
  severityLevel: 'mild' | 'mild to moderate' | 'moderate' | 'moderate to severe' | 'severe'
  insuranceType: 'NONE' | 'HF' | 'OPTUM' | 'WC' | 'VC' | 'ELDERPLAN'
  painScale: number
  hasPacemaker?: boolean
}

export interface WeightedOption {
  option: string
  weight: number
  reasons: string[]
}

/**
 * 计算疼痛类型权重
 */
export function weightPainTypes(
  options: string[],
  context: WeightContext
): WeightedOption[] {
  const pattern = TCM_PATTERNS[context.localPattern]

  return options.map(option => {
    let weight = 50 // 基础权重
    const reasons: string[] = []

    // 根据证型调整
    if (pattern) {
      // 血瘀证 -> 刺痛
      if (context.localPattern === 'Blood Stasis' && option === 'Stabbing') {
        weight += 30
        reasons.push('血瘀证常见刺痛')
      }
      // 气滞证 -> 胀痛
      if (context.localPattern === 'Qi Stagnation' && option === 'Aching') {
        weight += 25
        reasons.push('气滞证常见胀痛')
      }
      // 寒证 -> 冷痛
      if ((context.localPattern.includes('Cold') || context.localPattern.includes('Yang Deficiency')) && option === 'Freezing') {
        weight += 30
        reasons.push('寒证常见冷痛')
      }
      // 湿证 -> 重痛
      if (context.localPattern.includes('Damp') && option === 'weighty') {
        weight += 25
        reasons.push('湿证常见重痛')
      }
      // 热证 -> 灼痛
      if (context.localPattern.includes('Heat') && option === 'Burning') {
        weight += 30
        reasons.push('热证常见灼痛')
      }
    }

    // 根据慢性程度调整
    if (context.chronicityLevel === 'Chronic' && option === 'Dull') {
      weight += 15
      reasons.push('慢性疼痛常见钝痛')
    }
    if (context.chronicityLevel === 'Acute' && option === 'Stabbing') {
      weight += 10
      reasons.push('急性疼痛可见刺痛')
    }

    return { option, weight, reasons }
  })
}

/**
 * 计算严重程度权重
 */
export function weightSeverityLevel(
  options: string[],
  context: WeightContext
): WeightedOption[] {
  return options.map(option => {
    let weight = 50
    const reasons: string[] = []

    // 根据疼痛分数调整
    if (context.painScale >= 8) {
      if (option === 'severe' || option === 'moderate to severe') {
        weight += 30
        reasons.push('疼痛评分8+对应严重')
      }
    } else if (context.painScale >= 6) {
      if (option === 'moderate' || option === 'moderate to severe') {
        weight += 25
        reasons.push('疼痛评分6-7对应中度')
      }
    } else if (context.painScale >= 4) {
      if (option === 'moderate' || option === 'mild to moderate') {
        weight += 25
        reasons.push('疼痛评分4-5对应轻中度')
      }
    } else {
      if (option === 'mild' || option === 'mild to moderate') {
        weight += 25
        reasons.push('疼痛评分<4对应轻度')
      }
    }

    // 根据慢性程度调整
    if (context.chronicityLevel === 'Chronic') {
      if (option === 'moderate' || option === 'moderate to severe') {
        weight += 10
        reasons.push('慢性病常见中度以上')
      }
    }

    return { option, weight, reasons }
  })
}

/**
 * 计算治则权重
 */
export function weightTreatmentPrinciples(
  options: string[],
  context: WeightContext
): WeightedOption[] {
  const pattern = TCM_PATTERNS[context.localPattern]

  return options.map(option => {
    let weight = 50
    const reasons: string[] = []

    if (pattern) {
      // 检查治则是否匹配证型
      // 主治则(index 0)权重更高，次要治则递减
      const matchingPrinciples = pattern.treatmentPrinciples
      for (let i = 0; i < matchingPrinciples.length; i++) {
        const principle = matchingPrinciples[i]
        if (option.toLowerCase().includes(principle.toLowerCase())) {
          const boost = i === 0 ? 50 : 30 // 主治则 +50, 次要治则 +30
          weight += boost
          reasons.push(`治则匹配${context.localPattern}证型(优先级${i + 1})`)
          break
        }
      }
    }

    // 特定证型的治则映射
    const principleMap: Record<string, string[]> = {
      'Qi Stagnation': ['moving qi', 'regulates qi'],
      'Blood Stasis': ['activating Blood circulation', 'promote circulation'],
      'Phlegm-Damp': ['drain the dampness'],
      'Damp-Heat': ['clear damp-heat', 'clear heat'],
      'Wind-Cold Invasion': ['dispelling cold', 'expelling pathogens'],
      'Blood Deficiency': ['nourishing blood', 'activate blood'],
      'Qi & Blood Deficiency': ['tonifying qi and blood', 'strengthening muscles']
    }

    const matchedPrinciples = principleMap[context.localPattern] || []
    for (const mp of matchedPrinciples) {
      if (option.toLowerCase().includes(mp.toLowerCase())) {
        weight += 30
        reasons.push(`治则直接匹配${context.localPattern}`)
      }
    }

    return { option, weight, reasons }
  })
}

/**
 * 计算针刺点位权重（根据身体部位）
 */
export function weightAcupoints(
  options: string[],
  context: WeightContext
): WeightedOption[] {
  // 身体部位与常用穴位映射
  const bodyPartPoints: Record<string, string[]> = {
    'LBP': ['BL23', 'BL25', 'BL40', 'DU4', 'GB30', 'BL52', 'BL54', 'YAO JIA JI'],
    'NECK': ['GB20', 'GB21', 'BL10', 'SI3', 'LI4', 'GB39'],
    'SHOULDER': ['LI15', 'SI9', 'SI10', 'SI11', 'SI12', 'GB21', 'JIAN QIAN'],
    'KNEE': ['ST34', 'ST35', 'ST36', 'SP9', 'SP10', 'GB34', 'XI YAN', 'HE DING'],
    'HIP': ['GB29', 'GB30', 'GB31', 'BL54', 'GB34'],
    'ELBOW': ['LI10', 'LI11', 'LI12', 'SI8', 'HT3', 'LU5']
  }

  const preferredPoints = bodyPartPoints[context.bodyPart] || []

  return options.map(option => {
    let weight = 50
    const reasons: string[] = []

    if (preferredPoints.includes(option)) {
      weight += 35
      reasons.push(`${option}是${context.bodyPart}常用穴位`)
    }

    // A SHI POINTS总是加权
    if (option === 'A SHI POINTS') {
      weight += 20
      reasons.push('阿是穴适用于疼痛部位')
    }

    return { option, weight, reasons }
  })
}

/**
 * 计算肌肉选项权重（根据身体部位）
 */
export function weightMuscles(
  options: string[],
  context: WeightContext
): WeightedOption[] {
  // 身体部位与肌肉映射
  const bodyPartMuscles: Record<string, string[]> = {
    'LBP': ['longissimus', 'Iliopsoas Muscle', 'Quadratus Lumborum', 'Gluteal Muscles', 'The Multifidus muscles', 'iliocostalis', 'spinalis'],
    'NECK': ['Scalene anterior / med / posterior', 'Levator Scapulae', 'Trapezius', 'sternocleidomastoid muscles'],
    'SHOULDER': ['Deltoid', 'Supraspinatus', 'Infraspinatus', 'Teres Minor', 'Trapezius', 'Rhomboid'],
    'KNEE': ['Quadriceps', 'Vastus lateralis', 'Vastus medialis', 'Hamstrings', 'Gastrocnemius'],
    'HIP': ['Gluteus Maximus', 'Gluteus Medius', 'Piriformis', 'Iliopsoas', 'TFL'],
    'ELBOW': ['Biceps', 'Triceps', 'Brachioradialis', 'Supinator', 'Pronator']
  }

  const preferredMuscles = bodyPartMuscles[context.bodyPart] || []

  return options.map(option => {
    let weight = 50
    const reasons: string[] = []

    if (preferredMuscles.some(m => option.toLowerCase().includes(m.toLowerCase()))) {
      weight += 40
      reasons.push(`${option}是${context.bodyPart}相关肌肉`)
    }

    return { option, weight, reasons }
  })
}

/**
 * 计算电刺激权重（根据保险和禁忌症）
 */
export function weightElectricalStimulation(
  options: string[],
  context: WeightContext
): WeightedOption[] {
  return options.map(option => {
    let weight = 50
    const reasons: string[] = []

    if (option === 'with') {
      // 有起搏器禁用电刺激
      if (context.hasPacemaker) {
        weight = 0
        reasons.push('起搏器患者禁用电刺激')
      } else {
        // 全代码保险偏好电刺激
        if (!['HF', 'OPTUM'].includes(context.insuranceType)) {
          weight += 20
          reasons.push('全代码保险可用电刺激')
        }
      }
    } else if (option === 'without') {
      if (context.hasPacemaker) {
        weight = 100
        reasons.push('起搏器患者必须无电刺激')
      }
      // 单代码保险偏好无电刺激
      if (['HF', 'OPTUM'].includes(context.insuranceType)) {
        weight += 30
        reasons.push('HF/OPTUM保险使用97810无电刺激')
      }
    }

    return { option, weight, reasons }
  })
}

/**
 * 计算操作时间权重（根据保险类型）
 */
export function weightOperationTime(
  options: string[],
  context: WeightContext
): WeightedOption[] {
  return options.map(option => {
    let weight = 50
    const reasons: string[] = []

    const time = parseInt(option, 10)

    // 根据保险类型调整
    if (['HF', 'OPTUM'].includes(context.insuranceType)) {
      // 单代码保险: 15分钟
      if (time === 15) {
        weight += 50
        reasons.push('HF/OPTUM保险使用15分钟单次')
      }
    } else {
      // 全代码保险: 60分钟
      if (time === 60) {
        weight += 40
        reasons.push('全代码保险使用60分钟完整治疗')
      }
    }

    return { option, weight, reasons }
  })
}

/**
 * 计算 ADL 活动权重（根据身体部位和严重程度）
 */
export function weightAdl(
  options: string[],
  context: WeightContext
): WeightedOption[] {
  // 身体部位相关的高权重 ADL 活动
  const bodyPartAdl: Record<string, string[]> = {
    'LBP': ['Bending over', 'Lifting', 'Standing for long periods', 'Getting out of bed'],
    'NECK': ['Tilting head', 'Turning the head', 'Looking down', 'Driving'],
    'SHOULDER': ['reach top of cabinet', 'put on/take off', 'comb hair', 'household chores'],
    'KNEE': ['Going up and down stairs', 'Rising from a chair', 'Walking for long periods', 'bending knee', 'Standing for long periods'],
    'HIP': ['Walking', 'Getting in/out of car', 'Climbing stairs', 'Sitting for long periods'],
    'ELBOW': ['Lifting objects', 'Carrying bags', 'Typing', 'Opening doors'],
    'WRIST': ['Typing', 'Gripping', 'Writing', 'Opening jars'],
    'ANKLE': ['Walking', 'Going up/down stairs', 'Standing on tiptoes', 'Running']
  }

  const preferredAdl = bodyPartAdl[context.bodyPart] || []

  return options.map(option => {
    let weight = 50
    const reasons: string[] = []

    // 匹配身体部位相关活动
    if (preferredAdl.some(adl => option.toLowerCase().includes(adl.toLowerCase()))) {
      weight += 30
      reasons.push(`${option}是${context.bodyPart}相关ADL`)
    }

    // 严重程度越高，越偏好功能受限大的活动
    if (context.severityLevel === 'severe' || context.severityLevel === 'moderate to severe') {
      if (option.toLowerCase().includes('stair') || option.toLowerCase().includes('rising') || option.toLowerCase().includes('bending')) {
        weight += 10
        reasons.push('严重程度较高，优先受限活动')
      }
    }

    return { option, weight, reasons }
  })
}

/**
 * 根据字段路径选择合适的权重函数
 */
export function calculateWeights(
  fieldPath: string,
  options: string[],
  context: WeightContext
): WeightedOption[] {
  if (fieldPath.includes('painTypes')) {
    return weightPainTypes(options, context)
  }
  if (fieldPath.includes('level') || fieldPath.includes('severity')) {
    return weightSeverityLevel(options, context)
  }
  if (fieldPath.includes('treatmentPrinciples') || fieldPath.includes('focusOn')) {
    return weightTreatmentPrinciples(options, context)
  }
  if (fieldPath.includes('points') || fieldPath.includes('needle')) {
    return weightAcupoints(options, context)
  }
  if (fieldPath.includes('muscle') || fieldPath.includes('tightness')) {
    return weightMuscles(options, context)
  }
  if (fieldPath.includes('adl')) {
    return weightAdl(options, context)
  }
  if (fieldPath.includes('electrical') || options.includes('with') && options.includes('without')) {
    return weightElectricalStimulation(options, context)
  }
  if (options.some(o => ['15', '30', '45', '60'].includes(o))) {
    return weightOperationTime(options, context)
  }

  // 默认权重
  return options.map(option => ({
    option,
    weight: 50,
    reasons: ['默认权重']
  }))
}

/**
 * 选择最高权重选项
 */
export function selectBestOption(weightedOptions: WeightedOption[]): string {
  const sorted = [...weightedOptions].sort((a, b) => b.weight - a.weight)
  return sorted[0]?.option || ''
}

/**
 * 选择多个高权重选项（用于多选下拉框）
 */
export function selectBestOptions(
  weightedOptions: WeightedOption[],
  count: number = 3
): string[] {
  const sorted = [...weightedOptions].sort((a, b) => b.weight - a.weight)
  return sorted.slice(0, count).map(o => o.option)
}

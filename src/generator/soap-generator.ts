/**
 * SOAP 笔记生成器
 * 根据上下文生成完整的 SOAP 笔记
 */

import type {
  SOAPNote,
  NoteType,
  InsuranceType,
  BodyPart,
  GenerationContext,
  Laterality,
  SeverityLevel
} from '../types'
import { TCM_PATTERNS } from '../knowledge/tcm-patterns'
import { calculateWeights, selectBestOption, selectBestOptions, WeightContext, type WeightedOption } from '../parser/weight-system'
import { generateTXSequenceStates, type TXSequenceOptions, type TXVisitState } from './tx-sequence-engine'
import { calculateDynamicGoals } from './goals-calculator'
import {
  BODY_PART_MUSCLES,
  BODY_PART_ADL,
  BODY_PART_ROM,
  romLimitFactor,
  type ROMMovement,
} from '../shared/body-part-constants'

/**
 * 保险类型到针刺模板的映射
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
 * 身体部位显示名称映射
 */
export const BODY_PART_NAMES: Record<BodyPart, string> = {
  'LBP': 'lower back',
  'NECK': 'neck',
  'UPPER_BACK': 'upper back',
  'MIDDLE_BACK': 'middle back',
  'MID_LOW_BACK': 'middle and lower back',
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

const SUPPORTED_IE_BODY_PARTS = new Set<BodyPart>([
  'ELBOW',
  'HIP',
  'KNEE',
  'LBP',
  'MID_LOW_BACK',
  'NECK',
  'SHOULDER'
])

const SUPPORTED_TX_BODY_PARTS = new Set<BodyPart>([
  'ELBOW',
  'KNEE',
  'LBP',
  'MID_LOW_BACK',
  'MIDDLE_BACK',
  'NECK',
  'SHOULDER'
])

function assertTemplateSupported(context: GenerationContext): void {
  const isTX = context.noteType === 'TX'
  const supported = isTX ? SUPPORTED_TX_BODY_PARTS : SUPPORTED_IE_BODY_PARTS
  if (supported.has(context.primaryBodyPart)) return

  const allowed = Array.from(supported).join(', ')
  const mode = isTX ? 'TX' : 'IE'
  throw new Error(
    `Unsupported ${mode} body part "${context.primaryBodyPart}". Allowed: ${allowed}.`
  )
}

/**
 * 侧别显示名称
 */
const LATERALITY_NAMES: Record<Laterality, string> = {
  'left': 'left',
  'right': 'right',
  'bilateral': 'bilateral',
  'unspecified': ''
}

/** @deprecated 使用 BODY_PART_MUSCLES (from body-part-constants) */
export const MUSCLE_MAP = BODY_PART_MUSCLES

/** @deprecated 使用 BODY_PART_ADL (from body-part-constants) */
export const ADL_MAP = BODY_PART_ADL

/**
 * ADL 年龄+性别过滤规则
 * weight: 正数=增权, 负数=降权/排除
 * condition: age/gender 条件
 */
interface ADLDemographicRule {
  adl: string
  weight: number
  condition: { minAge?: number; maxAge?: number; gender?: 'Male' | 'Female' }
}

const ADL_DEMOGRAPHIC_RULES: ADLDemographicRule[] = [
  // 高龄通用
  { adl: 'long hours of driving', weight: -50, condition: { minAge: 65 } },
  { adl: 'working long time in front of computer', weight: -60, condition: { minAge: 65 } },
  { adl: 'Typing', weight: -60, condition: { minAge: 65 } },
  { adl: 'running/jumping/participating in physical exercise', weight: -70, condition: { minAge: 65 } },
  // 高龄增权
  { adl: 'Going up and down stairs', weight: 30, condition: { minAge: 65 } },
  { adl: 'Climbing stairs', weight: 30, condition: { minAge: 65 } },
  { adl: 'Bending over to wear/tie a shoe', weight: 30, condition: { minAge: 65 } },
  { adl: 'bending down put in/out of the shoes', weight: 25, condition: { minAge: 65 } },
  { adl: 'Putting on socks/shoes', weight: 40, condition: { minAge: 65 } },
  { adl: 'Getting in/out of car', weight: 30, condition: { minAge: 65 } },
  { adl: 'Rising from a chair', weight: 20, condition: { minAge: 65 } },
  { adl: 'Looking down watching steps', weight: 40, condition: { minAge: 65 } },
  // 高龄男性
  { adl: 'holding the pot for cooking', weight: -60, condition: { minAge: 65, gender: 'Male' } },
  { adl: 'doing laundry', weight: -50, condition: { minAge: 65, gender: 'Male' } },
  { adl: 'performing household chores', weight: -40, condition: { minAge: 65, gender: 'Male' } },
  // 高龄女性
  { adl: 'Lifting objects', weight: -30, condition: { minAge: 65, gender: 'Female' } },
  { adl: 'reach top of cabinet to get object(s)', weight: 15, condition: { gender: 'Female' } },
  // 年轻人降权
  { adl: 'Rising from a chair', weight: -40, condition: { maxAge: 35 } },
  { adl: 'Getting out of bed', weight: -40, condition: { maxAge: 35 } },
  // 中年增权
  { adl: 'working long time in front of computer', weight: 40, condition: { minAge: 35, maxAge: 65 } },
  { adl: 'long hours of driving', weight: 20, condition: { minAge: 35, maxAge: 65 } },
]

/** 根据年龄+性别调整 ADL 权重 */
export function filterADLByDemographics(
  adlList: string[],
  age?: number,
  gender?: 'Male' | 'Female'
): string[] {
  if (!age && !gender) return adlList
  const weightMap = new Map<string, number>()
  for (const rule of ADL_DEMOGRAPHIC_RULES) {
    const c = rule.condition
    const ageOk = (!c.minAge || (age && age >= c.minAge)) && (!c.maxAge || (age && age <= c.maxAge))
    const genderOk = !c.gender || c.gender === gender
    if (ageOk && genderOk) {
      weightMap.set(rule.adl, (weightMap.get(rule.adl) ?? 0) + rule.weight)
    }
  }
  // 排除权重 <= -50 的 ADL，保留其余并按权重排序
  return adlList
    .filter(adl => (weightMap.get(adl) ?? 0) > -50)
    .sort((a, b) => (weightMap.get(b) ?? 0) - (weightMap.get(a) ?? 0))
}

/**
 * ADL → Muscle 关联映射
 * 当患者报告某 ADL 困难时，优先关注哪些肌肉
 */
export const ADL_MUSCLE_MAP: Record<string, Record<string, string[]>> = {
  'LBP': {
    'Standing for long periods of time': ['Iliopsoas Muscle', 'Quadratus Lumborum'],
    'Walking for long periods of time': ['Gluteal Muscles', 'Iliopsoas Muscle'],
    'Bending over to wear/tie a shoe': ['longissimus', 'The Multifidus muscles'],
    'Rising from a chair': ['Gluteal Muscles', 'Quadratus Lumborum', 'Iliopsoas Muscle'],
    'Getting out of bed': ['The Multifidus muscles', 'iliocostalis'],
    'Going up and down stairs': ['Gluteal Muscles', 'Iliopsoas Muscle'],
    'Lifting objects': ['spinalis', 'longissimus', 'The Multifidus muscles']
  },
  'KNEE': {
    'Going up and down stairs': ['Rectus Femoris', 'Gluteus Maximus', 'Gastronemius muscle'],
    'Rising from a chair': ['Rectus Femoris', 'Gluteus Maximus'],
    'Standing for long periods of time': ['Rectus Femoris', 'Iliotibial Band ITB', 'Gluteus medius / minimus'],
    'Walking for long periods of time': ['Rectus Femoris', 'Hamstrings muscle group', 'Tibialis Post/ Anterior'],
    'Bending over to wear/tie a shoe': ['Hamstrings muscle group', 'Gastronemius muscle'],
    'bending knee to sit position': ['Rectus Femoris', 'Hamstrings muscle group'],
    'bending down put in/out of the shoes': ['Hamstrings muscle group', 'Gastronemius muscle']
  },
  'SHOULDER': {
    'holding the pot for cooking': ['middle deltoid', 'supraspinatus', 'bicep long head'],
    'performing household chores': ['upper trapezius', 'rhomboids'],
    'working long time in front of computer': ['upper trapezius', 'levator scapula', 'rhomboids'],
    'reach top of cabinet to get object(s)': ['supraspinatus', 'middle deltoid', 'upper trapezius'],
    'raising up the hand to comb hair': ['supraspinatus', 'greater tuberosity', 'middle deltoid'],
    'put on/take off the clothes': ['supraspinatus', 'greater tuberosity', 'lesser tuberosity'],
    'pushing/pulling cart, box, door': ['deltoid ant fibres', 'triceps short head', 'bicep long head']
  },
  'NECK': {
    'Sit and watching TV over 20 mins': ['Semispinalis capitis', 'Splenius capitis'],
    'Tilting head to talking the phone': ['Scalene anterior / med / posterior', 'Levator Scapulae'],
    'Turning the head when crossing the street': ['sternocleidomastoid muscles', 'Splenius capitis'],
    'Looking down watching steps': ['Semispinalis capitis', 'Suboccipital muscles'],
    'Driving for long periods': ['Trapezius', 'Levator Scapulae', 'Scalene anterior / med / posterior']
  },
  'HIP': {
    'Walking for long periods': ['Gluteus Maximus', 'Gluteus Medius', 'Iliopsoas'],
    'Sitting for long periods': ['Iliopsoas', 'Piriformis'],
    'Getting in/out of car': ['Iliopsoas', 'Gluteus Maximus', 'Adductors'],
    'Climbing stairs': ['Gluteus Maximus', 'Gluteus Medius', 'TFL'],
    'Putting on socks/shoes': ['Iliopsoas', 'Piriformis', 'Adductors']
  },
  'ELBOW': {
    'Lifting objects': ['Biceps', 'Brachioradialis'],
    'Carrying bags': ['Biceps', 'Brachioradialis'],
    'Opening doors': ['Supinator', 'Pronator teres'],
    'Typing': ['Pronator teres', 'Brachioradialis'],
    'Writing': ['Pronator teres', 'Triceps']
  },
  'MID_LOW_BACK': {
    'Standing for long periods of time': ['Iliopsoas Muscle', 'Quadratus Lumborum'],
    'Walking for long periods of time': ['Gluteal Muscles', 'Iliopsoas Muscle'],
    'Bending over to wear/tie a shoe': ['longissimus', 'The Multifidus muscles'],
    'Rising from a chair': ['Gluteal Muscles', 'Quadratus Lumborum', 'Iliopsoas Muscle'],
    'Getting out of bed': ['The Multifidus muscles', 'iliocostalis'],
    'Going up and down stairs': ['Gluteal Muscles', 'Iliopsoas Muscle'],
    'Lifting objects': ['spinalis', 'longissimus', 'The Multifidus muscles']
  }
}

/**
 * 每个部位的肌肉严重度排序 (受累时影响 ADL 最多的排前面)
 */
export const MUSCLE_SEVERITY_ORDER: Record<string, string[]> = {
  'LBP': ['Gluteal Muscles', 'Iliopsoas Muscle', 'The Multifidus muscles', 'longissimus', 'Quadratus Lumborum', 'spinalis', 'iliocostalis'],
  'NECK': ['Semispinalis capitis', 'Splenius capitis', 'Trapezius', 'Scalene anterior / med / posterior', 'Levator Scapulae', 'sternocleidomastoid muscles', 'Suboccipital muscles'],
  'SHOULDER': ['supraspinatus', 'upper trapezius', 'middle deltoid', 'deltoid ant fibres', 'bicep long head', 'rhomboids', 'levator scapula', 'greater tuberosity', 'lesser tuberosity', 'AC joint', 'triceps short head'],
  'KNEE': ['Rectus Femoris', 'Hamstrings muscle group', 'Gluteus Maximus', 'Gastronemius muscle', 'Gluteus medius / minimus', 'Iliotibial Band ITB', 'Tibialis Post/ Anterior'],
  'HIP': ['Iliopsoas', 'Gluteus Maximus', 'Gluteus Medius', 'Piriformis', 'Adductors', 'TFL'],
  'ELBOW': ['Biceps', 'Brachioradialis', 'Pronator teres', 'Supinator', 'Triceps'],
  'MID_LOW_BACK': ['Gluteal Muscles', 'Iliopsoas Muscle', 'The Multifidus muscles', 'longissimus', 'Quadratus Lumborum', 'spinalis', 'iliocostalis', 'Erector Spinae', 'Latissimus Dorsi', 'Serratus Posterior', 'Rhomboids', 'Middle Trapezius']
}

/**
 * 身体部位对应的加重因素 (来自模板 ppnSelectCombo)
 */
const EXACERBATING_FACTORS_MAP: Record<string, string[]> = {
  'LBP': ['Standing after sitting for long time', 'Prolong walking', 'Bending forward', 'Lifting heavy objects', 'Prolonged sitting'],
  'NECK': ['Looking down at phone/computer', 'Prolonged sitting', 'Sleeping in wrong position', 'Driving for long periods', 'Mental stress'],
  'SHOULDER': ['any strenuous activities', 'repetitive motions', 'push the door', 'extension', 'flexion', 'abduction', 'adduction', 'internal rotation', 'external rotation', 'sleep to the side', 'Lifting heavy objects', 'Overhead activities'],
  'KNEE': ['any strenuous activities', 'repetitive motions', 'poor sleep', 'mental stress', 'extension', 'flexion', 'abduction', 'adduction', 'internal rotation', 'external rotation', 'sleep to the side', 'Standing after sitting for long time', 'Stair climbing', 'Sitting on a low chair', 'Sitting cross leg', 'Prolong walking'],
  'HIP': ['Prolonged sitting', 'Walking', 'Climbing stairs', 'Getting in/out of car', 'Lying on affected side'],
  'ELBOW': ['Gripping objects', 'Twisting motions', 'Lifting', 'Typing', 'Repetitive forearm movements'],
  'WRIST': ['Typing', 'Gripping', 'Twisting motions', 'Lifting', 'Writing for long periods'],
  'ANKLE': ['Walking on uneven surfaces', 'Running', 'Prolonged standing', 'Going up/down stairs'],
  'UPPER_BACK': ['Prolonged sitting', 'Poor posture', 'Carrying heavy bags', 'Deep breathing'],
  'MID_LOW_BACK': ['Standing after sitting for long time', 'Prolong walking', 'Bending forward', 'Lifting heavy objects', 'Prolonged sitting', 'Twisting motions']
}

// ROM_MAP 和 ROMMovement 类型已迁移至 src/shared/body-part-constants.ts
const ROM_MAP = BODY_PART_ROM
type ROMDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

// getLimitationFactor 已迁移至 src/shared/body-part-constants.ts (romLimitFactor)

/**
 * 难度因子 (来自 v9.0)
 * EASY=1.0, MEDIUM=0.9, HARD=0.8
 */
function getDifficultyFactor(difficulty: ROMDifficulty): number {
  const factors: Record<ROMDifficulty, number> = { EASY: 1.0, MEDIUM: 0.9, HARD: 0.8 }
  return factors[difficulty]
}

/**
 * 肌力等级 - 根据 Pain 和 difficulty 计算
 * Pain 高 → Strength 低
 */
function getStrengthByPainAndDifficulty(painLevel: number, difficulty: ROMDifficulty): string {
  // Pain 0-3: 5/5, Pain 4-5: 4+/5, Pain 6-7: 4/5, Pain 8-9: 4-/5, Pain 10: 3+/5
  const baseGrades = ['5/5', '5/5', '5/5', '5/5', '4+/5', '4+/5', '4/5', '4/5', '4-/5', '4-/5', '3+/5']
  const painInt = Math.round(Math.min(painLevel, 10))
  const baseGrade = baseGrades[painInt]

  // HARD difficulty 再降一级
  if (difficulty === 'HARD') {
    const ladder = ['3/5', '3+/5', '4-/5', '4/5', '4+/5', '5/5']
    const idx = ladder.indexOf(baseGrade)
    return idx > 0 ? ladder[idx - 1] : '3/5'
  }
  return baseGrade
}

/**
 * 受限程度分级 (来自 v9.0)
 */
function calculateLimitation(romValue: number, normalRom: number): string {
  if (normalRom <= 0) return 'normal'
  const ratio = romValue / normalRom
  if (ratio >= 0.90) return 'normal'
  if (ratio >= 0.75) return 'mild'
  if (ratio >= 0.50) return 'moderate'
  return 'severe'
}

/**
 * 计算单个运动的 ROM (v9.0 核心公式)
 * ROM = normalDegrees × limitationFactor(pain) × difficultyFactor
 * 然后四舍五入到 5 的倍数
 */
function calculateRomValue(normalDegrees: number, painLevel: number, difficulty: ROMDifficulty): number {
  const limitFactor = romLimitFactor(painLevel)
  const diffFactor = getDifficultyFactor(difficulty)
  const raw = normalDegrees * limitFactor * diffFactor
  return Math.round(raw / 5) * 5  // 四舍五入到 5 的倍数
}

/**
 * 身体部位在模板中的区域名称 (来自模板固定文本)
 */
const BODY_PART_AREA_NAMES: Record<string, string> = {
  'LBP': 'lower back',
  'NECK': 'neck',
  'SHOULDER': 'shoulder area',
  'KNEE': 'Knee area',
  'HIP': 'hip',
  'ELBOW': 'elbow',
  'WRIST': 'wrist',
  'ANKLE': 'ankle',
  'MID_LOW_BACK': 'middle and lower back'
}

/**
 * 关联症状默认值 (来自各模板 ppnSelectCombo)
 */
const ASSOCIATED_SYMPTOMS_MAP: Record<string, string[]> = {
  'SHOULDER': ['soreness'],
  'KNEE': ['soreness', 'heaviness'],
  'DEFAULT': ['soreness', 'stiffness']
}

/**
 * 症状百分比格式 (来自各模板 ppnSelectCombo)
 */
const SYMPTOM_SCALE_MAP: Record<string, string> = {
  'SHOULDER': '70%',
  'KNEE': '70%-80%',
  'DEFAULT': '70%'
}

/**
 * 致因连接词 (来自各模板 ppnSelectComboSingle)
 */
const CAUSATIVE_CONNECTOR_MAP: Record<string, string> = {
  'SHOULDER': 'because of',
  'KNEE': 'due to',
  'DEFAULT': 'due to'
}

/**
 * 疼痛未改善原因 (来自各模板 ppnSelectCombo)
 */
const NOT_IMPROVED_MAP: Record<string, string> = {
  'SHOULDER': 'after a week',
  'KNEE': 'over-the-counter pain medication',
  'DEFAULT': 'after a week'
}

/**
 * Tenderness 评分量表标签 (来自各模板固定文本)
 */
const TENDERNESS_LABEL_MAP: Record<string, string> = {
  'SHOULDER': 'Grading Scale',
  'KNEE': 'Tenderness Scale',
  'DEFAULT': 'Grading Scale'
}

/**
 * Tenderness 固定文本 (SHOULDER: "muscles" 复数, KNEE: "muscle" 单数)
 */
const TENDERNESS_TEXT_MAP: Record<string, string> = {
  'SHOULDER': 'Tenderness muscles noted along',
  'KNEE': 'Tenderness muscle noted along',
  'LBP': 'Tenderness muscle noted along',
  'MID_LOW_BACK': 'Tenderness muscle noted along',
  'DEFAULT': 'Tenderness muscles noted along'
}

/**
 * Tenderness 评分量表内容 (按身体部位，来自各模板 ppnSelectComboSingle)
 */
const TENDERNESS_SCALE_MAP: Record<string, Record<string, string>> = {
  'SHOULDER': {
    '+4': '(+4) = Patient complains of severe tenderness, withdraws immediately in response to test pressure, and is unable to bear sustained pressure',
    '+3': '(+3) = Patient complains of considerable tenderness and withdraws momentarily in response to the test pressure',
    '+2': '(+2) = Patient states that the area is moderately tender',
    '+1': '(+1)=Patient states that the area is mildly tender-annoying'
  },
  'KNEE': {
    '+4': '(+4) = There is severe tenderness and withdrawal response from the patient when there is noxious stimulus',
    '+3': '(+3) = There is severe tenderness with withdrawal',
    '+2': '(+2) = There is mild tenderness with grimace and flinch to moderate palpation',
    '+1': '(+1)= There is mild tenderness to palpation',
    '0': '(0) = No tenderness'
  }
}

/**
 * Inspection 默认值 (来自各模板 ppnSelectCombo)
 */
const INSPECTION_DEFAULT_MAP: Record<string, string> = {
  'SHOULDER': 'weak muscles and dry skin without luster',
  'KNEE': 'joint swelling',
  'DEFAULT': 'weak muscles and dry skin without luster'
}

/**
 * 针刺针号 (来自各 needles 模板)
 */
const NEEDLE_SIZE_MAP: Record<string, string> = {
  'SHOULDER': 'Select Needle Size :36#x0.5" , 34#x1" ,30# x1.5"',
  'KNEE': 'Select Needle Size : 34#x1" ,30# x1.5",30# x2"',
  'LBP': 'Select Needle Size : 34#x1" ,30# x1.5",30# x2",30#x3"',
  'MID_LOW_BACK': 'Select Needle Size : 34#x1" ,30# x1.5",30# x2",30#x3"',
  'NECK': 'Select Needle Size :36#x0.5" , 34#x1" ,30# x1.5"',
  'DEFAULT': 'Select Needle Size: 34#x1", 30# x1.5", 30# x2", 30#x3"'
}

/**
 * 治则动词 (来自各模板 ppnSelectCombo)
 */
const TREATMENT_VERB_MAP: Record<string, string> = {
  'SHOULDER': 'emphasize',
  'KNEE': 'focus',
  'NECK': 'pay attention',
  'LBP': 'promote',
  'MID_LOW_BACK': 'promote',
  'DEFAULT': 'promote'
}

/**
 * 调和目标 (来自各模板 ppnSelectCombo)
 */
const HARMONIZE_MAP: Record<string, string> = {
  'SHOULDER': 'healthy qi and to expel pathogen factor to promote',
  'KNEE': 'Liver and Kidney',
  'DEFAULT': 'yin/yang'
}

/**
 * 治疗目的 (来自各模板 ppnSelectCombo)
 */
const TREATMENT_PURPOSE_MAP: Record<string, string> = {
  'SHOULDER': 'to reduce stagnation and improve circulation',
  'KNEE': 'promote healthy joint and lessen dysfunction in all aspects',
  'DEFAULT': 'promote good essence'
}

/**
 * 舌脉模板映射 (来自 tone/ 文件夹的各模板)
 * 格式统一为: tongue\n[舌象]\npulse\n[脉象]
 */
const TONE_MAP: Record<string, { tongueDefault: string; tongueOptions: string[]; pulseDefault: string; pulseOptions: string[] }> = {
  // === 局部证型 (来自各 tone 模板) ===
  'Qi Stagnation': {
    tongueDefault: 'thin white coat',
    tongueOptions: ['thin white coat', 'purplish dark', 'purple spots', 'dusk'],
    pulseDefault: 'string-taut',
    pulseOptions: ['string-taut']
  },
  'Liver Qi Stagnation': {
    tongueDefault: 'thin white coat',
    tongueOptions: ['thin white coat', 'purplish dark', 'purple spots', 'dusk'],
    pulseDefault: 'string-taut',
    pulseOptions: ['string-taut']
  },
  'Blood Stasis': {
    tongueDefault: 'purple',
    tongueOptions: ['purple', 'purple dark', 'purple edges', 'purple spots on side'],
    pulseDefault: 'deep',
    pulseOptions: ['deep', 'string-taut', 'forceful', 'hesitant']
  },
  'Qi Stagnation, Blood Stasis': {
    tongueDefault: 'purple, thin white coat',
    tongueOptions: ['purple, thin white coat', 'purplish dark', 'purple spots', 'purple edges'],
    pulseDefault: 'string-taut',
    pulseOptions: ['string-taut', 'hesitant', 'deep']
  },
  'Blood Deficiency': {
    tongueDefault: 'pale, thin dry coat',
    tongueOptions: ['pale, thin dry coat'],
    pulseDefault: 'hesitant',
    pulseOptions: ['hesitant', 'thready', 'weak']
  },
  'Qi & Blood Deficiency': {
    tongueDefault: 'pale, thin white coat',
    tongueOptions: ['tooth marks', 'pale, thin white coat'],
    pulseDefault: 'thready',
    pulseOptions: ['thready', 'weak', 'slowing down', 'forceless', 'thin']
  },
  'Wind-Cold Invasion': {
    tongueDefault: 'thin white coat',
    tongueOptions: ['thin white coat'],
    pulseDefault: 'superficial, tense',
    pulseOptions: ['superficial, tense']
  },
  'Wind-Cold-Damp Bi': {
    tongueDefault: 'thin white coat',
    tongueOptions: ['thin white coat', 'white coat'],
    pulseDefault: 'string-taut',
    pulseOptions: ['string-taut', 'superficial, tense', 'wiry']
  },
  'Cold-Damp + Wind-Cold': {
    tongueDefault: 'thick, white coat',
    tongueOptions: ['white coat', 'slippery coat'],
    pulseDefault: 'deep',
    pulseOptions: ['deep', 'tense', 'slow', 'wiry']
  },
  'LV/GB Damp-Heat': {
    tongueDefault: 'yellow, sticky (red), thick coat',
    tongueOptions: ['yellow, sticky (red), thick coat'],
    pulseDefault: 'rolling rapid (forceful)',
    pulseOptions: ['rolling rapid (forceful)', 'rapid', 'overflowing', 'full']
  },
  'Phlegm-Damp': {
    tongueDefault: 'big tongue with white sticky coat',
    tongueOptions: ['big tongue with white sticky coat'],
    pulseDefault: 'string-taut',
    pulseOptions: ['string-taut', 'rolling', 'soft']
  },
  'Phlegm-Heat': {
    tongueDefault: 'yellow, sticky (red), thick coat',
    tongueOptions: ['yellow, sticky (red), thick coat'],
    pulseDefault: 'rolling rapid (forceful)',
    pulseOptions: ['rolling rapid (forceful)', 'rapid', 'overflowing', 'full']
  },
  'Damp-Heat': {
    tongueDefault: 'yellow, sticky (red), thick coat',
    tongueOptions: ['yellow, sticky (red), thick coat'],
    pulseDefault: 'rolling rapid (forceful)',
    pulseOptions: ['rolling rapid (forceful)', 'rapid', 'overflowing', 'full']
  },
  // === 整体证型 (来自各 tone 模板) ===
  'Kidney Yang Deficiency': {
    tongueDefault: 'delicate, white coat',
    tongueOptions: ['delicate', 'pale', 'swollen'],
    pulseDefault: 'deep',
    pulseOptions: ['deep', 'slow', 'weak', 'thready', 'forceless']
  },
  'Kidney Yin Deficiency': {
    tongueDefault: 'cracked',
    tongueOptions: ['cracked', 'rootless', 'red, little coat', 'moisture, furless'],
    pulseDefault: 'thready',
    pulseOptions: ['thready', 'rapid', 'floating-empty']
  },
  'Kidney Qi Deficiency': {
    tongueDefault: 'pale, thin white coat',
    tongueOptions: ['tooth marks', 'pale, thin white coat'],
    pulseDefault: 'thready',
    pulseOptions: ['thready', 'weak', 'slowing down', 'forceless', 'thin']
  },
  'Kidney Essence Deficiency': {
    tongueDefault: 'cracked',
    tongueOptions: ['cracked', 'rootless', 'red, little coat', 'moisture, furless'],
    pulseDefault: 'thready',
    pulseOptions: ['thready', 'rapid', 'floating-empty']
  },
  'Qi Deficiency': {
    tongueDefault: 'pale, thin white coat',
    tongueOptions: ['tooth marks', 'pale, thin white coat'],
    pulseDefault: 'thready',
    pulseOptions: ['thready', 'weak', 'slowing down', 'forceless', 'thin']
  },
  'Spleen Deficiency': {
    tongueDefault: 'pale, thin white coat',
    tongueOptions: ['tooth marks', 'pale, thin white coat'],
    pulseDefault: 'thready',
    pulseOptions: ['thready', 'weak', 'slowing down', 'forceless', 'thin']
  },
  'Liver Yang Rising': {
    tongueDefault: 'thin yellow',
    tongueOptions: ['yellow', 'white'],
    pulseDefault: 'superficial rapid',
    pulseOptions: ['superficial rapid']
  },
  'Yin Deficiency Fire': {
    tongueDefault: 'cracked',
    tongueOptions: ['cracked', 'rootless', 'red, little coat', 'moisture, furless'],
    pulseDefault: 'thready',
    pulseOptions: ['thready', 'rapid', 'floating-empty']
  },
  'LU & KI Deficiency': {
    tongueDefault: 'pale, thin white coat',
    tongueOptions: ['tooth marks', 'pale, thin white coat'],
    pulseDefault: 'thready',
    pulseOptions: ['thready', 'weak', 'slowing down', 'forceless', 'thin']
  }
}

/**
 * 辅助函数：获取配置值，按身体部位查找，回退到 DEFAULT
 */
function getConfig<T>(map: Record<string, T>, bodyPart: string): T {
  return map[bodyPart] ?? map['DEFAULT'] ?? Object.values(map)[0]
}

/**
 * 生成 Subjective 部分
 */
export function generateSubjective(context: GenerationContext): string {
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart]
  const bodyPartAreaName = BODY_PART_AREA_NAMES[context.primaryBodyPart] || bodyPartName
  const laterality = LATERALITY_NAMES[context.laterality]
  const lateralityUpper = laterality.charAt(0).toUpperCase() + laterality.slice(1)
  const pattern = TCM_PATTERNS[context.localPattern]

  // 用户输入值 (带默认回退)
  const painCurrent = context.painCurrent ?? 8
  const durationValue = context.symptomDuration?.value ?? '3'
  const durationUnit = context.symptomDuration?.unit ?? 'month(s)'
  const radiation = context.painRadiation ?? 'without radiation'
  const painWorst = context.painWorst ?? Math.min(10, painCurrent + 1)
  const painBest = context.painBest ?? Math.max(1, painCurrent - 2)
  // 近期加重时长
  const recentWorseValue = context.recentWorse?.value ?? '1'
  const recentWorseUnit = context.recentWorse?.unit ?? 'week(s)'
  const painFrequency = context.painFrequency ?? 'Constant (symptoms occur between 76% and 100% of the time)'
  // 病史文本
  const medHistoryText = (context.medicalHistory && context.medicalHistory.length > 0)
    ? context.medicalHistory.join(', ')
    : 'N/A'
  // 病因和缓解因素: 优先用户选择，回退到部位推导
  const causatives = context.causativeFactors && context.causativeFactors.length > 0
    ? context.causativeFactors
    : ['age related/degenerative changes']
  const relievers = context.relievingFactors && context.relievingFactors.length > 0
    ? context.relievingFactors
    : ['Changing positions', 'Resting', 'Massage']

  // 根据证型选择疼痛类型
  const painTypeOptions = ['Dull', 'Burning', 'Freezing', 'Shooting', 'Tingling', 'Stabbing', 'Aching', 'Squeezing', 'Cramping', 'pricking', 'weighty', 'cold', 'pin & needles']
  const weightContext: WeightContext = {
    bodyPart: context.primaryBodyPart,
    localPattern: context.localPattern,
    systemicPattern: context.systemicPattern,
    chronicityLevel: context.chronicityLevel,
    severityLevel: context.severityLevel,
    insuranceType: context.insuranceType,
    painScale: 7,
    hasPacemaker: context.hasPacemaker
  }

  // Pain Types: 优先使用用户选择，回退到权重系统
  const selectedPainTypes = (context.painTypes && context.painTypes.length > 0)
    ? context.painTypes
    : selectBestOptions(calculateWeights('subjective.painTypes', painTypeOptions, weightContext), 2)

  // 获取身体部位特有配置 — 优先使用用户输入
  const associatedSymptoms = context.associatedSymptom
    ? [context.associatedSymptom]
    : getConfig(ASSOCIATED_SYMPTOMS_MAP, context.primaryBodyPart)
  const symptomScale = context.symptomScale
    ?? getConfig(SYMPTOM_SCALE_MAP, context.primaryBodyPart)
  const causativeConnector = getConfig(CAUSATIVE_CONNECTOR_MAP, context.primaryBodyPart)
  const notImproved = getConfig(NOT_IMPROVED_MAP, context.primaryBodyPart)

  // 生成文本
  const noteType = context.noteType === 'IE' ? 'INITIAL EVALUATION' : 'DAILY NOTE'
  const bp = context.primaryBodyPart

  let subjective = `${noteType}\n\n`

  // 加重/缓解因素 - 根据身体部位选择
  const exacerbatingFactors = (context.exacerbatingFactors && context.exacerbatingFactors.length > 0)
    ? context.exacerbatingFactors
    : (EXACERBATING_FACTORS_MAP[bp] || EXACERBATING_FACTORS_MAP['LBP'])
  const rawAdl = ADL_MAP[bp] || ADL_MAP['LBP']
  const adlActivities = filterADLByDemographics(rawAdl, context.age, context.gender)
  const weightedAdl = calculateWeights('subjective.adl', adlActivities, weightContext)

  if (bp === 'SHOULDER') {
    // ===== SHOULDER 模板句式 =====
    // "Patient c/o [Chronic] [pain types] pain [in right]-shoulder area ([without radiation])
    //  for [10] [year(s)] got worse in recent [1-2] [month(s)]
    //  associated with muscles [soreness] (scale as [70%]) [because of] [causes]."
    const selectedAdl = selectBestOptions(weightedAdl, 4)
    const weightedExac = calculateWeights('subjective.exacerbating', exacerbatingFactors, weightContext)
    const selectedExac = selectBestOptions(weightedExac, 4)

    subjective += `Patient c/o ${context.chronicityLevel} ${selectedPainTypes.join(', ')} pain in ${laterality}`
    subjective += `-${bodyPartAreaName} (${radiation}) `
    subjective += `for ${durationValue} ${durationUnit} got worse in recent ${recentWorseValue} ${recentWorseUnit} `
    subjective += `associated with muscles ${associatedSymptoms.join(', ')} (scale as ${symptomScale}) `
    subjective += `${causativeConnector} ${causatives.join(', ')}.\n`

    // 加重因素 + ADL (同一段)
    // "The pain is [aggravated by] [factors], impaired performing ADL's with [severity] difficulty of [ADL activities]."
    subjective += `The pain is aggravated by ${selectedExac.join(', ')}, `
    subjective += `impaired performing ADL's with ${context.severityLevel} difficulty of ${selectedAdl.join(', ')}. `

    subjective += `${relievers.join(', ')} can temporarily relieve the pain slightly but limited. `

    subjective += `Patient has decrease outside activity, `
    subjective += `the pain did not improved ${notImproved} which promoted the patient to seek acupuncture and oriental medicine intervention.\n\n`

    if (context.secondaryBodyParts && context.secondaryBodyParts.length > 0) {
      const secondaryNames = context.secondaryBodyParts.map(b => BODY_PART_NAMES[b]).join(', ')
      subjective += `Patient also complaints of chronic pain on the ${secondaryNames} area comes and goes, which is less severe compared to the ${lateralityUpper} -${bodyPartAreaName} pain.\n\n`
    }

    subjective += `Pain Scale: Worst: ${painWorst} ; Best: ${painBest} ; Current: ${painCurrent}\n`
    subjective += `Pain Frequency: ${painFrequency}\n`
    subjective += `Walking aid :none\n\n`
    subjective += `Medical history/Contraindication or Precision: ${medHistoryText}`
  } else if (bp === 'NECK') {
    // ===== NECK 模板句式 =====
    // 开头与 KNEE/LBP 类似: "Patient c/o Chronic pain in [location] which is [types] [radiation]."
    // 但 ADL 用 SHOULDER 风格: "difficulty of" + 两组
    subjective += `Patient c/o ${context.chronicityLevel} pain in ${laterality} ${bodyPartAreaName} which is ${selectedPainTypes.join(', ')} ${radiation} . `
    subjective += `The patient has been complaining of the pain for ${durationValue} ${durationUnit} which got worse in recent ${recentWorseValue} ${recentWorseUnit}. `
    subjective += `The pain is associated with muscles ${associatedSymptoms.join(', ')} (scale as ${symptomScale}) ${causativeConnector} ${causatives.join(', ')}.\n`

    const allAdl = selectBestOptions(weightedAdl, 4)
    const neckAdlGroup1 = allAdl.slice(0, 2)
    const neckAdlGroup2 = allAdl.slice(2, 4)
    const weightedExac = calculateWeights('subjective.exacerbating', exacerbatingFactors, weightContext)
    const selectedExac = selectBestOptions(weightedExac, 2)

    subjective += `The pain is aggravated by ${selectedExac.join(', ')}, `
    subjective += `impaired performing ADL's with ${context.severityLevel} difficulty of ${neckAdlGroup1.join(', ')} `
    subjective += `and ${context.severityLevel} difficulty of ${neckAdlGroup2.join(', ')}. `

    subjective += `${relievers.join(', ')} can temporarily relieve the pain slightly but limited. `

    // 活动变化 + 未改善
    subjective += `Patient has decrease outside activity, `
    subjective += `the pain did not improved ${notImproved} which promoted the patient to seek acupuncture and oriental medicine intervention.\n\n`

    // 次要部位 - NECK 比较区域用 "Cervical" 或 "neck and upper back"
    if (context.secondaryBodyParts && context.secondaryBodyParts.length > 0) {
      const secondaryNames = context.secondaryBodyParts.map(b => BODY_PART_NAMES[b]).join(', ')
      subjective += `Patient also complaints of chronic pain on the ${secondaryNames} area comes and goes, which is less severe compared to the Cervical area.\n\n`
    }

    subjective += `Pain Scale: Worst: ${painWorst} ; Best: ${painBest} ; Current: ${painCurrent}\n`
    subjective += `Pain Frequency: ${painFrequency}\n`
    subjective += `Walking aid :none\n\n`
    subjective += `Medical history/Contraindication or Precision: ${medHistoryText}`
  } else {
    // ===== KNEE / LBP / 其他部位模板句式 =====
    // "Patient c/o [Chronic] pain [in bilateral] Knee area which is [Dull, Aching] [without radiation]."
    subjective += `Patient c/o ${context.chronicityLevel} pain in ${laterality} ${bodyPartAreaName} which is ${selectedPainTypes.join(', ')} ${radiation}. `
    subjective += `The patient has been complaining of the pain for ${durationValue} ${durationUnit} which got worse in recent ${recentWorseValue} ${recentWorseUnit}. `
    subjective += `The pain is associated with muscles ${associatedSymptoms.join(', ')} (scale as ${symptomScale}) ${causativeConnector} ${causatives.join(', ')}.\n\n`

    const selectedAdl = selectBestOptions(weightedAdl, 3)
    subjective += `The pain is aggravated by ${exacerbatingFactors.slice(0, 1).join(', ')} . There is ${context.severityLevel} difficulty with ADLs like ${selectedAdl.join(', ')}.\n\n`

    subjective += `${relievers.join(', ')} can temporarily relieve the pain. `
    subjective += `Due to this condition patient has decrease outside activity. `
    subjective += `The pain did not improved ${notImproved} which promoted the patient to seek acupuncture and oriental medicine intervention.\n\n`

    // 次要部位
    if (context.secondaryBodyParts && context.secondaryBodyParts.length > 0) {
      const secondaryNames = context.secondaryBodyParts.map(b => BODY_PART_NAMES[b]).join(', ')
      subjective += `Patient also complaints of chronic pain on the ${secondaryNames} area comes and goes, which is less severe compared to the ${lateralityUpper} ${bodyPartAreaName} pain.\n\n`
    }

    subjective += `Pain Scale: Worst: ${painWorst} ; Best: ${painBest} ; Current: ${painCurrent}\n`
    subjective += `Pain Frequency: ${painFrequency}\n`
    subjective += `Walking aid :none\n\n`
    subjective += `Medical history/Contraindication or Precision: ${medHistoryText}`
  }

  return subjective
}

/**
 * KNEE Flexion 下拉框选项 (来自模板 ppnSelectComboSingle)
 * 注意: 130 和 120 的格式是 "130(normal)" 不含 "Degrees"，其余含 "Degrees"
 */
const KNEE_FLEXION_OPTIONS: Array<{ degrees: number; label: string }> = [
  { degrees: 130, label: '130(normal)' },
  { degrees: 125, label: '125 Degrees(normal)' },
  { degrees: 120, label: '120(normal)' },
  { degrees: 115, label: '115 Degrees(mild)' },
  { degrees: 110, label: '110 Degrees(mild)' },
  { degrees: 105, label: '105 Degrees(mild)' },
  { degrees: 100, label: '100 Degrees(moderate)' },
  { degrees: 95, label: '95 Degrees(moderate)' },
  { degrees: 90, label: '90 Degrees(moderate)' },
  { degrees: 85, label: '85 Degrees(moderate)' },
  { degrees: 80, label: '80 Degrees(moderate)' },
  { degrees: 75, label: '75 Degrees(moderate)' },
  { degrees: 70, label: '70 Degrees(moderate)' },
  { degrees: 65, label: '65 Degrees(severe)' },
  { degrees: 60, label: '60 Degrees(severe)' },
  { degrees: 55, label: '55 Degrees(severe)' },
  { degrees: 50, label: '50 Degrees(severe)' },
  { degrees: 45, label: '45 Degrees(severe)' },
  { degrees: 40, label: '40 Degrees(severe)' },
  { degrees: 35, label: '35 Degrees(severe)' },
  { degrees: 30, label: '30 Degrees(severe)' },
  { degrees: 25, label: '25 Degrees(severe)' }
]

/**
 * KNEE Extension 下拉框选项 (来自模板 ppnSelectComboSingle)
 */
const KNEE_EXTENSION_OPTIONS: Array<{ degrees: number; label: string }> = [
  { degrees: 0, label: '0(normal)' },
  { degrees: -5, label: '-5(severe)' }
]

/**
 * SHOULDER ROM 下拉框选项 (来自 AC-IE SHOULDER.md 模板)
 * 注意: 各运动格式不同:
 *   Abduction/Flexion: "120 degree(moderate)" — 小写 degree, 无空格
 *   Horizontal Adduction: "15 degree (moderate)" — 小写 degree, 有空格
 *   Extension/External/Internal Rotation: "25 Degrees(moderate)" — 大写 Degrees, 无空格
 */
const SHOULDER_ABDUCTION_OPTIONS: Array<{ degrees: number; label: string }> = [
  { degrees: 180, label: '180 degree(normal)' },
  { degrees: 175, label: '175 degree(normal)' },
  { degrees: 170, label: '170 degree(normal)' },
  { degrees: 165, label: '165 degree(mild)' },
  { degrees: 160, label: '160 degree(mild)' },
  { degrees: 155, label: '155 degree(mild)' },
  { degrees: 150, label: '150 degree(mild)' },
  { degrees: 145, label: '145 degree(moderate)' },
  { degrees: 140, label: '140 degree(moderate)' },
  { degrees: 135, label: '135 degree(moderate)' },
  { degrees: 130, label: '130 degree(moderate)' },
  { degrees: 125, label: '125 degree(moderate)' },
  { degrees: 120, label: '120 degree(moderate)' },
  { degrees: 115, label: '115 degree(moderate)' },
  { degrees: 110, label: '110 degree(moderate)' },
  { degrees: 105, label: '105 degree(moderate)' },
  { degrees: 100, label: '100 degree(moderate)' },
  { degrees: 95, label: '95 degree(moderate)' },
  { degrees: 90, label: '90 degree(severe)' },
  { degrees: 85, label: '85 degree(severe)' },
  { degrees: 80, label: '80 degree(severe)' },
  { degrees: 75, label: '75 degree(severe)' },
  { degrees: 70, label: '70 degree(severe)' },
  { degrees: 65, label: '65 degree(severe)' },
  { degrees: 60, label: '60 degree(severe)' },
  { degrees: 55, label: '55 degree(severe)' },
  { degrees: 50, label: '50 degree(severe)' },
  { degrees: 45, label: '45 degree(severe)' },
  { degrees: 40, label: '40 degree(severe)' },
  { degrees: 35, label: '35 degree(severe)' },
  { degrees: 30, label: '30 degree(severe)' },
  { degrees: 25, label: '25 degree(severe)' },
  { degrees: 20, label: '20 degree(severe)' },
  { degrees: 15, label: '15 degree(severe)' },
  { degrees: 10, label: '10 degree(severe)' },
  { degrees: 5, label: '5 degree(severe)' }
]

// Flexion 与 Abduction 使用相同格式
const SHOULDER_FLEXION_OPTIONS = SHOULDER_ABDUCTION_OPTIONS

const SHOULDER_HORIZONTAL_ADDUCTION_OPTIONS: Array<{ degrees: number; label: string }> = [
  { degrees: 45, label: '45 degree (normal)' },
  { degrees: 40, label: '40 degree (normal)' },
  { degrees: 35, label: '35 degree (normal)' },
  { degrees: 30, label: '30 degree (normal)' },
  { degrees: 25, label: '25 degree (mild)' },
  { degrees: 20, label: '20 degree (mild)' },
  { degrees: 15, label: '15 degree (moderate)' },
  { degrees: 10, label: '10 degree (moderate)' },
  { degrees: 5, label: '5 degree (severe)' },
  { degrees: 0, label: 'can not do this at all' }
]

const SHOULDER_EXTENSION_OPTIONS: Array<{ degrees: number; label: string }> = [
  { degrees: 5, label: '5 Degrees(severe)' },
  { degrees: 10, label: '10 Degrees(severe)' },
  { degrees: 15, label: '15 Degrees(severe)' },
  { degrees: 20, label: '20 Degrees(moderate)' },
  { degrees: 25, label: '25 Degrees(moderate)' },
  { degrees: 30, label: '30 Degrees(moderate)' },
  { degrees: 35, label: '35 Degrees(moderate)' },
  { degrees: 40, label: '40 Degrees(mild)' },
  { degrees: 45, label: '45 Degrees(mild)' },
  { degrees: 50, label: '50 Degrees(mild)' },
  { degrees: 55, label: '55 Degrees(normal)' },
  { degrees: 60, label: '60 Degrees(normal)' }
]

const SHOULDER_EXTERNAL_ROTATION_OPTIONS: Array<{ degrees: number; label: string }> = [
  { degrees: 90, label: '90 Degrees(normal)' },
  { degrees: 85, label: '85 Degrees(normal)' },
  { degrees: 80, label: '80 Degrees(normal)' },
  { degrees: 75, label: '75 Degrees(mild)' },
  { degrees: 70, label: '70 Degrees(mild)' },
  { degrees: 65, label: '65 Degrees(mild)' },
  { degrees: 60, label: '60 Degrees(moderate)' },
  { degrees: 55, label: '55 Degrees(moderate)' },
  { degrees: 50, label: '50 Degrees(moderate)' },
  { degrees: 45, label: '45 Degrees(moderate)' },
  { degrees: 40, label: '40 Degrees(moderate)' },
  { degrees: 35, label: '35 Degrees(severe)' },
  { degrees: 30, label: '30 Degrees(severe)' },
  { degrees: 25, label: '25 Degrees(severe)' },
  { degrees: 15, label: '15 Degrees(severe)' },
  { degrees: 10, label: '10 Degrees(severe)' },
  { degrees: 5, label: '5 Degrees(severe)' }
]

// Internal Rotation 与 External Rotation 使用相同选项
const SHOULDER_INTERNAL_ROTATION_OPTIONS = SHOULDER_EXTERNAL_ROTATION_OPTIONS

/**
 * 获取 SHOULDER ROM 的标签 (匹配最近的有效下拉框值)
 */
function getShoulderRomLabel(movement: string, normalDegrees: number, reductionPercent: number): string {
  const reducedDegrees = Math.round(normalDegrees * (1 - reductionPercent))

  let options: Array<{ degrees: number; label: string }>
  if (movement === 'Abduction') {
    options = SHOULDER_ABDUCTION_OPTIONS
  } else if (movement === 'Horizontal Adduction') {
    options = SHOULDER_HORIZONTAL_ADDUCTION_OPTIONS
  } else if (movement === 'Flexion') {
    options = SHOULDER_FLEXION_OPTIONS
  } else if (movement === 'Extension') {
    options = SHOULDER_EXTENSION_OPTIONS
  } else if (movement === 'External Rotation') {
    options = SHOULDER_EXTERNAL_ROTATION_OPTIONS
  } else if (movement === 'Internal Rotation') {
    options = SHOULDER_INTERNAL_ROTATION_OPTIONS
  } else {
    return `${reducedDegrees} degree(moderate)`
  }

  // 找到最接近的有效下拉框值
  let closest = options[0]
  let minDiff = Math.abs(reducedDegrees - closest.degrees)
  for (const opt of options) {
    const diff = Math.abs(reducedDegrees - opt.degrees)
    if (diff < minDiff) {
      minDiff = diff
      closest = opt
    }
  }
  return closest.label
}

/**
 * 获取 KNEE ROM 的标签 (匹配最近的有效下拉框值)
 */
function getKneeRomLabel(rom: { movement: string; normalDegrees: number }, reductionPercent: number): string {
  if (rom.movement.includes('Extension')) {
    // Extension: 只有 0(normal) 和 -5(severe)
    const reduced = Math.round(rom.normalDegrees * (1 - reductionPercent))
    return reduced < 0 ? '-5(severe)' : '0(normal)'
  }

  // Flexion: 匹配最近的有效下拉框值
  const reducedDegrees = Math.round(rom.normalDegrees * (1 - reductionPercent))
  // 找到最接近的5的倍数选项
  let closest = KNEE_FLEXION_OPTIONS[0]
  let minDiff = Math.abs(reducedDegrees - closest.degrees)
  for (const opt of KNEE_FLEXION_OPTIONS) {
    const diff = Math.abs(reducedDegrees - opt.degrees)
    if (diff < minDiff) {
      minDiff = diff
      closest = opt
    }
  }
  return closest.label
}

/**
 * 生成 Objective 部分 (使用全局 MUSCLE_MAP 和 ROM_MAP)
 * KNEE 模板段落顺序: Muscles Testing → ROM(左右分别) → Inspection
 * SHOULDER 模板段落顺序: Inspection → Muscles Testing → ROM
 */
export function generateObjective(context: GenerationContext, visitState?: TXVisitState): string {
  const pattern = TCM_PATTERNS[context.localPattern]
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart]
  const laterality = LATERALITY_NAMES[context.laterality]
  const bp = context.primaryBodyPart
  const effectiveSeverity = visitState?.severityLevel || context.severityLevel

  // 使用全局 MUSCLE_MAP
  const muscles = MUSCLE_MAP[bp] || ['local muscles']

  // 获取身体部位特有配置
  const tenderLabel = getConfig(TENDERNESS_LABEL_MAP, bp)
  const tenderText = getConfig(TENDERNESS_TEXT_MAP, bp)
  const tenderScales = TENDERNESS_SCALE_MAP[bp] || TENDERNESS_SCALE_MAP['SHOULDER']
  const inspectionDefault = getConfig(INSPECTION_DEFAULT_MAP, bp)

  let objective = ''

  // SHOULDER: Inspection 在前 (模板: "Inspection:" 紧接下拉框值，无空格)
  // KNEE: Inspection 在后
  if (bp === 'SHOULDER') {
    objective += `Inspection:${visitState?.inspection ?? inspectionDefault}\n\n`
  }

  // Muscles Testing (纯文本输出，不加 markdown 粗体标记)
  objective += `Muscles Testing:\n`
  // Tightness 肌肉由权重系统从模板下拉框有效选项中选择
  const tightnessWeightContext: WeightContext = {
    bodyPart: bp,
    localPattern: context.localPattern,
    systemicPattern: context.systemicPattern,
    chronicityLevel: context.chronicityLevel,
    severityLevel: effectiveSeverity,
    insuranceType: context.insuranceType,
    painScale: 7,
    hasPacemaker: context.hasPacemaker
  }
  const weightedTightness = calculateWeights('objective.tightness', muscles, tightnessWeightContext)
  const selectedTightness = selectBestOptions(weightedTightness, 3)
  objective += `Tightness muscles noted along ${selectedTightness.join(', ')}\n`
  objective += `Grading Scale: ${visitState?.tightnessGrading || effectiveSeverity}\n\n`

  // 肌肉分配: Tenderness 和 Spasm 使用不同于 Tightness 的肌肉子集
  // 长列表(>=8): 用固定切片 (SHOULDER/KNEE)
  // 中等列表(=7): LBP/NECK 交错分配避免 100% 重叠
  // 短列表(<7): 智能分配
  const tenderMuscles = muscles.length >= 8
    ? muscles.slice(7, 12)
    : muscles.length >= 4
      ? muscles.slice(Math.floor(muscles.length / 2))
      : muscles.slice(1)
  const spasmMuscles = muscles.length >= 8
    ? muscles.slice(3, 7)
    : muscles.length === 7
      // LBP/NECK (7肌肉): 交错取 [1,2,5,6] — 与 tender[3,4,5,6] 仅 2 个重叠
      ? muscles.slice(1, 3).concat(muscles.slice(5))
      : muscles.length >= 4
        ? muscles.slice(Math.floor(muscles.length / 3), Math.floor(muscles.length * 2 / 3) + 1)
        : muscles.slice(0, 2)

  objective += `${tenderText} ${tenderMuscles.join(', ')}\n\n`
  // Tenderness: TX 用 visitState, IE 根据 severity 选择等级
  const severityToTender: Record<string, string> = {
    'severe': '+4', 'moderate to severe': '+3', 'moderate': '+3', 'mild to moderate': '+2', 'mild': '+1'
  }
  const ieTenderGrade = severityToTender[effectiveSeverity] || '+3'
  objective += `${tenderLabel}: ${visitState?.tendernessGrading || tenderScales[ieTenderGrade] || tenderScales['+3']}.\n\n`

  objective += `Muscles spasm noted along ${spasmMuscles.join(', ')}\n`
  objective += `Frequency Grading Scale:${visitState?.spasmGrading || '(+3)=>1 but < 10 spontaneous spasms per hour.'}\n\n`

  // ==================== ROM评估 (v9.0 引擎) ====================
  const romData = ROM_MAP[bp]
  const isSpine = bp === 'NECK' || bp === 'LBP' || bp === 'MIDDLE_BACK' || bp === 'UPPER_BACK' || bp === 'MID_LOW_BACK'
  const romType = isSpine ? 'Spine ROM' : 'Joint ROM'

  // v9.0: 用 pain level 驱动 (整数), 而非 severity 字符串
  // IE 用 severity 推断 pain, TX 用 visitState.painScaleCurrent
  // TX 模式: effectivePainForRom 比实际 pain 更低, 模拟"功能恢复快于疼痛消退"
  const basePain: number = visitState?.painScaleCurrent ??
    ({ 'severe': 9, 'moderate to severe': 8, 'moderate': 6, 'mild to moderate': 5, 'mild': 3 }[effectiveSeverity] || 7)
  const painLevel: number = visitState
    ? Math.max(
      1,
      basePain
      - (visitState.progress * 2.8)
    )
    : basePain

  const bumpStrength = (strength: string, step: number): string => {
    const ladder = ['3/5', '3+/5', '4-/5', '4/5', '4+/5', '5/5']
    const idx = ladder.indexOf(strength)
    if (idx < 0) return strength
    // 最高只能提升到 4+/5，不能到 5/5（除非原本就是 5/5）
    const maxIdx = strength === '5/5' ? 5 : 4
    return ladder[Math.max(0, Math.min(maxIdx, idx + step))]
  }

  /**
   * v9.0 确定性双侧不对齐:
   * - Left: 使用 painLevel 直接计算
   * - Right: painLevel - 1 (比左侧轻一档) + ROM +5度
   * - 每个运动有 variation_seed [-1, 0, 1] 微扰
   */
  const computeRom = (rom: ROMMovement, index: number, sideOffset: number, adjustedPain: number, romAdjustment: number) => {
    // variation seed: 确定性微扰 (来自 v9.0)
    const variationSeed = (index + sideOffset) % 3
    const painVariation = [-1, 0, 1][variationSeed]
    const effectivePain = Math.max(1, Math.min(10, adjustedPain + painVariation))

    // Strength 根据 Pain 计算
    let strength = getStrengthByPainAndDifficulty(effectivePain, rom.difficulty)
    if (visitState) {
      const step = visitState.progress > 0.7 ? 2 : visitState.progress > 0.45 ? 1 : 0
      strength = bumpStrength(strength, step)
    }
    let romValue = calculateRomValue(rom.normalDegrees, effectivePain, rom.difficulty)

    // 右侧/纵向 ROM 微调
    if (romAdjustment !== 0 && rom.normalDegrees > 0) {
      romValue = Math.max(Math.round(rom.normalDegrees * 0.25), Math.min(rom.normalDegrees, romValue + romAdjustment))
      romValue = Math.round(romValue / 5) * 5
    }

    const limitation = calculateLimitation(romValue, rom.normalDegrees)
    return { strength, romValue, limitation }
  }

  if (bp === 'KNEE' && laterality === 'bilateral') {
    // KNEE 双侧
    const sides = ['Right', 'Left'] as const
    sides.forEach(side => {
      const adjustedPain = side === 'Left' ? painLevel : Math.max(1, painLevel - 1)
      const sideOffset = side === 'Left' ? 0 : 1
      const romAdj = side === 'Left' ? 0 : 5
      objective += `${side} Knee Muscles Strength and Joint ROM:\n\n`
      if (romData) {
        romData.forEach((rom, i) => {
          const { strength, romValue, limitation } = computeRom(rom, i, sideOffset, adjustedPain, romAdj)
          // KNEE ROM 吸附到下拉框选项
          const reductionPct = rom.normalDegrees > 0 ? 1 - (romValue / rom.normalDegrees) : 0
          objective += `${strength} ${rom.movement}: ${getKneeRomLabel(rom, reductionPct)}\n`
        })
      }
      objective += `\n`
    })
  } else if (bp === 'KNEE') {
    // KNEE 单侧
    const sideLabel = laterality === 'left' ? 'Left' : 'Right'
    objective += `${sideLabel} Knee Muscles Strength and Joint ROM:\n\n`
    if (romData) {
      romData.forEach((rom, i) => {
        const { strength } = computeRom(rom, i, 0, painLevel, 0)
        const reductionPct = rom.normalDegrees > 0 ? 1 - (calculateRomValue(rom.normalDegrees, painLevel, rom.difficulty) / rom.normalDegrees) : 0
        objective += `${strength} ${rom.movement}: ${getKneeRomLabel(rom, reductionPct)}\n`
      })
    }
    objective += `\n`
  } else if (bp === 'SHOULDER') {
    // SHOULDER: 模板格式精确匹配 + v9.0 计算引擎
    const renderShoulderRom = (side: string) => {
      const isLeft = side === 'Left'
      const adjustedPain = isLeft ? painLevel : Math.max(1, painLevel - 1)
      const sideOffset = isLeft ? 0 : 1
      const romAdj = isLeft ? 0 : 5
      objective += `${side} Shoulder Muscles Strength and Joint ROM\n`
      if (romData) {
        romData.forEach((rom, i) => {
          const { strength, romValue, limitation } = computeRom(rom, i, sideOffset, adjustedPain, romAdj)
          const reductionPct = rom.normalDegrees > 0 ? 1 - (romValue / rom.normalDegrees) : 0
          const label = getShoulderRomLabel(rom.movement, rom.normalDegrees, reductionPct)
          // 模板精确格式
          let movementLabel: string
          if (rom.movement === 'Abduction') {
            movementLabel = `${strength} Abduction:`
          } else if (rom.movement === 'Horizontal Adduction') {
            movementLabel = `${strength} Horizontal Adduction: `
          } else if (rom.movement === 'Flexion') {
            movementLabel = `${strength} Flexion :`
          } else if (rom.movement === 'Extension') {
            movementLabel = `${strength} Extension : `
          } else if (rom.movement === 'External Rotation') {
            movementLabel = `${strength} External rotation : `
          } else if (rom.movement === 'Internal Rotation') {
            movementLabel = `${strength} Internal rotation : `
          } else {
            movementLabel = `${strength} ${rom.movement}: `
          }
          objective += `${movementLabel}${label}\n`
        })
      }
      objective += `\n`
    }

    if (laterality === 'bilateral') {
      renderShoulderRom('Right')
      renderShoulderRom('Left')
    } else {
      renderShoulderRom(laterality === 'left' ? 'Left' : 'Right')
    }
  } else {
    // LBP / NECK / 其他部位
    const romLabel = bp === 'NECK' ? 'Cervical' :
      bp === 'LBP' ? 'Lumbar' :
        bp === 'MID_LOW_BACK' ? 'Thoracolumbar' :
        `${laterality ? laterality.charAt(0).toUpperCase() + laterality.slice(1) + ' ' : ''}${bodyPartName.charAt(0).toUpperCase() + bodyPartName.slice(1)}`
    const romSuffix = bp === 'NECK' ? ' Assessment:' : ''
    objective += `${romLabel} Muscles Strength and ${romType}${romSuffix}\n`

    if (romData) {
      const degreeLabel = isSpine ? 'Degrees' : 'degree'
      const romAdj = visitState ? Math.min(10, Math.round((visitState.progress * 8) + (visitState.soaChain.objective.romTrend === 'improved' ? 3 : 1))) : 0
      romData.forEach((rom, index) => {
        const { strength, romValue, limitation } = computeRom(rom, index, 0, painLevel, romAdj)
        objective += `${strength} ${rom.movement}: ${romValue} ${degreeLabel}(${limitation})\n`
      })
    }
    objective += `\n`
  }

  // Inspection 在 ROM 之后 (SHOULDER 已在前面输出, 其余部位在此输出)
  if (bp !== 'SHOULDER') {
    objective += `Inspection: ${visitState?.inspection ?? inspectionDefault}\n\n`
  }

  // 舌脉信息 (来自 tone/ 模板, 始终在 Objective 最底部)
  // 格式: tongue\n[舌象]\npulse\n[脉象]
  const toneData = TONE_MAP[context.localPattern] || TONE_MAP[context.systemicPattern || '']
  if (toneData) {
    const tongue = visitState?.tonguePulse?.tongue ?? toneData.tongueDefault
    const pulse = visitState?.tonguePulse?.pulse ?? toneData.pulseDefault
    objective += `tongue\n${tongue}\npulse\n${pulse}`
  }

  return objective
}

/**
 * 生成 Assessment 部分
 * KNEE 模板格式:
 *   TCM Dx:
 *   [bilateral] knee pain due to [Cold-Damp + Wind-Cold] in local meridian,
 *   but patient also has [Kidney Yang Deficiency] in the general.
 *   Today's TCM treatment principles:
 *   [focus] on [warm channels, dispel cold and damp, promote circulation] and harmonize [Liver and Kidney] balance in order to [promote healthy joint and lessen dysfunction in all aspects].
 *   Acupuncture Eval was done today on bilateral knee .
 */
export function generateAssessment(context: GenerationContext): string {
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart]
  const bp = context.primaryBodyPart
  const localPattern = TCM_PATTERNS[context.localPattern]
  const systemicPattern = TCM_PATTERNS[context.systemicPattern]
  const laterality = LATERALITY_NAMES[context.laterality]

  // KNEE 模板: "[Bilateral] knee pain" (大写侧别 + 部位 + pain)
  // SHOULDER 模板: "Bilateral - shoulder area pain due to..." (大写侧别 + 连字符 + area)
  const lateralityUpper = laterality.charAt(0).toUpperCase() + laterality.slice(1)
  const bodyPartAreaName = BODY_PART_AREA_NAMES[bp] || bodyPartName
  // TCM Dx 条件名: NECK 用 "Cervical" (模板下拉), 其他用 bodyPartName 首字母大写
  const assessmentConditionName = bp === 'NECK' ? 'Cervical' :
    bodyPartName.charAt(0).toUpperCase() + bodyPartName.slice(1)

  let assessment = `TCM Dx:\n`
  if (bp === 'KNEE') {
    assessment += `${lateralityUpper} ${bodyPartName} pain due to ${context.localPattern} in local meridian, `
  } else if (bp === 'SHOULDER') {
    // SHOULDER 模板: "Bilateral - shoulder area pain due to..."
    assessment += `${lateralityUpper} - ${bodyPartAreaName} pain due to ${context.localPattern} in local meridian, `
  } else if (bp === 'NECK') {
    // NECK 模板: "Cervical pain due to..." (无侧别, 无 area)
    assessment += `${assessmentConditionName} pain due to ${context.localPattern} in local meridian, `
  } else if (bp === 'LBP') {
    // LBP 模板: "Lower back pain due to..." (无侧别, 无 area)
    assessment += `${assessmentConditionName} pain due to ${context.localPattern} in local meridian, `
  } else {
    assessment += `${assessmentConditionName} pain due to ${context.localPattern} in local meridian, `
  }
  assessment += `but patient also has ${context.systemicPattern} in the general.\n`

  // 治则
  const treatmentPrinciples = localPattern?.treatmentPrinciples || ['promote circulation, relieves pain']
  const treatmentVerb = getConfig(TREATMENT_VERB_MAP, bp)
  const harmonize = getConfig(HARMONIZE_MAP, bp)
  const treatmentPurpose = getConfig(TREATMENT_PURPOSE_MAP, bp)

  assessment += `Today's TCM treatment principles:\n`
  // 防重复: 如果 verb 和 principle 以同一个单词开头，用 'focus' 替代
  let finalVerb = treatmentVerb
  const verbFirstWord = treatmentVerb.split(' ')[0].toLowerCase()
  const principleFirstWord = treatmentPrinciples[0].split(' ')[0].toLowerCase()
  if (verbFirstWord === principleFirstWord) {
    finalVerb = 'focus'
  }
  assessment += `${finalVerb} on ${treatmentPrinciples[0]} and harmonize ${harmonize} balance in order to ${treatmentPurpose}.\n`

  // 评估位置 — 介词因部位而异 (临床逻辑区别):
  // KNEE: "on bilateral knee area." (关节部位用 "on/in")
  // SHOULDER: "Bilateral -shoulder area" (无 "on")
  // LBP: "along bilateral lower back." (沿脊柱走向用 "along")
  // NECK: "on B/L Cervical" (用 "B/L" 缩写, "Cervical" 条件名)
  if (bp === 'KNEE') {
    assessment += `Acupuncture Eval was done today on ${laterality} ${bodyPartName} area.`
  } else if (bp === 'SHOULDER') {
    assessment += `Acupuncture Eval was done today ${lateralityUpper} -${bodyPartAreaName}`
  } else if (bp === 'LBP' || bp === 'MID_LOW_BACK') {
    // LBP/MID_LOW_BACK 用 "along" — 沿脊柱走向
    assessment += `Acupuncture Eval was done today along ${laterality} ${bodyPartName}.`
  } else if (bp === 'NECK') {
    // NECK 用 "on B/L Cervical" (双侧缩写)
    const neckLaterality = laterality === 'bilateral' ? 'B/L' : laterality
    assessment += `Acupuncture Eval was done today on ${neckLaterality} ${assessmentConditionName}`
  } else {
    assessment += `Acupuncture Eval was done today on ${laterality} ${bodyPartName}.`
  }

  return assessment
}

/**
 * 生成 Plan 部分（IE）
 * KNEE 模板格式:
 *   "to5-6." (Pain Scale to与值之间无空格)
 *   "to (70%-80%)" (sensation Scale to 后带括号)
 *   "to4" (Strength to与值之间无空格)
 */
export function generatePlanIE(context: GenerationContext): string {
  const bp = context.primaryBodyPart
  const severity = context.severityLevel || 'moderate to severe'

  // 动态计算 Goals (使用 context 中的 associatedSymptom 和实际 pain)
  const symptomType = context.associatedSymptom || 'soreness'
  const isChronicAware = context.chronicityLevel === 'Chronic'
  const goals = calculateDynamicGoals(severity, bp, symptomType, context.painCurrent, isChronicAware)
  const isMainBP = bp === 'KNEE' || bp === 'SHOULDER' || bp === 'LBP' || bp === 'NECK' || bp === 'MID_LOW_BACK'

  let plan = `Initial Evaluation - Personal one on one contact with the patient (total 20-30 mins)\n`
  plan += `1. Greeting patient.\n`
  plan += `2. Detail explanation from patient of past medical history and current symptom.\n`
  plan += `3. Initial evaluation examination of the patient current condition.\n`
  plan += `4. Explanation with patient for medical decision/treatment plan.\n\n`

  // 短期目标 (使用动态计算值)
  plan += `Short Term Goal (RELIEF TREATMENT FREQUENCY: 12 treatments in 5-6 weeks):\n`

  if (isMainBP) {
    plan += `Decrease Pain Scale to ${goals.pain.st}.\n`
    plan += `Decrease ${goals.symptomType} sensation Scale to ${goals.symptomPct.st}\n`
    plan += `Decrease Muscles Tightness to ${goals.tightness.st}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.st}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.st}\n`
    plan += `Increase Muscles Strength to ${goals.strength.st}\n\n`
  } else {
    // 其他部位: 有空格格式
    plan += `Decrease Pain Scale to ${goals.pain.st}.\n`
    plan += `Decrease ${goals.symptomType} sensation Scale to 50%\n`
    plan += `Decrease Muscles Tightness to ${goals.tightness.st}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.st}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.st}\n`
    plan += `Increase Muscles Strength to ${goals.strength.st}\n\n`
  }

  // 长期目标 (使用动态计算值)
  plan += `Long Term Goal (ADDITIONAL MAINTENANCE & SUPPORTING TREATMENTS FREQUENCY: 8 treatments in 5-6 weeks):\n`

  // Tightness LT 格式: "mild-moderate" (连字符)
  const tightnessLT = goals.tightness.lt.replace(/ to /g, '-')

  if (isMainBP) {
    plan += `Decrease Pain Scale to ${goals.pain.lt}\n`
    plan += `Decrease ${goals.symptomType} sensation Scale to ${goals.symptomPct.lt}\n`
    plan += `Decrease Muscles Tightness to ${tightnessLT}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.lt}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.lt}\n`
    plan += `Increase Muscles Strength to ${goals.strength.lt}\n`
    plan += `Increase ROM ${goals.rom.lt}\n`
    plan += `Decrease impaired Activities of Daily Living to ${goals.adl.lt}.`
  } else {
    plan += `Decrease Pain Scale to ${goals.pain.lt}\n`
    plan += `Decrease ${goals.symptomType} sensation Scale to 30%\n`
    plan += `Decrease Muscles Tightness to ${tightnessLT}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.lt}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.lt}\n`
    plan += `Increase Muscles Strength to ${goals.strength.lt}\n`
    plan += `Increase ROM ${goals.rom.lt}\n`
    plan += `Decrease impaired Activities of Daily Living to ${goals.adl.lt}.`
  }

  return plan
}

// ==================== TX (Daily Note / Treatment Note) ====================

/**
 * TX Subjective 下拉框选项 (来自 AC-TX KNEE.md)
 */
const TX_SYMPTOM_CHANGE_OPTIONS = [
  'improvement of symptom(s)',
  'exacerbate of symptom(s)',
  'similar symptom(s) as last visit',
  'improvement after treatment, but pain still came back next day'
]

const TX_REASON_OPTIONS = [
  'can move joint more freely and with less pain',
  'physical activity no longer causes distress',
  'reduced level of pain',
  'reduced joint stiffness and swelling',
  'less difficulty performing daily activities',
  'energy level improved',
  'sleep quality improved',
  'more energy level throughout the day',
  'continuous treatment',
  'maintain regular treatments',
  'still need more treatments to reach better effect',
  'weak constitution',
  'skipped treatments',
  'stopped treatment for a while',
  'discontinuous treatment',
  'did not have good rest',
  'intense work',
  'excessive time using cell phone',
  'excessive time using computer',
  'bad posture',
  'carrying/lifting heavy object(s)',
  'lack of exercise',
  'exposure to cold air',
  'uncertain reason'
]

const TX_CONNECTOR_OPTIONS = ['because of', 'may related of', 'due to', 'and']

const TX_GENERAL_CONDITION_OPTIONS = ['good', 'fair', 'poor']

const TX_SYMPTOM_PRESENT_OPTIONS = [
  'slight improvement of symptom(s).',
  'improvement of symptom(s).',
  'exacerbate of symptom(s).',
  'no change.'
]

const TX_PATIENT_CHANGE_OPTIONS = [
  'decreased', 'slightly decreased', 'increased', 'slight increased', 'remained the same'
]

const TX_WHAT_CHANGED_OPTIONS = [
  'pain', 'pain frequency', 'pain duration', 'numbness sensation',
  'muscles weakness', 'muscles soreness sensation', 'muscles stiffness sensation',
  'heaviness sensation', 'difficulty in performing ADLs', 'as last time visit'
]

const TX_PHYSICAL_CHANGE_OPTIONS = [
  'reduced', 'slightly reduced', 'increased', 'slight increased', 'remained the same'
]

const TX_FINDING_TYPE_OPTIONS = [
  'local muscles tightness', 'local muscles tenderness', 'local muscles spasms',
  'local muscles trigger points', 'joint ROM', 'joint ROM limitation',
  'muscles strength', 'joints swelling', 'last visit'
]

const TX_TOLERATED_OPTIONS = ['session', 'treatment', 'acupuncture session', 'acupuncture treatment']

const TX_RESPONSE_OPTIONS = [
  'well', 'with good positioning technique', 'with good draping technique',
  'with positive verbal response', 'with good response', 'with positive response',
  'with good outcome in reducing spasm', 'with excellent outcome due reducing pain',
  'with good outcome in improving ROM', 'good outcome in improving ease with functional mobility',
  'with increase ease with functional mobility', 'with increase ease with function'
]

const TX_POSITIVE_REASON_OPTIONS = [
  'can move joint more freely and with less pain',
  'physical activity no longer causes distress',
  'reduced level of pain',
  'reduced joint stiffness and swelling',
  'less difficulty performing daily activities',
  'energy level improved',
  'sleep quality improved',
  'more energy level throughout the day'
]

const TX_NEGATIVE_REASON_OPTIONS = [
  'still need more treatments to reach better effect',
  'weak constitution',
  'skipped treatments',
  'stopped treatment for a while',
  'discontinuous treatment',
  'did not have good rest',
  'intense work',
  'excessive time using cell phone',
  'excessive time using computer',
  'bad posture',
  'carrying/lifting heavy object(s)',
  'lack of exercise',
  'exposure to cold air',
  'uncertain reason'
]

const TX_MAINTENANCE_REASON_OPTIONS = [
  'continuous treatment',
  'maintain regular treatments',
  'still need more treatments to reach better effect',
  'uncertain reason'
]

function applyTxReasonChain(
  weightedReasons: WeightedOption[],
  selectedChange: string,
  context: GenerationContext
): WeightedOption[] {
  const change = selectedChange.toLowerCase()
  const isImproved = change.includes('improvement') && !change.includes('came back')
  const isRelapse = change.includes('came back')
  const isExacerbate = change.includes('exacerbate')
  const isSimilar = change.includes('similar')
  const isDeficiencyPattern = context.systemicPattern.includes('Deficiency')

  return weightedReasons
    .map(item => {
      let bonus = 0
      const extraReasons: string[] = []

      if (
        isImproved &&
        (item.option === 'energy level improved' ||
          item.option === 'more energy level throughout the day' ||
          item.option === 'sleep quality improved')
      ) {
        bonus += 45
        extraReasons.push('复诊改善优先匹配模板精力/睡眠改善')
      } else if (isImproved && TX_POSITIVE_REASON_OPTIONS.includes(item.option)) {
        bonus += 25
        extraReasons.push('复诊改善优先匹配模板正向原因')
      }
      if (isImproved && isDeficiencyPattern && (item.option === 'energy level improved' || item.option === 'more energy level throughout the day')) {
        bonus += 30
        extraReasons.push('虚证改善优先匹配模板精力改善')
      }
      if (isRelapse && TX_MAINTENANCE_REASON_OPTIONS.includes(item.option)) {
        bonus += 40
        extraReasons.push('复诊反复优先匹配模板持续治疗原因')
      }
      if (isExacerbate && TX_NEGATIVE_REASON_OPTIONS.includes(item.option)) {
        bonus += 35
        extraReasons.push('复诊加重优先匹配模板负向原因')
      }
      if (isSimilar && TX_MAINTENANCE_REASON_OPTIONS.includes(item.option)) {
        bonus += 30
        extraReasons.push('症状相近优先匹配模板维持/待观察原因')
      }

      return {
        ...item,
        weight: item.weight + bonus,
        reasons: extraReasons.length > 0 ? [...item.reasons, ...extraReasons] : item.reasons
      }
    })
    .sort((a, b) => b.weight - a.weight)
}

// TX Plan 治则动词选项 (TX 模板有额外选项 vs IE)
const TX_VERB_OPTIONS = [
  'continue to emphasize', 'emphasize', 'consist of promoting',
  'promote', 'focus', 'pay attention'
]

// TX Plan 治则选项 (比 IE 多一个 "drain the dampness, clear damp")
const TX_TREATMENT_OPTIONS = [
  'moving qi', 'regulates qi',
  'activating Blood circulation to dissipate blood stagnant',
  'dredging channel and activating collaterals',
  'activate blood and relax tendons', 'eliminates accumulation',
  'resolve stagnation, clears heat', 'promote circulation, relieves pain',
  'expelling pathogens', 'dispelling cold, drain the dampness',
  'strengthening muscles and bone', 'clear heat, dispelling the flame',
  'clear damp-heat', 'drain the dampness, clear damp'
]

/**
 * 生成 TX Subjective 部分
 *
 * TX KNEE 模板结构:
 *   Follow up visit
 *   Patient reports: there is [symptom change] [connector] [reason] .
 *   Patient still c/o [pain types] pain [laterality] knee area [radiation] ,
 *   associated with muscles [symptoms] (scale as [scale]),
 *   impaired performing ADL's with [severity] difficulty [ADL set 1]
 *   and [severity] difficulty [ADL set 2].
 *
 *   Pain Scale: [score] /10
 *   Pain frequency: [frequency]
 */
export function generateSubjectiveTX(context: GenerationContext, visitState?: TXVisitState): string {
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart]
  const bodyPartAreaName = BODY_PART_AREA_NAMES[context.primaryBodyPart] || bodyPartName
  const laterality = LATERALITY_NAMES[context.laterality]
  const bp = context.primaryBodyPart
  const radiation = context.painRadiation ?? 'without radiation'

  const weightContext: WeightContext = {
    bodyPart: bp,
    localPattern: context.localPattern,
    systemicPattern: context.systemicPattern,
    chronicityLevel: context.chronicityLevel,
    severityLevel: visitState?.severityLevel || context.severityLevel,
    insuranceType: context.insuranceType,
    painScale: visitState?.painScaleCurrent || 7,
    hasPacemaker: context.hasPacemaker
  }

  // 权重选择: 症状变化
  const weightedChange = calculateWeights('subjective.symptomChange', TX_SYMPTOM_CHANGE_OPTIONS, weightContext)
  const selectedChange = visitState?.symptomChange || selectBestOption(weightedChange)

  // 权重选择: 连接词
  const selectedConnector = visitState?.reasonConnector || TX_CONNECTOR_OPTIONS[0] // "because of" 最常用

  // 权重选择: 原因
  const weightedReason = calculateWeights('subjective.reason', TX_REASON_OPTIONS, weightContext)
  const reasonWithChain = applyTxReasonChain(weightedReason, selectedChange, context)
  const selectedReason = visitState?.reason || selectBestOption(reasonWithChain)

  // Pain Types: visitState > context > 权重系统
  const painTypeOptions = ['Dull', 'Burning', 'Freezing', 'Shooting', 'Tingling', 'Stabbing', 'Aching', 'Squeezing', 'Cramping', 'pricking', 'weighty', 'cold', 'pin & needles']
  const selectedPainTypes = visitState?.painTypes
    ?? (context.painTypes && context.painTypes.length > 0 ? context.painTypes : null)
    ?? selectBestOptions(calculateWeights('subjective.painTypes', painTypeOptions, weightContext), 2)
  const associatedSymptomOptions = ['soreness', 'stiffness', 'heaviness', 'weakness', 'numbness']
  const weightedSymptoms = calculateWeights('subjective.associatedSymptoms', associatedSymptomOptions, weightContext)
  const selectedAssociatedSymptom = visitState?.associatedSymptom || selectBestOption(weightedSymptoms)

  // 权重选择: ADL 活动 (TX KNEE 有两组)
  const adlActivities = ADL_MAP[bp] || ADL_MAP['LBP']
  const weightedAdl = calculateWeights('subjective.adlDifficulty.activities', adlActivities, weightContext)
  const allAdl = selectBestOptions(weightedAdl, 5)
  // 分成两组: 前2个一组, 后3个一组 (匹配模板 TX KNEE 两组 ADL 的默认分法)
  const adlGroup1 = allAdl.slice(0, 2)
  const adlGroup2 = allAdl.slice(2, 5)

  const symptomScale = visitState?.symptomScale ?? getConfig(SYMPTOM_SCALE_MAP, bp)

  let subjective = `Follow up visit\n`

  // 患者报告行
  subjective += `Patient reports: there is ${selectedChange} ${selectedConnector} ${selectedReason} .\n`

  // 持续症状 — 介词选择 + "area" 静态文本:
  // KNEE: "pain in bilateral Knee area" (bodyPartAreaName 已含 "area", 下拉有 "in bilateral")
  // SHOULDER: "pain in bilateral shoulder area" (bodyPartAreaName 已含 "area", 下拉有 "in bilateral")
  // NECK: "pain in neck area" (模板方向下拉: in|in left side|in right side|..., 无 "bilateral" 选项)
  // LBP: "pain on lower back area" (模板无侧别下拉)
  if (bp === 'KNEE' || bp === 'SHOULDER') {
    // KNEE/SHOULDER 的 bodyPartAreaName 已包含 "area"
    subjective += `Patient still c/o ${selectedPainTypes.join(', ')} pain in ${laterality} ${bodyPartAreaName} `
  } else if (bp === 'NECK') {
    // NECK 模板方向下拉无 "bilateral", bilateral 时只用 "in"
    const neckDirection = laterality === 'bilateral' ? 'in' :
      laterality === 'left' ? 'in left side' :
        laterality === 'right' ? 'in right side' : 'in'
    subjective += `Patient still c/o ${selectedPainTypes.join(', ')} pain ${neckDirection} ${bodyPartAreaName} area `
  } else if (bp === 'LBP' || bp === 'MID_LOW_BACK') {
    subjective += `Patient still c/o ${selectedPainTypes.join(', ')} pain on ${bodyPartAreaName} area `
  } else {
    subjective += `Patient still c/o ${selectedPainTypes.join(', ')} pain on ${bodyPartAreaName} `
  }
  subjective += `${radiation}, associated with muscles ${selectedAssociatedSymptom} (scale as ${symptomScale}), `

  // TX ADL 格式:
  // KNEE: "difficulty [ADL]" (无 "of", 两组)
  // SHOULDER/NECK: "difficulty of [ADL]" (有 "of", 两组)
  // LBP: "difficulty with ADLs like [ADL]" (单组)
  if (bp === 'KNEE') {
    const sev = visitState?.severityLevel || context.severityLevel
    subjective += `impaired performing ADL's with ${sev} difficulty ${adlGroup1.join(', ')} `
    subjective += `and ${sev} difficulty ${adlGroup2.join(', ')}.\n\n`
  } else if (bp === 'SHOULDER' || bp === 'NECK') {
    const sev = visitState?.severityLevel || context.severityLevel
    subjective += `impaired performing ADL's with ${sev} difficulty of ${adlGroup1.join(', ')} `
    subjective += `and ${sev} difficulty of ${adlGroup2.join(', ')}.\n\n`
  } else {
    const sev = visitState?.severityLevel || context.severityLevel
    subjective += `impaired performing ADL's with ${sev} difficulty with ADLs like ${allAdl.slice(0, 3).join(', ')}.\n\n`
  }

  // 疼痛评分 - TX 格式: "Pain Scale: [8] /10" (不同于 IE 的 Worst/Best/Current)
  // 使用模板下拉框有效标签 (整数或范围如 "8-7"), 而非小数
  const painScale = visitState?.painScaleLabel || (visitState?.painScaleCurrent ? `${Math.round(visitState.painScaleCurrent)}` : '8')
  subjective += `Pain Scale: ${painScale} /10\n`
  // TX 格式: "Pain frequency:" (小写 f, 不同于 IE 的 "Pain Frequency:")
  subjective += `Pain frequency: ${visitState?.painFrequency || 'Constant (symptoms occur between 76% and 100% of the time)'}`

  return subjective
}

/**
 * 生成 TX Assessment 部分
 *
 * TX KNEE 模板结构:
 *   The patient continues treatment for [in bilateral] knee area today.
 *   The patient's general condition is [fair], compared with last treatment,
 *   the patient presents with [no change.] The patient has [remained the same]
 *   [as last time visit], physical finding has [remained the same] [last visit].
 *   Patient tolerated [acupuncture treatment] [with positive verbal response].
 *   No adverse side effect post treatment.
 *   Current patient still has [Cold-Damp + Wind-Cold] in local meridian that cause the pain.
 */
export function generateAssessmentTX(context: GenerationContext, visitState?: TXVisitState): string {
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart]
  const bp = context.primaryBodyPart
  const laterality = LATERALITY_NAMES[context.laterality]

  const weightContext: WeightContext = {
    bodyPart: bp,
    localPattern: context.localPattern,
    systemicPattern: context.systemicPattern,
    chronicityLevel: context.chronicityLevel,
    severityLevel: visitState?.severityLevel || context.severityLevel,
    insuranceType: context.insuranceType,
    painScale: visitState?.painScaleCurrent || 7,
    hasPacemaker: context.hasPacemaker
  }

  // 权重选择: 总体状况
  const weightedCondition = calculateWeights('assessment.condition', TX_GENERAL_CONDITION_OPTIONS, weightContext)
  const selectedCondition = visitState?.generalCondition || selectBestOption(weightedCondition)

  // 权重选择: 症状变化
  const weightedPresent = calculateWeights('assessment.present', TX_SYMPTOM_PRESENT_OPTIONS, weightContext)
  const selectedPresent = visitState?.soaChain.assessment.present || selectBestOption(weightedPresent)

  // 权重选择: 患者变化
  const weightedPatientChange = calculateWeights('assessment.patientChange', TX_PATIENT_CHANGE_OPTIONS, weightContext)
  const selectedPatientChange = visitState?.soaChain.assessment.patientChange || selectBestOption(weightedPatientChange)

  // 权重选择: 变化内容
  const weightedWhat = calculateWeights('assessment.whatChanged', TX_WHAT_CHANGED_OPTIONS, weightContext)
  const selectedWhat = visitState?.soaChain.assessment.whatChanged || selectBestOption(weightedWhat)

  // 权重选择: 体征变化
  const weightedPhysical = calculateWeights('assessment.physicalChange', TX_PHYSICAL_CHANGE_OPTIONS, weightContext)
  const selectedPhysical = visitState?.soaChain.assessment.physicalChange || selectBestOption(weightedPhysical)

  // 权重选择: 体征类型
  const weightedFinding = calculateWeights('assessment.findingType', TX_FINDING_TYPE_OPTIONS, weightContext)
  const selectedFinding = visitState?.soaChain.assessment.findingType || selectBestOption(weightedFinding)

  // 权重选择: 耐受描述
  const weightedTolerated = calculateWeights('assessment.tolerated', TX_TOLERATED_OPTIONS, weightContext)
  const selectedTolerated = selectBestOption(weightedTolerated)

  // 权重选择: 反应描述
  const weightedResponse = calculateWeights('assessment.response', TX_RESPONSE_OPTIONS, weightContext)
  const selectedResponse = selectBestOption(weightedResponse)

  let assessment = ''

  // 治疗延续 — 各部位格式差异:
  // KNEE: "The patient continues treatment for bilateral knee area today."
  // SHOULDER: "The patient continues treatment for left shoulder area today."
  // LBP: "The patient continues treatment for lower back area today." (无侧别)
  // NECK: "Patient continue treatment for neck area today." (无 "The", 无 "s")
  if (bp === 'KNEE' || bp === 'SHOULDER') {
    assessment += `The patient continues treatment for ${laterality} ${bodyPartName.toLowerCase()} area today.\n`
  } else if (bp === 'NECK') {
    assessment += `Patient continue treatment for ${bodyPartName.toLowerCase()} area today.\n`
  } else {
    assessment += `The patient continues treatment for ${bodyPartName.toLowerCase()} area today.\n`
  }

  // 总体评估
  assessment += `The patient's general condition is ${selectedCondition}, `
  assessment += `compared with last treatment, the patient presents with ${selectedPresent} `
  assessment += `The patient has ${selectedPatientChange} ${selectedWhat}, `
  assessment += `physical finding has ${selectedPhysical} ${selectedFinding}. `
  assessment += `Patient tolerated ${selectedTolerated} ${selectedResponse}. `
  assessment += `No adverse side effect post treatment.\n`

  // 证型延续
  assessment += `Current patient still has ${context.localPattern} in local meridian that cause the pain.`

  return assessment
}

/**
 * 生成 TX Plan 部分
 *
 * TX KNEE 模板结构:
 *   Today's treatment principles:
 *   [focus] on [dispelling cold, drain the dampness] to speed up the recovery, soothe the tendon.
 */
export function generatePlanTX(context: GenerationContext): string {
  const localPattern = TCM_PATTERNS[context.localPattern]
  const bp = context.primaryBodyPart

  const weightContext: WeightContext = {
    bodyPart: bp,
    localPattern: context.localPattern,
    systemicPattern: context.systemicPattern,
    chronicityLevel: context.chronicityLevel,
    severityLevel: context.severityLevel,
    insuranceType: context.insuranceType,
    painScale: 7,
    hasPacemaker: context.hasPacemaker
  }

  // 权重选择: 治则动词
  const weightedVerb = calculateWeights('plan.verb', TX_VERB_OPTIONS, weightContext)
  const selectedVerb = selectBestOption(weightedVerb)

  // 权重选择: 治则内容 (基于证型)
  const weightedTreatment = calculateWeights('plan.treatmentPrinciples', TX_TREATMENT_OPTIONS, weightContext)
  const selectedTreatment = selectBestOption(weightedTreatment)

  let plan = `Today's treatment principles:\n`
  plan += `${selectedVerb} on ${selectedTreatment} to speed up the recovery, soothe the tendon.`

  return plan
}

/**
 * 生成针刺协议
 *
 * KNEE 模板结构 (来自 acupuncture knee pain.md):
 *   Step 1: Front - right knee with e-stim (Greeting + Review + Routine exam)
 *   Step 2: Front - left knee with e-stim (Washing hands...)
 *   Step 3: Back - right knee with e-stim (Explanation with patient...)
 *   Step 4: Back - left knee without e-stim (Washing hands...)
 *
 * SHOULDER 模板结构:
 *   Step 1: Front (Greeting...)
 *   Step 2: Front (Explanation...)
 *   Step 3: Back (Washing hands...)
 *   Step 4: Back (Washing hands...)
 */
export function generateNeedleProtocol(context: GenerationContext, visitState?: TXVisitState): string {
  // 续写时: 从输入TX的实际协议推断 (电刺激或时间>=30 → full)
  const hasNeedleInfo = visitState?.electricalStimulation != null || visitState?.treatmentTime != null
  const inheritedFull = hasNeedleInfo
    ? (visitState!.electricalStimulation === true || (visitState!.treatmentTime != null && visitState!.treatmentTime >= 30))
    : undefined
  const isFullCode = inheritedFull ?? (INSURANCE_NEEDLE_MAP[context.insuranceType] === 'full')
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart]
  const bp = context.primaryBodyPart

  // 获取身体部位专用针号
  const needleSizes = getConfig(NEEDLE_SIZE_MAP, bp)

  // KNEE 专用穴位映射 (来自 acupuncture knee pain.md)
  const KNEE_FRONT_RIGHT = ['GB33', 'GB34', 'GB36']
  const KNEE_FRONT_LEFT = ['SP9', 'XI YAN', 'HE DING', 'A SHI POINT']
  const KNEE_BACK_RIGHT = ['BL40', 'BL57']
  const KNEE_BACK_LEFT = ['BL23', 'BL55', 'A SHI POINTS']

  // 其他部位穴位映射 (来自各模板 ppnSelectCombo)
  const frontPoints: Record<string, string[]> = {
    'LBP': ['REN6', 'GB34', 'ST36', 'ST40', 'REN4', 'SI3'],
    'MID_LOW_BACK': ['REN6', 'GB34', 'ST36', 'ST40', 'REN4', 'SI3'],
    'NECK': ['LI4', 'GB39', 'SI3', 'LU7'],
    'SHOULDER': ['JIAN QIAN', 'PC2', 'LU3', 'LU4', 'LU5', 'LI4', 'LI11', 'ST3', 'GB34', 'SI3', 'ST38'],
    'HIP': ['GB34', 'ST36', 'SP6', 'LV3'],
    'ELBOW': ['LI10', 'LI11', 'LU5', 'HT3']
  }

  const backPoints: Record<string, string[]> = {
    'LBP': ['BL23', 'BL25', 'BL53', 'DU4', 'BL22', 'YAO JIA JI', 'A SHI POINTS'],
    'MID_LOW_BACK': ['BL23', 'BL25', 'BL53', 'DU4', 'BL15', 'BL17', 'BL18', 'HUATUO JIA JI', 'A SHI POINTS'],
    'NECK': ['GB20', 'GB21', 'BL10', 'BL11', 'A SHI POINTS'],
    'SHOULDER': ['GB21', 'BL10', 'BL11', 'BL17', 'LI15', 'LI16', 'SI9', 'SI10', 'SI11', 'SI12', 'SI14', 'SI15', 'SJ10', 'A SHI POINTS'],
    'HIP': ['GB29', 'GB30', 'BL54', 'A SHI POINTS'],
    'ELBOW': ['LI12', 'SI8', 'A SHI POINTS'],
    'MIDDLE_BACK': ['BL15', 'BL17', 'BL18', 'BL20', 'DU9', 'DU10', 'HUATUO JIA JI', 'A SHI POINTS']
  }

  const eStim = context.hasPacemaker ? 'without' : (context.hasMetalImplant ? 'with caution' : 'with')

  // Step 1 开头文本:
  // IE: "Preparation" (Greeting/Review/Exam 已在 Plan 步骤 1-4 中)
  // TX: "Greeting patient, Review of the chart, Routine examination of the patient current condition"
  const step1Prefix = context.noteType === 'TX'
    ? 'Greeting patient, Review of the chart, Routine examination of the patient current condition, '
    : 'Preparation, '

  // ===== KNEE 专用协议 =====
  if (bp === 'KNEE' && isFullCode) {
    let protocol = `${needleSizes}\n`
    protocol += `Daily acupuncture treatment for ${bodyPartName} - Personal one on one contact with the patient (Total Operation Time: 60 mins)\n\n`

    protocol += `Front Points: (30 mins) - personal one on one contact with the patient\n`

    // Step 1: Front right knee
    protocol += `1. ${step1Prefix}`
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, Initial Acupuncture needle inserted for right knee ${eStim} electrical stimulation `
    protocol += `${KNEE_FRONT_RIGHT.join(', ')}\n\n`

    // Step 2: Front left knee - "Washing hands..."
    protocol += `2. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, re-insertion of additional needles left knee ${eStim} electrical stimulation `
    protocol += `${KNEE_FRONT_LEFT.join(', ')}\n\n`

    protocol += `Removing and properly disposing of needles\n\n`

    protocol += `Back Points (30 mins) - personal one on one contact with the patient\n`

    // Step 3: Back right knee - "Explanation with patient for future treatment plan..."
    protocol += `3. Explanation with patient for future treatment plan, washing hands, setting up the clean field, `
    protocol += `selecting acupuncture needle size, selecting location, marking and cleaning the points, `
    protocol += `re-insertion of additional needles right knee ${eStim} electrical stimulation `
    protocol += `${KNEE_BACK_RIGHT.join(', ')}\n\n`

    // Step 4: Back left knee - "Washing hands..." + WITHOUT e-stim
    protocol += `4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, re-insertion of additional needles left knee without electrical stimulation `
    protocol += `${KNEE_BACK_LEFT.join(', ')}\n\n`

    protocol += `Removing and properly disposing of needles\n`
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`
    protocol += `Documentation`

    return protocol
  }

  // ===== SHOULDER 专用协议 (双侧 4 步, 类似 KNEE) =====
  if (bp === 'SHOULDER' && isFullCode) {
    // 穴位分配 (来自 acupuncture shoulder pain.md 模板)
    const SHOULDER_FRONT_RIGHT = ['LI4', 'LI11', 'GB34']
    const SHOULDER_FRONT_LEFT = ['JIAN QIAN', 'LU3', 'SI3']
    const SHOULDER_BACK_RIGHT = ['SI9', 'SJ10', 'A SHI POINTS']
    const SHOULDER_BACK_LEFT = ['GB21', 'LI15', 'SI11', 'SI15']

    let protocol = `${needleSizes}\n`
    protocol += `Daily acupuncture treatment for ${bodyPartName} - Personal one on one contact with the patient (Total Operation Time: 60 mins)\n\n`

    protocol += `Front Points: (30 mins) - personal one on one contact with the patient\n`

    // Step 1: Front right shoulder
    protocol += `1. ${step1Prefix}`
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, Initial Acupuncture needle inserted for right ${bodyPartName} ${eStim} electrical stimulation `
    protocol += `${SHOULDER_FRONT_RIGHT.join(', ')}\n\n`

    // Step 2: Front left shoulder - "Washing hands..."
    protocol += `2. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, re-insertion of additional needles for left ${bodyPartName} ${eStim} electrical stimulation `
    protocol += `${SHOULDER_FRONT_LEFT.join(', ')}\n\n`

    protocol += `Removing and properly disposing of needles\n`

    protocol += `Back Points (30 mins) - personal one on one contact with the patient\n`

    // Step 3: Back right shoulder - "Explanation with patient..."
    protocol += `3. Explanation with patient for future treatment plan, washing hands, setting up the clean field, `
    protocol += `selecting acupuncture needle size, selecting location, marking and cleaning the points, `
    protocol += `re-insertion of additional needles for right ${bodyPartName} ${eStim} electrical stimulation `
    protocol += `${SHOULDER_BACK_RIGHT.join(', ')}\n\n`

    // Step 4: Back left shoulder - "Washing hands..." + WITHOUT e-stim
    protocol += `4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, re-insertion of additional needles for left ${bodyPartName} without electrical stimulation `
    protocol += `${SHOULDER_BACK_LEFT.join(', ')}\n\n`

    protocol += `Removing and properly disposing of needles\n`
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`
    protocol += `Documentation`

    return protocol
  }

  // ===== LBP / MID_LOW_BACK 专用协议 (非双侧, 特定穴位) =====
  if ((bp === 'LBP' || bp === 'MID_LOW_BACK') && isFullCode) {
    const LBP_FRONT_1 = frontPoints[bp]?.slice(0, 3) || ['REN6', 'GB34', 'ST36']
    const LBP_FRONT_2 = frontPoints[bp]?.slice(3, 6) || ['ST40', 'REN4', 'SI3']
    const LBP_BACK_1 = backPoints[bp]?.slice(0, 4) || ['BL25', 'BL53', 'DU4']
    const LBP_BACK_2 = backPoints[bp]?.slice(4) || ['BL22', 'YAO JIA JI', 'A SHI POINTS']

    // LBP 模板默认位置是 "mid and lower back" (下拉选项: lower back | mid and lower back)
    const lbpLocation = bp === 'MID_LOW_BACK' ? bodyPartName : 'mid and lower back'
    let protocol = `${needleSizes}\n`
    protocol += `Daily acupuncture treatment for ${lbpLocation} - Personal one on one contact with the patient (Total Operation Time: 60 mins)\n\n`

    protocol += `Front Points: (30 mins) - personal one on one contact with the patient\n`

    // Step 1
    protocol += `1. ${step1Prefix}`
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, Initial Acupuncture needle inserted ${eStim} electrical stimulation `
    protocol += `${LBP_FRONT_1.join(', ')}\n\n`

    // Step 2: "Explanation with patient..." 前缀
    protocol += `2. Explanation with patient for future treatment plan, washing hands, setting up the clean field, `
    protocol += `selecting acupuncture needle size, selecting location, marking and cleaning the points, `
    protocol += `re-insertion of additional needles ${eStim} electrical stimulation `
    protocol += `${LBP_FRONT_2.join(', ')}\n\n`

    protocol += `Removing and properly disposing of needles\n\n`

    protocol += `Back Points (30 mins) - personal one on one contact with the patient\n`

    // Step 3
    protocol += `3. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, re-insertion of additional needles ${eStim} electrical stimulation `
    protocol += `${LBP_BACK_1.join(', ')}\n\n`

    // Step 4
    protocol += `4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, re-insertion of additional needles ${eStim} electrical stimulation `
    protocol += `${LBP_BACK_2.join(', ')}\n\n`

    protocol += `Removing and properly disposing of needles\n`
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`
    protocol += `Documentation`

    return protocol
  }

  // ===== NECK 专用协议 (非双侧, Step 4 强制 without e-stim) =====
  if (bp === 'NECK' && isFullCode) {
    const NECK_FRONT_1 = ['SI3', 'SP6', 'LI11']
    const NECK_FRONT_2 = ['LV3', 'LI11', 'DU20']
    const NECK_BACK_1 = ['SI13', 'JIN JIA JI', 'A SHI POINTS']
    const NECK_BACK_2 = ['BAI LAO', 'GB14', 'GB20']

    let protocol = `${needleSizes}\n`
    protocol += `Daily acupuncture treatment for ${bodyPartName} - Personal one on one contact with the patient (Total Operation Time: 60 mins)\n\n`

    protocol += `Front Points: (30 mins) - personal one on one contact with the patient\n`

    // Step 1
    protocol += `1. ${step1Prefix}`
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, Initial Acupuncture needle inserted ${eStim} electrical stimulation `
    protocol += `${NECK_FRONT_1.join(', ')}\n\n`

    // Step 2: "Explanation with patient..." 前缀
    protocol += `2. Explanation with patient for future treatment plan, washing hands, setting up the clean field, `
    protocol += `selecting acupuncture needle size, selecting location, marking and cleaning the points, `
    protocol += `re-insertion of additional needles ${eStim} electrical stimulation `
    protocol += `${NECK_FRONT_2.join(', ')}\n\n`

    protocol += `Removing and properly disposing of needles\n\n`

    protocol += `Back Points (30 mins) - personal one on one contact with the patient\n`

    // Step 3
    protocol += `3. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, re-insertion of additional needles ${eStim} electrical stimulation `
    protocol += `${NECK_BACK_1.join(', ')}\n\n`

    // Step 4: NECK 模板 Step 4 强制 "without electrical stimulation"
    protocol += `4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, re-insertion of additional needles without electrical stimulation `
    protocol += `${NECK_BACK_2.join(', ')}\n\n`

    protocol += `Removing and properly disposing of needles\n`
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`
    protocol += `Documentation`

    return protocol
  }

  // ===== 其他部位通用协议 =====
  const front = frontPoints[bp] || ['ST36', 'SP6', 'LV3']
  const back = backPoints[bp] || ['A SHI POINTS']

  if (isFullCode) {
    // 全代码: 60分钟, 4步骤
    let protocol = `${needleSizes}\n`
    protocol += `Daily acupuncture treatment for ${bodyPartName} - Personal one on one contact with the patient (Total Operation Time: 60 mins)\n\n`

    protocol += `Front Points: (30 mins) - personal one on one contact with the patient\n`
    protocol += `1. ${step1Prefix}`
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, Initial Acupuncture needle inserted ${eStim} electrical stimulation ${front.slice(0, 3).join(', ')}\n\n`

    protocol += `2. Explanation with patient for future treatment plan, washing hands, setting up the clean field, `
    protocol += `selecting acupuncture needle size, selecting location, marking and cleaning the points, `
    protocol += `re-insertion of additional needles ${eStim} electrical stimulation ${front.slice(3, 6).join(', ')}\n\n`

    protocol += `Removing and properly disposing of needles\n\n`

    protocol += `Back Points (30 mins) - personal one on one contact with the patient\n`
    protocol += `3. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, re-insertion of additional needles ${eStim} electrical stimulation ${back.slice(0, 3).join(', ')}\n\n`

    protocol += `4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `
    protocol += `marking and cleaning the points, re-insertion of additional needles ${eStim} electrical stimulation ${back.slice(3, 6).join(', ')}\n\n`

    protocol += `Removing and properly disposing of needles\n`
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`
    protocol += `Documentation`

    return protocol
  } else {
    // 单代码 (97810): 15分钟, 1步骤, 无电刺激
    let protocol = `${needleSizes}\n`
    protocol += `Daily acupuncture treatment for ${bodyPartName} - Personal one on one contact with the patient (Total Operation Time: 15 mins)\n\n`

    protocol += `Back Points: (15 mins) - personal one on one contact with the patient\n`
    protocol += `1. ${step1Prefix}`
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, `
    protocol += `selecting location, marking and cleaning the points, Initial Acupuncture needle inserted without electrical stimulation `
    protocol += `${back.slice(0, 4).join(', ')}\n\n`

    protocol += `Removing and properly disposing of needles\n`
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`
    protocol += `Documentation`

    return protocol
  }
}

/**
 * 生成完整的 SOAP 笔记
 */
export function generateSOAPNote(context: GenerationContext): SOAPNote {
  assertTemplateSupported(context)
  const subjective = generateSubjective(context)
  const objective = generateObjective(context)
  const assessment = generateAssessment(context)
  const planContent = context.noteType === 'IE' ? generatePlanIE(context) : ''
  const needleProtocol = generateNeedleProtocol(context)

  // 组合 Plan: 基本计划 + 针刺协议
  const fullPlan = context.noteType === 'IE'
    ? `${planContent}\n\n${needleProtocol}`
    : needleProtocol

  return {
    header: {
      patientId: '',
      visitDate: new Date().toISOString().split('T')[0],
      noteType: context.noteType,
      insuranceType: context.insuranceType
    },
    subjective: {
      visitType: context.noteType === 'IE' ? 'INITIAL EVALUATION' : 'Follow up visit',
      chronicityLevel: context.chronicityLevel,
      primaryBodyPart: {
        bodyPart: context.primaryBodyPart,
        laterality: context.laterality
      },
      secondaryBodyParts: (context.secondaryBodyParts || []).map(bp => ({
        bodyPart: bp,
        laterality: 'unspecified' as Laterality
      })),
      painTypes: ['Dull', 'Aching'],
      painRadiation: 'without radiation',
      symptomDuration: { value: 3, unit: 'month(s)' },
      associatedSymptoms: ['soreness', 'stiffness'],
      symptomPercentage: '70%',
      causativeFactors: ['age related/degenerative changes'],
      exacerbatingFactors: ['Standing after sitting for long time', 'Prolong walking'],
      relievingFactors: ['Changing positions', 'Resting', 'Massage'],
      adlDifficulty: {
        level: context.severityLevel,
        activities: ['Standing for long periods of time', 'Walking for long periods of time']
      },
      activityChanges: ['decrease outside activity', 'decrease walking time'],
      painScale: { worst: 8, best: 4, current: 7 },
      painFrequency: 'Frequent (symptoms occur between 51% and 75% of the time)'
    },
    objective: {
      muscleTesting: {
        tightness: { muscles: ['longissimus', 'Gluteal Muscles'], gradingScale: context.severityLevel },
        tenderness: { muscles: ['Iliopsoas Muscle', 'Quadratus Lumborum'], gradingScale: '+3' },
        spasm: { muscles: ['longissimus', 'Iliopsoas Muscle'], gradingScale: '+3' }
      },
      rom: [
        { movement: 'Flexion', strength: '4-/5', degrees: '60 Degrees(moderate)' },
        { movement: 'Extension', strength: '3+/5', degrees: '15 Degrees(moderate)' }
      ],
      inspection: ['weak muscles and dry skin without luster'],
      tonguePulse: {
        tongue: TCM_PATTERNS[context.localPattern]?.tongue[0] || 'normal',
        pulse: TCM_PATTERNS[context.localPattern]?.pulse[0] || 'normal'
      }
    },
    assessment: {
      tcmDiagnosis: {
        localPattern: context.localPattern,
        systemicPattern: context.systemicPattern,
        bodyPart: BODY_PART_NAMES[context.primaryBodyPart]
      },
      treatmentPrinciples: {
        focusOn: TCM_PATTERNS[context.localPattern]?.treatmentPrinciples[0] || 'promote circulation',
        harmonize: 'yin/yang',
        purpose: 'promote good essence'
      },
      evaluationArea: `${LATERALITY_NAMES[context.laterality]} ${BODY_PART_NAMES[context.primaryBodyPart]}`
    },
    plan: {
      evaluationType: context.noteType === 'IE' ? 'Initial Evaluation' : 'Re-Evaluation',
      contactTime: INSURANCE_NEEDLE_MAP[context.insuranceType] === 'full' ? '60' : '15',
      steps: ['Greeting patient', 'Review of the chart', 'Examination', 'Treatment'],
      shortTermGoal: {
        treatmentFrequency: 12,
        weeksDuration: '5-6',
        painScaleTarget: '5-6',
        symptomTargets: [{ symptom: 'soreness', targetValue: '50%' }]
      },
      longTermGoal: {
        treatmentFrequency: 8,
        weeksDuration: '5-6',
        painScaleTarget: '3',
        symptomTargets: [{ symptom: 'soreness', targetValue: '30%' }]
      },
      needleProtocol: {
        needleSizes: ['34#x1"', '30#x1.5"', '30#x2"', '30#x3"'],
        totalTime: INSURANCE_NEEDLE_MAP[context.insuranceType] === 'full' ? 60 : 15,
        sections: []
      }
    },
    diagnosisCodes: [],
    procedureCodes: []
  }
}

/**
 * 导出生成的SOAP为纯文本格式
 *
 * IE 结构: Subjective → Objective → Assessment → Plan (Goals + Needle Protocol)
 * TX 结构: Subjective → Objective(沿用IE) → Assessment(TX) → Plan (Treatment Principles + Needle Protocol)
 */
export function exportSOAPAsText(context: GenerationContext, visitState?: TXVisitState): string {
  assertTemplateSupported(context)

  // 病史特殊约束注意事项
  const medCautions: string[] = []
  if (context.hasPacemaker) medCautions.push('Pacemaker - no electrical stimulation')
  if (context.hasMetalImplant) medCautions.push('Metal implant - use electrical stimulation with caution')
  if (context.medicalHistory?.includes('Osteoporosis')) medCautions.push('Osteoporosis - caution with needle depth')
  const cautionText = medCautions.length > 0 ? `\n\nPrecautions: ${medCautions.join('; ')}` : ''

  if (context.noteType === 'TX') {
    // TX (Daily Note / Treatment Note)
    const subjective = generateSubjectiveTX(context, visitState)
    const objective = generateObjective(context, visitState) // Objective 沿用 IE 的客观检查
    const assessment = generateAssessmentTX(context, visitState)
    const planTx = generatePlanTX(context)
    const needleProtocol = generateNeedleProtocol(context, visitState)

    let output = `Subjective\n${subjective}\n\n`
    output += `Objective\n${objective}\n\n`
    output += `Assessment\n${assessment}\n\n`
    output += `Plan\n${planTx}\n\n`
    output += needleProtocol + cautionText

    return output
  }

  // IE (Initial Evaluation)
  const subjective = generateSubjective(context)
  const objective = generateObjective(context)
  const assessment = generateAssessment(context)
  const plan = generatePlanIE(context)
  const needleProtocol = generateNeedleProtocol(context)

  let output = `Subjective\n${subjective}\n\n`
  output += `Objective\n${objective}\n\n`
  output += `Assessment\n${assessment}\n\n`
  output += `Plan\n${plan}\n\n`
  output += needleProtocol + cautionText

  return output
}

export interface TXSeriesTextItem {
  visitIndex: number
  state: TXVisitState
  text: string
}

/**
 * 基于 IE 基线批量生成 TX 文本序列
 * - 纵向链: tx-sequence-engine
 * - 横向链: rule-engine/template rules
 * - P 保持原生成逻辑不变
 */
export function exportTXSeriesAsText(
  context: GenerationContext,
  options: TXSequenceOptions
): TXSeriesTextItem[] {
  const txContext: GenerationContext = {
    ...context,
    noteType: 'TX'
  }
  assertTemplateSupported(txContext)

  const { states } = generateTXSequenceStates(txContext, options)
  return states.map(state => ({
    visitIndex: state.visitIndex,
    state,
    text: exportSOAPAsText(txContext, state)
  }))
}

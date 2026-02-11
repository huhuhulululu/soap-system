/**
 * Objective 部分生成器
 * 根据身体部位生成精确匹配模板的 Objective HTML
 */

import type {
  GenerationContext,
  BodyPart,
  Laterality,
  NoteType
} from '../types'

import {
  selectMuscles,
  selectTightnessGrading,
  selectTendernessGrading,
  selectTongue,
  selectPulse,
  GeneratorContext
} from './weight-integration'

// ==================== 常量定义 ====================

/**
 * 肌肉紧张度/压痛/痉挛分级选项
 */
const TIGHTNESS_GRADING_OPTIONS = 'moderate|moderate to severe|severe|mild to moderate|mild'

const TENDERNESS_GRADING_OPTIONS =
  '(+4) = Patient complains of severe tenderness, withdraws immediately in response to test pressure, and is unable to bear sustained pressure|' +
  '(+3) = Patient complains of considerable tenderness and withdraws momentarily in response to the test pressure|' +
  '(+2) = Patient states that the area is moderately tender|' +
  '(+1)=Patient states that the area is mildly tender-annoying'

const SPASM_GRADING_OPTIONS =
  '(0)=No spasm|' +
  '(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.|' +
  '(+2)=Occasional spontaneous spasms and easily induced spasms.|' +
  '(+3)=&gt;1 but &lt; 10 spontaneous spasms per hour.|' +
  '(+4)=&gt;10 spontaneous spasms per hour.'

const MUSCLE_STRENGTH_OPTIONS = '4+/5|4/5|4-/5|3+/5|3/5|3-/5|2+/5|2/5|2-/5|0'

const INSPECTION_OPTIONS =
  'local skin no damage or rash|' +
  'weak muscles and dry skin without luster|' +
  'joint swelling|' +
  'joint deformation|' +
  'The Left muscles higher than Right .|' +
  'Both muscles are at the same level|' +
  'The Right muscles higher than Left|' +
  'local muscles smaller than normal side'

// ==================== 身体部位肌肉映射 ====================

interface MuscleConfig {
  muscles: string
  defaultTightness: string[]
  defaultTenderness: string[]
  defaultSpasm: string[]
}

const MUSCLE_CONFIGS: Record<string, MuscleConfig> = {
  LBP: {
    muscles: 'iliocostalis|spinalis|longissimus|Iliopsoas Muscle|Quadratus Lumborum|Gluteal Muscles|The Multifidus muscles',
    defaultTightness: ['longissimus', 'Gluteal Muscles', 'The Multifidus muscles'],
    defaultTenderness: ['Iliopsoas Muscle', 'Quadratus Lumborum', 'The Multifidus muscles'],
    defaultSpasm: ['longissimus', 'Iliopsoas Muscle', 'Quadratus Lumborum', 'The Multifidus muscles']
  },
  NECK: {
    muscles: 'Scalene anterior / med / posterior|Levator Scapulae|Trapezius|sternocleidomastoid muscles',
    defaultTightness: ['Levator Scapulae', 'Trapezius'],
    defaultTenderness: ['Scalene anterior / med / posterior', 'Levator Scapulae', 'Trapezius', 'sternocleidomastoid muscles'],
    defaultSpasm: ['Levator Scapulae', 'Trapezius', 'sternocleidomastoid muscles']
  },
  SHOULDER: {
    muscles: 'upper trapezius|greater tuberosity|lesser tuberosity|AC joint|levator scapula|rhomboids|middle deltoid|deltoid ant fibres|bicep long head|supraspinatus|triceps short head',
    defaultTightness: ['greater tuberosity', 'AC joint', 'rhomboids', 'supraspinatus', 'triceps short head'],
    defaultTenderness: ['upper trapezius', 'lesser tuberosity', 'AC joint', 'middle deltoid', 'bicep long head', 'supraspinatus'],
    defaultSpasm: ['rhomboids', 'deltoid ant fibres', 'supraspinatus', 'triceps short head']
  },
  KNEE: {
    muscles: 'Quadriceps|Vastus lateralis|Vastus medialis|Gastrocnemius|Popliteus|Hamstrings',
    defaultTightness: ['Quadriceps', 'Vastus lateralis', 'Hamstrings'],
    defaultTenderness: ['Quadriceps', 'Vastus medialis', 'Gastrocnemius'],
    defaultSpasm: ['Quadriceps', 'Hamstrings', 'Gastrocnemius']
  },
  HIP: {
    muscles: 'Gluteus Maximus|Gluteus Medius|Piriformis|Iliopsoas|Tensor Fasciae Latae|Quadratus Femoris',
    defaultTightness: ['Gluteus Maximus', 'Piriformis', 'Iliopsoas'],
    defaultTenderness: ['Gluteus Medius', 'Piriformis', 'Tensor Fasciae Latae'],
    defaultSpasm: ['Piriformis', 'Iliopsoas', 'Gluteus Maximus']
  },
  ELBOW: {
    muscles: 'Biceps|Triceps|Brachioradialis|Supinator|Pronator Teres|Extensor Carpi',
    defaultTightness: ['Biceps', 'Triceps', 'Brachioradialis'],
    defaultTenderness: ['Biceps', 'Brachioradialis', 'Extensor Carpi'],
    defaultSpasm: ['Triceps', 'Brachioradialis', 'Supinator']
  },
  MIDDLE_BACK: {
    muscles: 'Rhomboids|Middle Trapezius|Erector Spinae|Latissimus Dorsi|Serratus Posterior|Multifidus',
    defaultTightness: ['Rhomboids', 'Middle Trapezius', 'Erector Spinae'],
    defaultTenderness: ['Rhomboids', 'Latissimus Dorsi', 'Multifidus'],
    defaultSpasm: ['Middle Trapezius', 'Erector Spinae', 'Serratus Posterior']
  }
}

// ==================== ROM 配置 ====================

interface ROMMovement {
  name: string
  description?: string
  strengthDefault: string
  degreeOptions: string
  degreeDefault: string
}

interface ROMConfig {
  title: string
  movements: ROMMovement[]
}

const ROM_CONFIGS: Record<string, ROMConfig> = {
  LBP: {
    title: 'Lumbar Muscles Strength and Spine ROM',
    movements: [
      {
        name: 'Flexion',
        strengthDefault: '4-/5',
        degreeOptions: '90 Degrees(normal)|85 Degrees(normal)|80 Degrees(normal)|75 Degrees(mild)|70 Degrees(mild)|65 Degrees(mild)|60 Degrees(moderate)|55 Degrees(moderate)|50 Degrees(moderate)|45 Degrees(moderate)|40 Degrees(moderate)|35 Degrees(severe)|30 Degrees(severe)|25 Degrees(severe)|15 Degrees(severe)|10 Degrees(severe)|5 Degrees(severe)',
        degreeDefault: '60 Degrees(moderate)'
      },
      {
        name: 'Extension',
        strengthDefault: '3+/5',
        degreeOptions: '30 Degrees(normal)|25 Degrees(mild)|20 Degrees(moderate)|15 Degrees(moderate)|10 Degrees(severe)|5 Degrees(severe)|can not do it at all',
        degreeDefault: '15 Degrees(moderate)'
      },
      {
        name: 'Rotation to Right',
        strengthDefault: '4-/5',
        degreeOptions: '30 Degrees(normal)|25 Degrees(mild)|20 Degrees(moderate)|15 Degrees(moderate)|10 Degrees(severe)|5 Degrees(severe)|can not do it at all',
        degreeDefault: '20 Degrees(moderate)'
      },
      {
        name: 'Rotation to Left',
        strengthDefault: '4-/5',
        degreeOptions: '30 Degrees(normal)|25 Degrees(mild)|20 Degrees(moderate)|15 Degrees(moderate)|10 Degrees(severe)|5 Degrees(severe)|can not do it at all',
        degreeDefault: '20 Degrees(moderate)'
      },
      {
        name: 'Flexion to the Right',
        strengthDefault: '4-/5',
        degreeOptions: '30 Degrees(normal)|25 Degrees(mild)|20 Degrees(moderate)|15 Degrees(moderate)|10 Degrees(severe)|5 Degrees(severe)|can not do it at all',
        degreeDefault: '20 Degrees(moderate)'
      },
      {
        name: 'Flexion to the Left',
        strengthDefault: '4-/5',
        degreeOptions: '30 Degrees(normal)|25 Degrees(mild)|20 Degrees(moderate)|15 Degrees(moderate)|10 Degrees(severe)|5 Degrees(severe)|can not do it at all',
        degreeDefault: '20 Degrees(moderate)'
      }
    ]
  },
  NECK: {
    title: 'Cervical Muscles Strength and Spine ROM Assessment',
    movements: [
      {
        name: 'Extension',
        description: 'look up',
        strengthDefault: '4-/5',
        degreeOptions: '5 Degrees(severe)|10 Degrees(severe)|15 Degrees(severe)|20 Degrees(moderate)|25 Degrees(moderate)|30 Degrees(moderate)|35 Degrees(mild)|40 Degrees(mild)|45 -55 Degrees(normal)|55 -65 Degrees(normal)|65-70 Degrees(normal)',
        degreeDefault: '25 Degrees(moderate)'
      },
      {
        name: 'Flexion',
        description: 'look down',
        strengthDefault: '4-/5',
        degreeOptions: '5 Degrees(severe)|10 Degrees(severe)|15 Degrees(severe)|20 Degrees(moderate)|25 Degrees(moderate)|30 Degrees(mild)|35 Degrees(mild)|40-50 Degrees(normal)|50-60 Degrees(normal)',
        degreeDefault: '25 Degrees(moderate)'
      },
      {
        name: 'Rotation to Right',
        description: 'look to right',
        strengthDefault: '3+/5',
        degreeOptions: '10 Degrees(severe)|15 Degrees(severe)|20 Degrees(severe)|25 Degrees(severe)|30 Degrees(moderate)|35 Degrees(moderate)|40 Degrees(moderate)|45 Degrees(moderate)|50 Degrees(mild)|55 Degrees(mild)|60 Degrees(mild)|65 Degrees(mild)|70 -80 Degrees(normal)',
        degreeDefault: '35 Degrees(moderate)'
      },
      {
        name: 'Rotation to Left',
        description: 'look to left',
        strengthDefault: '3+/5',
        degreeOptions: '10 Degrees(severe)|15 Degrees(severe)|20 Degrees(severe)|25 Degrees(severe)|30 Degrees(moderate)|35 Degrees(moderate)|40 Degrees(moderate)|45 Degrees(moderate)|50 Degrees(mild)|55 Degrees(mild)|60 Degrees(mild)|65 Degrees(mild)|70 -80 Degrees(normal)',
        degreeDefault: '35 Degrees(moderate)'
      },
      {
        name: 'Flexion to the Right',
        description: 'bending right',
        strengthDefault: '4-/5',
        degreeOptions: '10 Degrees(severe)|15 Degrees(severe)|20 Degrees(moderate)|25 Degrees(moderate)|30 Degrees(mild)|35 Degrees(mild)|40-45 Degrees(normal)',
        degreeDefault: '20 Degrees(moderate)'
      },
      {
        name: 'Flexion to the Left',
        description: 'bending left',
        strengthDefault: '4-/5',
        degreeOptions: '10 Degrees(severe)|15 Degrees(severe)|20 Degrees(moderate)|25 Degrees(moderate)|30 Degrees(mild)|35 Degrees(mild)|40-45 Degrees(normal)',
        degreeDefault: '20 Degrees(moderate)'
      }
    ]
  },
  SHOULDER: {
    title: 'Shoulder Muscles Strength and Joint ROM',
    movements: [
      {
        name: 'Abduction',
        strengthDefault: '3+',
        degreeOptions: '180 degree(normal)|175 degree(normal)|170 degree(normal)|165 degree(mild)|160 degree(mild)|155 degree(mild)|150 degree(mild)|145 degree(moderate)|140 degree(moderate)|135 degree(moderate)|130 degree(moderate)|125 degree(moderate)|120 degree(moderate)|115 degree(moderate)|110 degree(moderate)|105 degree(moderate)|100 degree(moderate)|95 degree(moderate)|90 degree(severe)|85 degree(severe)|80 degree(severe)|75 degree(severe)|70 degree(severe)|65 degree(severe)|60 degree(severe)|55 degree(severe)|50 degree(severe)|45 degree(severe)|40 degree(severe)|35 degree(severe)|30 degree(severe)|25 degree(severe)|20 degree(severe)|15 degree(severe)|10 degree(severe)|5 degree(severe)',
        degreeDefault: '120 degree(moderate)'
      },
      {
        name: 'Horizontal Adduction',
        strengthDefault: '4-',
        degreeOptions: '45 degree (normal)|40 degree (normal)|35 degree (normal)|30 degree (normal)|25 degree (mild)|20 degree (mild)|15 degree (moderate)|10 degree (moderate)|5 degree (severe)|can not do this at all',
        degreeDefault: '15 degree (moderate)'
      },
      {
        name: 'Flexion',
        strengthDefault: '3+',
        degreeOptions: '180 degree(normal)|175 degree(normal)|170 degree(normal)|165 degree(mild)|160 degree(mild)|155 degree(mild)|150 degree(mild)|145 degree(moderate)|140 degree(moderate)|135 degree(moderate)|130 degree(moderate)|125 degree(moderate)|120 degree(moderate)|115 degree(moderate)|110 degree(moderate)|105 degree(moderate)|100 degree(moderate)|95 degree(moderate)|90 degree(severe)|85 degree(severe)|80 degree(severe)|75 degree(severe)|70 degree(severe)|65 degree(severe)|60 degree(severe)|55 degree(severe)|50 degree(severe)|45 degree(severe)|40 degree(severe)|35 degree(severe)|30 degree(severe)|25 degree(severe)|20 degree(severe)|15 degree(severe)|10 degree(severe)|5 degree(severe)',
        degreeDefault: '125 degree(moderate)'
      },
      {
        name: 'Extension',
        strengthDefault: '3+',
        degreeOptions: '5 Degrees(severe)|10 Degrees(severe)|15 Degrees(severe)|20 Degrees(moderate)|25 Degrees(moderate)|30 Degrees(moderate)|35 Degrees(moderate)|40 Degrees(mild)|45 Degrees(mild)|50 Degrees(mild)|55 Degrees(normal)|60 Degrees(normal)',
        degreeDefault: '25 Degrees(moderate)'
      },
      {
        name: 'External rotation',
        strengthDefault: '4-',
        degreeOptions: '90 Degrees(normal)|85 Degrees(normal)|80 Degrees(normal)|75 Degrees(mild)|70 Degrees(mild)|65 Degrees(mild)|60 Degrees(moderate)|55 Degrees(moderate)|50 Degrees(moderate)|45 Degrees(moderate)|40 Degrees(moderate)|35 Degrees(severe)|30 Degrees(severe)|25 Degrees(severe)|15 Degrees(severe)|10 Degrees(severe)|5 Degrees(severe)',
        degreeDefault: '60 Degrees(moderate)'
      },
      {
        name: 'Internal rotation',
        strengthDefault: '4-',
        degreeOptions: '90 Degrees(normal)|85 Degrees(normal)|80 Degrees(normal)|75 Degrees(mild)|70 Degrees(mild)|65 Degrees(mild)|60 Degrees(moderate)|55 Degrees(moderate)|50 Degrees(moderate)|45 Degrees(moderate)|40 Degrees(moderate)|35 Degrees(severe)|30 Degrees(severe)|25 Degrees(severe)|15 Degrees(severe)|10 Degrees(severe)|5 Degrees(severe)',
        degreeDefault: '60 Degrees(moderate)'
      }
    ]
  }
}

// ==================== HTML 生成辅助函数 ====================

const BASE_STYLE = 'font-variant-ligatures: normal; orphans: 2; widows: 2; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial;'

function createSpan(content: string, style: string = BASE_STYLE): string {
  return `<span style="${style}">${content}</span>`
}

function createSelectComboSingle(options: string, defaultValue: string, style: string = BASE_STYLE): string {
  return `<span class="ppnSelectComboSingle ${options}" style="${style}">${defaultValue}</span>`
}

function createSelectCombo(options: string, defaultValue: string, style: string = BASE_STYLE): string {
  return `<span class="ppnSelectCombo ${options}" style="${style}">${defaultValue}</span>`
}

function createBr(style: string = BASE_STYLE): string {
  return `<br style="${style}">`
}

function createStrong(content: string, style: string = BASE_STYLE): string {
  return `<strong style="${style}">${content}</strong>`
}

// ==================== 主要生成函数 ====================

/**
 * 将 GenerationContext 转换为 GeneratorContext（用于权重选择）
 */
function toGeneratorContext(context: GenerationContext, bodyPart: BodyPart): GeneratorContext {
  return {
    noteType: context.noteType === 'TX' ? 'TX' : 'IE',
    insuranceType: context.insuranceType,
    bodyPart: bodyPart,
    laterality: context.laterality,
    chronicityLevel: context.chronicityLevel,
    painScore: 7,
    severityLevel: context.severityLevel,
    localPattern: context.localPattern,
    systemicPattern: context.systemicPattern,
    age: undefined,
    occupation: undefined,
    weather: undefined,
    hasPacemaker: context.hasPacemaker
  }
}

/**
 * 生成 Objective 部分的完整 HTML
 */
export function generateObjectiveHTML(context: GenerationContext, bodyPart: BodyPart): string {
  // TX 模板没有 Objective 部分
  if (context.noteType === 'TX') {
    return ''
  }

  // 根据身体部位决定 Inspection 的位置（Shoulder 在前）
  if (bodyPart === 'SHOULDER') {
    return generateShoulderObjective(context, bodyPart)
  }

  return generateStandardObjective(context, bodyPart)
}

/**
 * 生成标准 Objective（LBP, NECK 等）
 */
function generateStandardObjective(context: GenerationContext, bodyPart: BodyPart): string {
  const parts: string[] = []
  const genCtx = toGeneratorContext(context, bodyPart)

  // 开始 body 标签
  parts.push('<body id="tinymce" class="mceContentBody " onload="window.parent.tinyMCE.get(\'Objective\').onLoad.dispatch();" contenteditable="true" dir="ltr">')

  // Muscles Testing
  parts.push(generateMuscleTesting(bodyPart, genCtx))

  // ROM Section
  parts.push(generateROMSection(bodyPart, context.laterality))

  // Inspection
  parts.push(generateInspection())

  // 结束 body 标签
  parts.push('</body>')

  return parts.join('')
}

/**
 * 生成 Shoulder Objective（Inspection 在 Muscles Testing 前面）
 */
function generateShoulderObjective(context: GenerationContext, bodyPart: BodyPart): string {
  const parts: string[] = []
  const genCtx = toGeneratorContext(context, bodyPart)

  // 开始 body 标签
  parts.push('<body id="tinymce" class="mceContentBody " onload="window.parent.tinyMCE.get(\'Objective\').onLoad.dispatch();" contenteditable="true" dir="ltr">')

  // Inspection（Shoulder 模板中在前面）
  parts.push(generateInspection())
  parts.push(createBr())
  parts.push(createBr())

  // Muscles Testing
  parts.push(generateMuscleTesting(bodyPart, genCtx))

  // ROM Section
  parts.push(generateShoulderROMSection(context.laterality))

  // 结束 body 标签
  parts.push('</body>')

  return parts.join('')
}

/**
 * 生成肌肉测试部分
 */
function generateMuscleTesting(bodyPart: BodyPart, genCtx: GeneratorContext): string {
  const config = MUSCLE_CONFIGS[bodyPart] || MUSCLE_CONFIGS.LBP
  const parts: string[] = []

  // 获取肌肉选项数组
  const muscleOptions = config.muscles.split('|')

  // 使用权重选择肌肉
  const selectedTightnessMuscles = selectMuscles(muscleOptions, genCtx, 3)
  const selectedTendernessMuscles = selectMuscles(muscleOptions, genCtx, 4)
  const selectedSpasmMuscles = selectMuscles(muscleOptions, genCtx, 4)

  // 使用权重选择分级
  const tightnessGradingOptions = TIGHTNESS_GRADING_OPTIONS.split('|')
  const selectedTightnessGrading = selectTightnessGrading(tightnessGradingOptions, genCtx)

  const tendernessGradingOptions = TENDERNESS_GRADING_OPTIONS.split('|')
  const selectedTendernessGrading = selectTendernessGrading(tendernessGradingOptions, genCtx)

  // Muscles Testing 标题
  parts.push(createStrong('Muscles Testing:'))
  parts.push(`<span style="${BASE_STYLE} font-family: arial, helvetica, sans-serif; font-size: small;"><span style="font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 12px;"><br>Tightness muscles noted </span></span>`)

  // Tightness 部分
  parts.push(createSpan('along '))
  parts.push(createSelectCombo(config.muscles, selectedTightnessMuscles.join(', ')))
  parts.push(`<span style="background-color: #ffffff;"><span style="font-family: verdana, geneva;"><br></span></span>`)
  parts.push(`<span style="background-color: #ffffff;">Grading Scale: </span>`)
  parts.push(createSelectComboSingle(TIGHTNESS_GRADING_OPTIONS, selectedTightnessGrading))

  parts.push(`<span style="${BASE_STYLE} font-family: arial, helvetica, sans-serif; font-size: small;"><span style="font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 12px;"><br><br></span></span>`)

  // Tenderness 部分
  parts.push(createSpan('Tenderness muscle noted along '))
  parts.push(createSelectCombo(config.muscles, selectedTendernessMuscles.join(', ')))
  parts.push(`<span style="${BASE_STYLE} font-family: arial, helvetica, sans-serif; font-size: small;"><span style="font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 12px;"><span class="ppnSelectCombo ${config.muscles}"><br></span><br></span></span>`)

  parts.push(createSpan('Grading Scale: '))
  parts.push(createSelectComboSingle(
    TENDERNESS_GRADING_OPTIONS,
    selectedTendernessGrading
  ))
  parts.push(createSpan('.'))
  parts.push(createBr())
  parts.push(createBr())

  // Spasm 部分
  parts.push(createSpan('Muscles s'))
  parts.push(`<span style="${BASE_STYLE} font-family: arial, helvetica, sans-serif; font-size: small;"><span style="font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 12px;">pasm </span></span>`)
  parts.push(createSpan('noted along '))
  parts.push(createSelectCombo(config.muscles, selectedSpasmMuscles.join(', ')))
  parts.push(`<span style="${BASE_STYLE} font-family: arial, helvetica, sans-serif; font-size: small;"><span style="font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 12px;"><span class="ppnSelectCombo ${config.muscles}"><span style="background-color: #ffffff;"><span style="font-family: verdana, geneva;">:</span></span></span></span></span>`)
  parts.push(`<span style="${BASE_STYLE} font-family: arial, helvetica, sans-serif; font-size: small;"><span style="font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 12px;"><br></span></span>`)

  parts.push(createSpan('Frequency Grading Scale:'))
  parts.push(createSelectComboSingle(SPASM_GRADING_OPTIONS, '(+3)=&gt;1 but &lt; 10 spontaneous spasms per hour.'))
  parts.push(createBr())
  parts.push(createBr())

  return parts.join('')
}

/**
 * 生成 ROM 评估部分
 */
function generateROMSection(bodyPart: BodyPart, laterality: Laterality): string {
  const config = ROM_CONFIGS[bodyPart] || ROM_CONFIGS.LBP
  const parts: string[] = []

  // ROM 标题
  parts.push(createSpan(config.title))
  parts.push(createStrong('<br>'))

  // 各个运动评估
  for (const movement of config.movements) {
    // 力量等级
    parts.push(createSelectComboSingle(
      MUSCLE_STRENGTH_OPTIONS,
      movement.strengthDefault,
      `${BASE_STYLE} font-family: arial, helvetica, sans-serif; font-size: small;`
    ))

    // 运动名称
    const movementLabel = movement.description
      ? ` ${movement.name} (${movement.description}): `
      : ` ${movement.name}: `
    parts.push(createSpan(movementLabel))

    // 角度
    parts.push(createSelectComboSingle(movement.degreeOptions, movement.degreeDefault))
    parts.push(createBr())
  }

  parts.push(createBr())

  return parts.join('')
}

/**
 * 生成 Shoulder ROM 评估部分（格式略有不同）
 */
function generateShoulderROMSection(laterality: Laterality): string {
  const config = ROM_CONFIGS.SHOULDER
  const parts: string[] = []
  const lateralityLabel = laterality === 'left' ? 'Left' : 'Right'

  // 侧别选择 + ROM 标题
  parts.push(createSelectComboSingle('Right|Left', lateralityLabel))
  parts.push(createSpan(` ${config.title}`))
  parts.push(createBr())

  // 各个运动评估（Shoulder 使用 /5 格式）
  for (const movement of config.movements) {
    // 力量等级
    parts.push(createSelectComboSingle(
      '4+|4|4-|3+|3|3-|2+|2|2-',
      movement.strengthDefault,
      `${BASE_STYLE} font-family: arial, helvetica, sans-serif; font-size: small;`
    ))
    parts.push('/5 ')

    // 运动名称
    const movementLabel = movement.name.includes('rotation')
      ? `${movement.name} : `
      : `${movement.name}:`
    parts.push(createSpan(movementLabel))

    // 角度
    parts.push(createSelectComboSingle(movement.degreeOptions, movement.degreeDefault))
    parts.push(createBr())
  }

  parts.push(createBr())

  return parts.join('')
}

/**
 * 生成 Inspection 部分
 */
function generateInspection(): string {
  const parts: string[] = []

  parts.push(createStrong('<span style="font-family: arial, helvetica, sans-serif; font-size: small;">Inspection</span>: '))
  parts.push(createSelectCombo(INSPECTION_OPTIONS, 'weak muscles and dry skin without luster'))
  parts.push(createBr())
  parts.push(createBr())

  return parts.join('')
}

// ==================== 导出工具函数 ====================

/**
 * 获取身体部位的肌肉选项列表
 */
export function getMuscleOptions(bodyPart: BodyPart): string[] {
  const config = MUSCLE_CONFIGS[bodyPart] || MUSCLE_CONFIGS.LBP
  return config.muscles.split('|')
}

/**
 * 获取身体部位的 ROM 配置
 */
export function getROMConfig(bodyPart: BodyPart): ROMConfig | undefined {
  return ROM_CONFIGS[bodyPart]
}

/**
 * 检查身体部位是否有自定义 Objective 格式
 */
export function hasCustomObjectiveFormat(bodyPart: BodyPart): boolean {
  return bodyPart === 'SHOULDER'
}

/**
 * 获取 Tightness 分级选项
 */
export function getTightnessGradingOptions(): string[] {
  return TIGHTNESS_GRADING_OPTIONS.split('|')
}

/**
 * 获取 Tenderness 分级选项
 */
export function getTendernessGradingOptions(): string[] {
  return TENDERNESS_GRADING_OPTIONS.split('|')
}

/**
 * 获取 Spasm 分级选项
 */
export function getSpasmGradingOptions(): string[] {
  return SPASM_GRADING_OPTIONS.split('|')
}

/**
 * 获取 Inspection 选项
 */
export function getInspectionOptions(): string[] {
  return INSPECTION_OPTIONS.split('|')
}

/**
 * 获取肌肉力量选项
 */
export function getMuscleStrengthOptions(): string[] {
  return MUSCLE_STRENGTH_OPTIONS.split('|')
}

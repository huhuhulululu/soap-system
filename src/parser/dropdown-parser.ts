/**
 * 下拉框解析器
 * 解析模板中的 ppnSelectComboSingle 和 ppnSelectCombo
 */

export type DropdownType = 'single' | 'multi'

export interface ParsedDropdown {
  id: string
  type: DropdownType
  options: string[]
  defaultValue: string
  context: string
  section: 'S' | 'O' | 'A' | 'P'
  fieldPath: string
}

export interface TemplateParseResult {
  templateName: string
  bodyPart: string
  dropdowns: ParsedDropdown[]
  rawContent: string
}

// 正则表达式匹配下拉框
const SINGLE_SELECT_REGEX = /class="ppnSelectComboSingle\s+([^"]+)"[^>]*>([^<]*)</g
const MULTI_SELECT_REGEX = /class="ppnSelectCombo\s+([^"]+)"[^>]*>([^<]*)</g

/**
 * 解析单个下拉框选项字符串
 */
export function parseOptions(optionString: string): string[] {
  return optionString
    .split('|')
    .map(opt => opt.trim())
    .filter(opt => opt.length > 0)
    .map(opt => decodeHtmlEntities(opt))
}

/**
 * 解码HTML实体
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * 从模板内容中提取所有下拉框
 */
export function extractDropdowns(
  content: string,
  section: 'S' | 'O' | 'A' | 'P',
  templateName: string
): ParsedDropdown[] {
  const dropdowns: ParsedDropdown[] = []
  let index = 0

  // 提取单选下拉框
  let match: RegExpExecArray | null
  const singleRegex = new RegExp(SINGLE_SELECT_REGEX.source, 'g')

  while ((match = singleRegex.exec(content)) !== null) {
    const optionString = match[1]
    const defaultValue = match[2]
    const options = parseOptions(optionString)

    // 获取上下文（前后50个字符的文本）
    const contextStart = Math.max(0, match.index - 50)
    const contextEnd = Math.min(content.length, match.index + match[0].length + 50)
    const context = content.slice(contextStart, contextEnd).replace(/<[^>]+>/g, ' ').trim()

    dropdowns.push({
      id: `${templateName}_${section}_single_${index++}`,
      type: 'single',
      options,
      defaultValue: decodeHtmlEntities(defaultValue),
      context,
      section,
      fieldPath: inferFieldPath(context, options)
    })
  }

  // 提取多选下拉框
  const multiRegex = new RegExp(MULTI_SELECT_REGEX.source, 'g')

  while ((match = multiRegex.exec(content)) !== null) {
    const optionString = match[1]
    const defaultValue = match[2]
    const options = parseOptions(optionString)

    const contextStart = Math.max(0, match.index - 50)
    const contextEnd = Math.min(content.length, match.index + match[0].length + 50)
    const context = content.slice(contextStart, contextEnd).replace(/<[^>]+>/g, ' ').trim()

    dropdowns.push({
      id: `${templateName}_${section}_multi_${index++}`,
      type: 'multi',
      options,
      defaultValue: decodeHtmlEntities(defaultValue),
      context,
      section,
      fieldPath: inferFieldPath(context, options)
    })
  }

  return dropdowns
}

/**
 * 根据上下文推断字段路径
 */
export function inferFieldPath(context: string, options: string[]): string {
  const contextLower = context.toLowerCase()

  // Objective 紧张度分级（先于通用严重程度判断）
  if (
    options.includes('severe') &&
    options.includes('moderate') &&
    options.includes('mild') &&
    (contextLower.includes('tightness') || contextLower.includes('muscles testing'))
  ) {
    return 'objective.muscleTesting.tightness.gradingScale'
  }

  // Objective 压痛分级
  if (
    (contextLower.includes('tenderness scale') || contextLower.includes('tenderness')) &&
    options.some(o => o.includes('+4') || o.includes('+3') || o.includes('+2') || o.includes('+1'))
  ) {
    return 'objective.muscleTesting.tenderness.gradingScale'
  }

  // 疼痛相关 — 必须同时包含数字选项才算 pain scale（避免 "current condition" 等误匹配）
  if (options.some(o => /^\d+(-\d+)?$/.test(o))) {
    if (contextLower.includes('pain scale') || contextLower.includes('worst') || contextLower.includes('best') || contextLower.includes('current:')) {
      if (contextLower.includes('worst')) return 'subjective.painScale.worst'
      if (contextLower.includes('best')) return 'subjective.painScale.best'
      if (contextLower.includes('current')) return 'subjective.painScale.current'
      return 'subjective.painScale'
    }
  }

  // 慢性程度
  if (options.includes('Acute') && options.includes('Chronic')) {
    return 'subjective.chronicityLevel'
  }

  // 疼痛类型
  if (options.includes('Dull') && options.includes('Burning') && options.includes('Stabbing')) {
    return 'subjective.painTypes'
  }

  // TX 复诊症状变化
  if (
    options.includes('improvement of symptom(s)') &&
    options.includes('exacerbate of symptom(s)') &&
    options.includes('similar symptom(s) as last visit')
  ) {
    return 'subjective.symptomChange'
  }

  // TX 复诊连接词
  if (
    options.includes('because of') &&
    options.includes('due to') &&
    options.includes('and')
  ) {
    return 'subjective.reasonConnector'
  }

  // TX 复诊原因
  if (
    options.includes('energy level improved') &&
    options.includes('sleep quality improved') &&
    options.includes('uncertain reason')
  ) {
    return 'subjective.reason'
  }

  // 辐射
  if (contextLower.includes('radiation')) {
    return 'subjective.painRadiation'
  }

  // 持续时间
  if (options.includes('week(s)') && options.includes('month(s)')) {
    return 'subjective.symptomDuration.unit'
  }

  // 操作时间（优先于通用数字选项）
  if (options.includes('15') && options.includes('30') && options.includes('45') && options.includes('60')) {
    return 'plan.needleProtocol.totalTime'
  }

  // 数字选项（1-10等）
  if (
    options.every(o => /^\d+$/.test(o) || o === 'more than 10' || o === 'many') &&
    (contextLower.includes('treatments in') || contextLower.includes('treatment frequency'))
  ) {
    return 'plan.shortTermGoal.treatmentFrequency'
  }

  // 数字选项（1-10等）
  if (options.every(o => /^\d+$/.test(o) || o === 'more than 10' || o === 'many')) {
    return 'subjective.symptomDuration.value'
  }

  // 相关症状
  if (options.includes('soreness') && options.includes('stiffness')) {
    return 'subjective.associatedSymptoms'
  }

  // 病因
  if (options.includes('age related/degenerative changes') || options.includes('weather change')) {
    return 'subjective.causativeFactors'
  }

  // 严重程度
  if (options.includes('severe') && options.includes('moderate') && options.includes('mild')) {
    return 'subjective.adlDifficulty.level'
  }

  // ADL活动
  if (options.some(o => o.includes('household') || o.includes('walking') || o.includes('standing'))) {
    return 'subjective.adlDifficulty.activities'
  }

  // 加重因素
  if (contextLower.includes('exacerbated') || contextLower.includes('aggravated')) {
    return 'subjective.exacerbatingFactors'
  }

  // 缓解因素
  if (options.includes('Resting') && options.includes('Massage')) {
    return 'subjective.relievingFactors'
  }

  // 疼痛频率
  if (options.some(o => o.includes('symptoms occur'))) {
    return 'subjective.painFrequency'
  }

  // TX整体状态
  if (options.includes('good') && options.includes('fair') && options.includes('poor')) {
    return 'assessment.generalCondition'
  }

  // 肌肉名称
  if (options.some(o => o.includes('Muscle') || o.includes('Trapezius') || o.includes('Scapulae'))) {
    return 'objective.muscleTesting.muscles'
  }

  // ROM评估
  if (options.some(o => o.includes('Degrees'))) {
    return 'objective.rom.degrees'
  }

  // 肌力评分
  if (options.some(o => o.includes('/5'))) {
    return 'objective.rom.strength'
  }

  // 局部证型
  if (options.includes('Qi Stagnation') && options.includes('Blood Stasis')) {
    return 'assessment.tcmDiagnosis.localPattern'
  }

  // 整体证型
  if (options.includes('Kidney Yang Deficiency') && options.includes('Kidney Yin Deficiency')) {
    return 'assessment.tcmDiagnosis.systemicPattern'
  }

  // 治则（必须在 tongue/pulse 之前，避免 'reduced' 等被 tongue 正则误匹配）
  if (options.includes('moving qi') || options.includes('regulates qi')) {
    return 'assessment.treatmentPrinciples.focusOn'
  }

  // 舌象（tone模板）— 使用词边界避免 'reduced' 匹配 'red'
  if (
    contextLower.includes('tongue') ||
    options.some(o => /\bcoat\b|\bpurple\b|\bpale\b|\bred\b|\byellow\b|\bspots\b|tooth marks|\bcracked\b|\bdelicate\b|\bswollen\b|\bdusk\b|\brootless\b|\bfurless\b/i.test(o))
  ) {
    return 'objective.tonguePulse.tongue'
  }
  // 脉象（tone模板）— 使用词边界避免 'Hamstrings' 匹配 'string'
  if (
    contextLower.includes('pulse') ||
    options.some(o => /\bdeep\b|\brapid\b|\bthready\b|\bslippery\b|\bstring-taut\b|\bchoppy\b|\bhesitant\b|\bfloating\b|\btight\b|\bweak\b|\bslow\b|\bwiry\b|\btense\b|\brolling\b|\bforceful\b|\bforceless\b/i.test(o))
  ) {
    return 'objective.tonguePulse.pulse'
  }

  // 治则动词（focus/emphasize/promote...）
  if (
    options.includes('focus') ||
    options.includes('emphasize') ||
    options.includes('promote') ||
    options.includes('pay attention') ||
    options.includes('continue to emphasize')
  ) {
    return 'assessment.treatmentPrinciples.focusOn'
  }

  // 针刺点位
  if (options.some(o => /^[A-Z]{2,3}\d+$/.test(o) || o.includes('A SHI'))) {
    return 'plan.needleProtocol.points'
  }

  // 电刺激
  if (options.includes('with') && options.includes('without')) {
    return 'plan.needleProtocol.electricalStimulation'
  }

  // 操作时间
  if (
    options.some(o => ['15', '30', '45', '60'].includes(o)) &&
    (contextLower.includes('operation time') || contextLower.includes('total operation time'))
  ) {
    return 'plan.needleProtocol.totalTime'
  }

  // 评估类型
  if (options.includes('Initial Evaluation') && options.includes('Re-Evaluation')) {
    return 'plan.evaluationType'
  }

  return 'unknown'
}

/**
 * 解析完整模板文件
 */
export function parseTemplate(
  content: string,
  templateName: string,
  bodyPart: string
): TemplateParseResult {
  const sections = splitIntoSections(content)
  const allDropdowns: ParsedDropdown[] = []

  if (sections.subjective) {
    allDropdowns.push(...extractDropdowns(sections.subjective, 'S', templateName))
  }
  if (sections.objective) {
    allDropdowns.push(...extractDropdowns(sections.objective, 'O', templateName))
  }
  if (sections.assessment) {
    allDropdowns.push(...extractDropdowns(sections.assessment, 'A', templateName))
  }
  if (sections.plan) {
    allDropdowns.push(...extractDropdowns(sections.plan, 'P', templateName))
  }

  return {
    templateName,
    bodyPart,
    dropdowns: allDropdowns,
    rawContent: content
  }
}

/**
 * 将模板内容分割为SOAP各部分
 */
function splitIntoSections(content: string): {
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
} {
  const lines = content.split('\n')
  const sections: { [key: string]: string } = {}
  let currentSection = ''
  let currentContent: string[] = []

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase()

    if (trimmed === 'subjective' || trimmed === 'subject') {
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n')
      }
      currentSection = 'subjective'
      currentContent = []
    } else if (trimmed === 'objective') {
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n')
      }
      currentSection = 'objective'
      currentContent = []
    } else if (trimmed === 'assessment' || trimmed === 'assesment') {
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n')
      }
      currentSection = 'assessment'
      currentContent = []
    } else if (trimmed === 'plan') {
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n')
      }
      currentSection = 'plan'
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }

  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n')
  }

  return sections
}

/**
 * 从模板提取身体部位特定的肌肉列表
 */
export function extractMusclesByBodyPart(dropdowns: ParsedDropdown[]): string[] {
  const muscleDropdowns = dropdowns.filter(d =>
    d.fieldPath.includes('muscle') ||
    d.context.toLowerCase().includes('muscle') ||
    d.context.toLowerCase().includes('tightness') ||
    d.context.toLowerCase().includes('tenderness') ||
    d.context.toLowerCase().includes('spasm')
  )

  const muscles = new Set<string>()
  for (const dropdown of muscleDropdowns) {
    for (const option of dropdown.options) {
      muscles.add(option)
    }
  }

  return Array.from(muscles)
}

/**
 * 从模板提取ROM测试列表
 */
export function extractROMTests(dropdowns: ParsedDropdown[]): string[] {
  const romDropdowns = dropdowns.filter(d =>
    d.context.toLowerCase().includes('flexion') ||
    d.context.toLowerCase().includes('extension') ||
    d.context.toLowerCase().includes('rotation') ||
    d.context.toLowerCase().includes('degrees')
  )

  const tests = new Set<string>()
  for (const dropdown of romDropdowns) {
    // 从上下文推断测试名称
    const context = dropdown.context.toLowerCase()
    if (context.includes('flexion to the right')) tests.add('Flexion to Right')
    if (context.includes('flexion to the left')) tests.add('Flexion to Left')
    if (context.includes('flexion') && context.includes('look down')) tests.add('Flexion')
    if (context.includes('extension') && context.includes('look up')) tests.add('Extension')
    if (context.includes('rotation to right')) tests.add('Rotation to Right')
    if (context.includes('rotation to left')) tests.add('Rotation to Left')
  }

  return Array.from(tests)
}

/**
 * 统一 ADL 活动→部位映射
 * 数据源: tx-sequence-engine.ts ADL_MAP (6 部位, 最完整)
 * 消费方: note-checker, WriterView, tx-sequence-engine
 */

/** 完整 ADL 活动列表 (生成用) */
export const ADL_ACTIVITIES: Record<string, string[]> = {
  SHOULDER: [
    'reaching overhead', 'lifting objects', 'carrying groceries', 'dressing',
    'combing hair', 'washing back', 'sleeping on affected side', 'driving',
    'performing household chores', 'opening doors',
  ],
  KNEE: [
    'walking', 'climbing stairs', 'descending stairs', 'squatting', 'kneeling',
    'getting up from chair', 'standing for prolonged periods', 'running',
    'jumping', 'driving',
  ],
  NECK: [
    'turning head', 'looking up', 'looking down', 'reading', 'driving',
    'working at computer', 'sleeping', 'lifting objects', 'carrying bags',
    'talking on phone',
  ],
  LBP: [
    'bending forward', 'lifting objects', 'sitting for prolonged periods',
    'standing for prolonged periods', 'walking', 'getting out of bed',
    'putting on shoes', 'driving', 'performing household chores', 'carrying objects',
  ],
  ELBOW: [
    'gripping objects', 'lifting objects', 'turning doorknobs', 'opening jars',
    'typing', 'writing', 'carrying bags', 'shaking hands', 'using tools', 'cooking',
  ],
  HIP: [
    'walking', 'climbing stairs', 'getting up from chair', 'sitting cross-legged',
    'putting on shoes', 'getting in and out of car', 'lying on affected side',
    'squatting', 'running', 'standing on one leg',
  ],
}

/** 从完整活动列表自动提取的校验关键词 (每个活动取核心词) */
function deriveKeywords(activities: string[]): string[] {
  const keywords = new Set<string>()
  for (const activity of activities) {
    // 提取核心名词/动词 (去掉 for/on/of/the/in/and/out/to/a 等虚词)
    const words = activity.toLowerCase().split(/\s+/)
      .filter(w => w.length > 2 && !['for', 'the', 'and', 'out', 'from'].includes(w))
    for (const w of words) {
      keywords.add(w)
    }
  }
  return [...keywords]
}

/** 校验用关键词 (自动从 ADL_ACTIVITIES 派生) */
export const ADL_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(ADL_ACTIVITIES).map(([bp, activities]) => [bp, deriveKeywords(activities)])
)

/** 校验 ADL 活动是否与部位匹配 */
export function isAdlConsistentWithBodyPart(
  bodyPart: string,
  adlText: string
): { consistent: boolean; keywords: string[] } {
  const bp = bodyPart.toUpperCase()
  const keywords = ADL_KEYWORDS[bp] || []
  if (keywords.length === 0) return { consistent: true, keywords: [] }

  const text = adlText.toLowerCase()
  const hasMatch = keywords.some(k => text.includes(k))
  return { consistent: hasMatch, keywords }
}

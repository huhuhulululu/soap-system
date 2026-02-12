/**
 * ADL 活动校验映射
 *
 * 数据源: BODY_PART_ADL (body-part-constants.ts) — 与生成器共享同一数据源
 * 消费方: note-checker (S3 规则)
 */

import { BODY_PART_ADL } from './body-part-constants'

/** @deprecated 使用 BODY_PART_ADL 替代 */
export const ADL_ACTIVITIES = BODY_PART_ADL

/** 从活动列表自动提取校验关键词 (每个活动取核心词) */
function deriveKeywords(activities: string[]): string[] {
  const keywords = new Set<string>()
  for (const activity of activities) {
    // 提取核心名词/动词 (去掉常见虚词)
    const words = activity.toLowerCase().split(/\s+/)
      .filter(w => w.length > 2 && !['for', 'the', 'and', 'out', 'from', 'long', 'over', 'when'].includes(w))
    for (const w of words) {
      keywords.add(w)
    }
  }
  return [...keywords]
}

/** 校验用关键词 (从 BODY_PART_ADL 派生，与生成器同源) */
export const ADL_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(BODY_PART_ADL).map(([bp, activities]) => [bp, deriveKeywords(activities)])
)

/** 校验 ADL 活动描述是否与部位匹配 */
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

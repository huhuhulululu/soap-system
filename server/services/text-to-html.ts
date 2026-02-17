/**
 * Text → HTML 转换层
 *
 * 将 exportSOAPAsText() 生成的纯文本 SOAP 转换为 TinyMCE 可接受的 HTML。
 * 同时提供 SOAP 文本拆分功能 (Subjective/Objective/Assessment/Plan)。
 */

/**
 * HTML 特殊字符转义
 */
function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 将纯文本转换为 HTML (每行一个 <p> 标签)
 * 空行被过滤，保持简洁
 */
export function textToHTML(text: string): string {
  if (!text.trim()) return ''

  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => `<p>${escapeHTML(line)}</p>`)
    .join('')
}

/**
 * SOAP 四段标记
 */
const SOAP_MARKERS = ['Subjective', 'Objective', 'Assessment', 'Plan'] as const

export interface SOAPSections {
  readonly subjective: string
  readonly objective: string
  readonly assessment: string
  readonly plan: string
}

/**
 * 将完整 SOAP 文本拆分为四个 section
 *
 * 按 "Subjective\n", "Objective\n", "Assessment\n", "Plan\n" 分割
 * Plan 是最后一个 marker，其内容延伸到文本末尾
 * (包含 Needle Protocol 和 Precautions)
 */
export function splitSOAPText(fullText: string): SOAPSections {
  const positions: Array<{ marker: string; start: number; contentStart: number }> = []

  for (const marker of SOAP_MARKERS) {
    const pattern = new RegExp(`^${marker}\\s*$`, 'm')
    const match = pattern.exec(fullText)
    if (match) {
      positions.push({
        marker,
        start: match.index,
        contentStart: match.index + match[0].length + 1
      })
    }
  }

  positions.sort((a, b) => a.start - b.start)

  const sections: Record<string, string> = {
    subjective: '',
    objective: '',
    assessment: '',
    plan: ''
  }

  for (let i = 0; i < positions.length; i++) {
    const current = positions[i]
    const nextStart = i < positions.length - 1 ? positions[i + 1].start : fullText.length
    const content = fullText.slice(current.contentStart, nextStart).trim()
    const key = current.marker.toLowerCase()
    if (key in sections) {
      sections[key] = content
    }
  }

  return {
    subjective: sections.subjective,
    objective: sections.objective,
    assessment: sections.assessment,
    plan: sections.plan,
  }
}

export interface SOAPSectionsHTML {
  readonly subjective: string
  readonly objective: string
  readonly assessment: string
  readonly plan: string
}

/**
 * 将完整 SOAP 文本拆分并转为 HTML
 * 一步完成: splitSOAPText + textToHTML
 */
export function convertSOAPToHTML(fullText: string): SOAPSectionsHTML {
  const sections = splitSOAPText(fullText)
  return {
    subjective: textToHTML(sections.subjective),
    objective: textToHTML(sections.objective),
    assessment: textToHTML(sections.assessment),
    plan: textToHTML(sections.plan),
  }
}

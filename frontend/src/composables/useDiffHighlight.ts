/**
 * 编写页 diff 与笔记摘要 composable
 * 从 WriterView 提取：shortFreq/shortSpasm/shortTight/shortTender、getNoteSummary、diffLineWords、getDiffLines
 */
import type { Ref } from 'vue'

export interface GeneratedNote {
  visitIndex?: number
  text: string
  type: string
  state?: {
    painScaleLabel?: string
    symptomScale?: string
    painFrequency?: string
    tightnessGrading?: string
    tendernessGrading?: string
    spasmGrading?: string
    soaChain?: {
      objective?: { romTrend?: string; strengthTrend?: string }
      subjective?: { frequencyChange?: string; adlChange?: string }
    }
  }
  _open?: boolean
}

export function shortFreq(f: string): string {
  if (!f) return ''
  return f.split('(')[0].trim()
}

export function shortSpasm(s: string): string {
  if (!s) return ''
  const m = s.match(/\(([^)]+)\)/)
  return m ? m[1] : s
}

export function shortTight(t: string): string {
  if (!t) return ''
  const map: Record<string, string> = {
    severe: 'Sev',
    'moderate to severe': 'M-S',
    moderate: 'Mod',
    'mild to moderate': 'Mi-M',
    mild: 'Mild',
  }
  return map[t.toLowerCase()] || t
}

export function shortTender(t: string): string {
  if (!t) return ''
  const m = t.match(/\(([^)]+)\)/)
  return m ? m[1] : t
}

export function useDiffHighlight(generatedNotes: Ref<GeneratedNote[]>) {
  function getNoteSummary(
    note: GeneratedNote,
    idx: number
  ): { values: Array<{ label: string; from: string; to: string }>; trends: Array<{ label: string; trend: string }> } | null {
    if (!note.state || note.type === 'IE') return null
    const s = note.state
    const notes = generatedNotes.value
    const prevNote = idx > 0 ? notes[idx - 1] : null
    const prevState = prevNote?.state
    const prevPain = prevState ? (prevState as { painScaleLabel?: string }).painScaleLabel : '8'
    const prevSymptom = prevState?.symptomScale || '70%'
    const prevFreq = prevState ? shortFreq(prevState.painFrequency || '') : 'Constant'
    const prevTight = prevState ? shortTight(prevState.tightnessGrading || '') : ''
    const prevTender = prevState ? shortTender(prevState.tendernessGrading || '') : ''
    const prevSpasm = prevState ? shortSpasm(prevState.spasmGrading || '') : ''

    const values: Array<{ label: string; from: string; to: string }> = []
    values.push({ label: 'Pain', from: prevPain || '8', to: s.painScaleLabel || '8' })
    if (s.symptomScale) {
      values.push({ label: 'Sx', from: prevSymptom, to: s.symptomScale })
    }
    const curFreq = shortFreq(s.painFrequency || '')
    if (curFreq && curFreq !== prevFreq) {
      values.push({ label: 'Freq', from: prevFreq, to: curFreq })
    }
    const curTight = shortTight(s.tightnessGrading || '')
    if (curTight && prevTight && curTight !== prevTight) {
      values.push({ label: 'Tight', from: prevTight, to: curTight })
    }
    const curTender = shortTender(s.tendernessGrading || '')
    if (curTender && prevTender && curTender !== prevTender) {
      values.push({ label: 'Tender', from: prevTender, to: curTender })
    }
    const curSpasm = shortSpasm(s.spasmGrading || '')
    if (curSpasm && prevSpasm && curSpasm !== prevSpasm) {
      values.push({ label: 'Spasm', from: prevSpasm, to: curSpasm })
    }

    const trends: Array<{ label: string; trend: string }> = []
    const chain = s.soaChain
    if (chain?.objective?.romTrend && chain.objective.romTrend !== 'stable') {
      trends.push({ label: 'ROM', trend: chain.objective.romTrend })
    }
    if (chain?.objective?.strengthTrend && chain.objective.strengthTrend !== 'stable') {
      trends.push({ label: 'ST', trend: chain.objective.strengthTrend })
    }
    if (chain?.subjective?.frequencyChange === 'improved') {
      trends.push({ label: 'Freq', trend: 'improved' })
    }
    if (chain?.subjective?.adlChange === 'improved') {
      trends.push({ label: 'ADL', trend: 'improved' })
    }

    return { values, trends }
  }

  function diffLineWords(
    curLine: string,
    prevLine: string
  ): Array<{ text: string; hl: boolean }> {
    if (!prevLine || prevLine.trim() === '') {
      return [{ text: curLine, hl: false }]
    }
    if (curLine.trim() === prevLine.trim()) {
      return [{ text: curLine, hl: false }]
    }
    const splitTokens = (s: string) => s.match(/[\w%.+\-/()]+|[^\w%.+\-/()]+/g) || [s]
    const curTokens = splitTokens(curLine)
    const prevTokens = splitTokens(prevLine)
    const prevSet = new Set(prevTokens.map(t => t.trim().toLowerCase()).filter(Boolean))

    const segments: Array<{ text: string; hl: boolean }> = []
    let lastHl = false
    let buf = ''

    for (let i = 0; i < curTokens.length; i++) {
      const t = curTokens[i]
      const pt = i < prevTokens.length ? prevTokens[i] : null
      const tClean = t.trim().toLowerCase()
      if (!tClean || /^[,.:;!?\s]+$/.test(tClean)) {
        buf += t
        continue
      }
      const samePos = pt && pt.trim().toLowerCase() === tClean
      const existsInPrev = prevSet.has(tClean)
      const hl = !samePos && !existsInPrev

      if (hl !== lastHl && buf) {
        segments.push({ text: buf, hl: lastHl })
        buf = ''
      }
      lastHl = hl
      buf += t
    }
    if (buf) segments.push({ text: buf, hl: lastHl })
    return segments
  }

  function getDiffLines(idx: number): Array<{ segments: Array<{ text: string; hl: boolean }> }> {
    const note = generatedNotes.value[idx]
    if (!note) return []
    const lines = note.text.split('\n')
    const sectionHeaders = new Set(['Subjective', 'Objective', 'Assessment', 'Plan', 'Follow up visit', ''])

    if (note.type === 'IE' || idx === 0) {
      return lines.map(line => ({ segments: [{ text: line, hl: false }] }))
    }
    const prevNote = generatedNotes.value[idx - 1]
    if (!prevNote) {
      return lines.map(line => ({ segments: [{ text: line, hl: false }] }))
    }
    const prevLines = prevNote.text.split('\n')

    return lines.map((line, li) => {
      const trimmed = line.trim()
      if (sectionHeaders.has(trimmed)) {
        return { segments: [{ text: line, hl: false }] }
      }
      const prevLine = li < prevLines.length ? prevLines[li] : ''
      return { segments: diffLineWords(line, prevLine) }
    })
  }

  return {
    shortFreq,
    shortSpasm,
    shortTight,
    shortTender,
    getNoteSummary,
    diffLineWords,
    getDiffLines,
  }
}

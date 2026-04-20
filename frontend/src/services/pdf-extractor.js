// Self-host pdf.worker.min.mjs via Vite ?url import so the worker version
// always matches the installed pdfjs-dist (no CDN version drift, no /ac/ base
// prefix headaches). Vite copies the asset to /ac/assets/... at build time
// and returns the correct runtime URL.
import pdfjsWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

let pdfjsModulePromise = null

async function loadPdfjs() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs')
  }

  const pdfjs = await pdfjsModulePromise
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
  }
  return pdfjs
}

// Group text items by y-coordinate so line boundaries survive.
// pdfjs emits items in content-stream order without line separators; the
// Note parser relies on line structure for visit DOS extraction. 2-column
// layouts (date | section-title) get split via x-gap within a y-row so
// left column (date) emits before right column (section content).
function itemsToLines(items) {
  const Y_TOL = 2   // pts — same row if Δy ≤ this
  const X_GAP = 50  // pts — split row on horizontal gap greater than this
  const rows = []
  for (const item of items) {
    if (!('str' in item)) continue
    const str = item.str
    if (!str || !str.trim()) continue
    const y = item.transform?.[5] ?? 0
    const x = item.transform?.[4] ?? 0
    const w = item.width ?? 0
    let row = null
    for (let i = rows.length - 1; i >= 0; i--) {
      if (Math.abs(rows[i].y - y) <= Y_TOL) { row = rows[i]; break }
    }
    if (!row) { row = { y, items: [] }; rows.push(row) }
    row.items.push({ x, xEnd: x + w, str })
  }
  rows.sort((a, b) => b.y - a.y) // top → bottom
  const lines = []
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x)
    let sub = []
    let lastX = -Infinity
    const flush = () => {
      if (sub.length) {
        const line = sub.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim()
        if (line) lines.push(line)
        sub = []
      }
    }
    for (const it of r.items) {
      if (it.x - lastX > X_GAP) flush()
      sub.push(it)
      lastX = Math.max(lastX, it.xEnd || it.x)
    }
    flush()
  }
  return lines
}

// Post-process: move isolated DOS lines ahead of an adjacent "tongue" line so
// the Note parser's `DATE\s*\n?\s*(?:Tongue|Assessment|Plan|Objective)` regex
// can lock onto visit-specific dates. pdfjs emits "tongue" above "DATE" due
// to y-coordinate ordering in 2-column layouts; pdftotext gets the reverse
// order naturally via column-aware reading. This swap is a minimal adapter.
// The Note parser's date regex `DATE\s*\n?\s*(?:Tongue|Assessment|Plan|Objective)`
// requires an isolated DATE line adjacent to a section keyword. pdfjs y-sorted
// extraction sometimes places dates mid-Assessment-body. This adapter moves each
// isolated DATE line forward to the nearest section keyword within 15 lines.
// Ensure each isolated DATE line is IMMEDIATELY followed by a Tongue/Assessment/
// Plan/Objective keyword (what the Note parser's DOS regex expects). Scan forward
// up to 15 lines; if we find a key and no intervening date, move DATE there.
function reorderDateMarkers(text) {
  const lines = text.split('\n')
  const isDate = (s) => /^\s*\d{2}\/\d{2}\/\d{4}\s*$/.test(s)
  const isKey = (s) => /^\s*(?:tongue\s*:|P\s*lan\s*:|A\s*ssessment\s*:|O\s*bjective\s*:|Tongue\s*:|Assessment\s*:|Plan\s*:|Objective\s*:)/i.test(s)
  const out = [...lines]
  let i = 0
  while (i < out.length) {
    if (!isDate(out[i])) { i++; continue }
    // Already immediately followed by key? done.
    if (i + 1 < out.length && isKey(out[i + 1])) { i++; continue }
    // Look forward for nearest key, aborting if another date appears first
    let target = -1
    for (let j = i + 1; j < Math.min(i + 16, out.length); j++) {
      if (isDate(out[j])) break
      if (isKey(out[j])) { target = j; break }
    }
    if (target < 0) {
      // Fallback: if PREVIOUS line is a Plan: heading, swap so DATE\nPlan:
      if (i > 0 && /^\s*P\s*lan\s*:/i.test(out[i - 1])) {
        const tmp = out[i]; out[i] = out[i - 1]; out[i - 1] = tmp
      }
      i++; continue
    }
    const date = out[i]
    out.splice(i, 1)                  // remove DATE from i
    out.splice(target - 1, 0, date)   // insert DATE at target-1 (target shifts -1 after splice)
    i = target
  }
  return out.join('\n')
}

export async function extractPdfText(file) {
  const pdfjs = await loadPdfjs()
  const data = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({
    data,
    useWorkerFetch: true,
    isEvalSupported: false
  })

  const pdf = await loadingTask.promise
  const pageTexts = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const text = await page.getTextContent()
    const lines = itemsToLines(text.items)
    if (lines.length) pageTexts.push(lines.join('\n'))
  }

  const merged = reorderDateMarkers(pageTexts.join('\n'))
  if (!merged.trim()) {
    throw new Error('PDF 文本为空或不可提取')
  }
  return merged
}

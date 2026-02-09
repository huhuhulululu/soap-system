let pdfjsModulePromise = null

async function loadPdfjs() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs')
  }

  const pdfjs = await pdfjsModulePromise
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`
  }
  return pdfjs
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
  const pages = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const text = await page.getTextContent()
    const line = text.items
      .map(item => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (line) pages.push(line)
  }

  const merged = pages.join('\n')
  if (!merged.trim()) {
    throw new Error('PDF 文本为空或不可提取')
  }
  return merged
}

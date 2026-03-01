import { extractPdfText } from './pdf-extractor'

let worker = null

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/checker.worker.js', import.meta.url), { type: 'module' })
  }
  return worker
}

function checkInWorker(text, options) {
  return new Promise((resolve, reject) => {
    const w = getWorker()
    const timeout = setTimeout(() => {
      reject(new Error('Checker worker timed out'))
    }, 30_000)

    const handler = (e) => {
      clearTimeout(timeout)
      w.removeEventListener('message', handler)
      w.removeEventListener('error', errorHandler)

      if (e.data.type === 'result') {
        resolve({
          report: e.data.report,
          visitTexts: e.data.visitTexts,
          document: e.data.document,
        })
      } else {
        reject(new Error(e.data.error ?? 'Worker returned no result'))
      }
    }

    const errorHandler = (e) => {
      clearTimeout(timeout)
      w.removeEventListener('message', handler)
      w.removeEventListener('error', errorHandler)
      reject(new Error(e.message))
    }

    w.addEventListener('message', handler)
    w.addEventListener('error', errorHandler)

    w.postMessage({ type: 'check', text, options })
  })
}

function toUiTrend(direction) {
  if (direction === '↓') return 'improving'
  if (direction === '↑') return 'worsening'
  return 'stable'
}

function symptomFromPainTrend(trend, isIE) {
  if (isIE) return '-'
  if (trend === '↓') return 'improvement'
  if (trend === '→') return 'no change'
  return 'worsening'
}

function formatTimeline(timeline = []) {
  const visits = timeline.map((entry) => {
    const isIE = entry.visitType === 'IE'
    const painTrend = entry.indicators?.pain?.trend || '→'
    const painScale = entry.indicators?.pain?.value ?? 0
    return {
      index: entry.visitIndex,
      date: entry.visitDate || '-',
      type: isIE ? 'INITIAL EVALUATION' : 'Follow up visit',
      painScale,
      symptomChange: symptomFromPainTrend(painTrend, isIE)
    }
  })

  const improvingCount = visits.filter(v => v.symptomChange === 'improvement').length
  const worseningCount = visits.filter(v => v.symptomChange === 'worsening').length
  const painDirection = improvingCount >= worseningCount ? 'improving' : 'worsening'

  return {
    visits,
    trends: {
      painScale: { direction: painDirection },
      symptomChange: { direction: painDirection }
    }
  }
}

function formatErrors(errors = []) {
  return errors.map((error, idx) => ({
    id: error.id || String(idx + 1),
    severity: error.severity,
    ruleName: `${error.ruleId} ${error.ruleName}`,
    message: `${error.message} (expected: ${error.expected}; actual: ${error.actual})`,
    location: {
      visitIndex: error.visitIndex,
      section: error.section,
      field: error.field
    }
  }))
}

function normalizeReport(report, visitTexts = [], document = null) {
  const formattedTimeline = formatTimeline(report.timeline)

  return {
    patient: report.patient,
    summary: {
      totalVisits: report.summary.totalVisits,
      visitDateRange: report.summary.visitDateRange,
      errorCount: report.summary.errorCount,
      scoring: {
        totalScore: report.summary.scoring.totalScore,
        grade: report.summary.scoring.grade,
        ieConsistency: report.summary.scoring.ieConsistency,
        txConsistency: report.summary.scoring.txConsistency,
        timelineLogic: report.summary.scoring.timelineLogic,
        breakdown: {
          soapConsistency: report.summary.scoring.ieConsistency,
          timelineLogic: report.summary.scoring.timelineLogic,
          ruleCompliance: report.summary.scoring.txConsistency
        }
      }
    },
    timeline: formattedTimeline.visits,
    trends: formattedTimeline.trends,
    errors: formatErrors(report.errors),
    corrections: report.corrections || [],
    visitTexts,
    document,
    raw: report
  }
}

/** 检测无 header 时注入假 header */
function ensureHeader(text) {
  if (/PATIENT:|DOB:/i.test(text)) return text
  return 'UNKNOWN, PATIENT (DOB: 01/01/2000 ID: 0000000000) Date of Service: 01/01/2025 Printed on: 01/01/2025\n' + text
}

async function validateFile(file, options = {}) {
  const rawText = await extractPdfText(file)
  const text = ensureHeader(rawText)

  try {
    const { report, visitTexts, document } = await checkInWorker(text, options)
    return normalizeReport(report, visitTexts, document)
  } catch {
    const { parseOptumNote } = await import('../../../parsers/optum-note/parser.ts')
    const { checkDocument } = await import('../../../parsers/optum-note/checker/note-checker.ts')
    const parsed = parseOptumNote(text)
    if (!parsed.success || !parsed.document) {
      const reason = parsed.errors?.map(e => `${e.field}: ${e.message}`).join(' | ') || 'Unknown parse failure'
      throw new Error(`解析失败: ${reason}`)
    }
    const report = checkDocument({ document: parsed.document, insuranceType: options.insuranceType, treatmentTime: options.treatmentTime })
    const visitTexts = parsed.document.rawVisitBlocks || []
    return normalizeReport(report, visitTexts, parsed.document)
  }
}

async function validateFiles(files) {
  const results = []
  for (const file of files) {
    try {
      const report = await validateFile(file)
      results.push({ file: file.name, success: true, report })
    } catch (error) {
      results.push({
        file: file.name,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  return results
}

export const checkerService = {
  validateFile,
  validateFiles
}

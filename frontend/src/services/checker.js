import { extractPdfText } from './pdf-extractor'
import { parseOptumNote } from '../../../parsers/optum-note/parser.ts'
import { checkDocument } from '../../../parsers/optum-note/checker/note-checker.ts'

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

function normalizeReport(report) {
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
    raw: report
  }
}

async function validateFile(file, options = {}) {
  const text = await extractPdfText(file)
  const parsed = parseOptumNote(text)
  if (!parsed.success || !parsed.document) {
    const reason = parsed.errors?.map(e => `${e.field}: ${e.message}`).join(' | ') || 'Unknown parse failure'
    throw new Error(`解析失败: ${reason}`)
  }

  const report = checkDocument({ document: parsed.document, insuranceType: options.insuranceType, treatmentTime: options.treatmentTime })
  return normalizeReport(report)
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

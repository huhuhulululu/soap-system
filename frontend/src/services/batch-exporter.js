export function exportAllAsCSV(historyItems) {
  if (!historyItems || historyItems.length === 0) {
    throw new Error('No history items to export')
  }

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const headers = [
    'filename',
    'patient_name',
    'patient_id',
    'total_visits',
    'date_range',
    'score',
    'grade',
    'critical_count',
    'high_count',
    'medium_count',
    'error_visit',
    'error_section',
    'error_rule_id',
    'error_severity',
    'error_message',
    'error_expected',
    'error_actual'
  ]

  const rows = [headers.join(',')]

  historyItems.forEach(item => {
    const { filename, report } = item
    const { patient, summary, allErrors } = report

    if (!allErrors || allErrors.length === 0) {
      rows.push([
        esc(filename),
        esc(patient.name),
        esc(patient.patientId),
        summary.totalVisits,
        esc(`${summary.visitDateRange.first} - ${summary.visitDateRange.last}`),
        summary.scoring.totalScore,
        esc(summary.scoring.grade),
        summary.errorCount.critical || 0,
        summary.errorCount.high || 0,
        summary.errorCount.medium || 0,
        '', '', '', '', '', '', ''
      ].join(','))
    } else {
      allErrors.forEach(error => {
        const visitNum = error.location?.visitIndex !== undefined
          ? error.location.visitIndex + 1
          : ''

        rows.push([
          esc(filename),
          esc(patient.name),
          esc(patient.patientId),
          summary.totalVisits,
          esc(`${summary.visitDateRange.first} - ${summary.visitDateRange.last}`),
          summary.scoring.totalScore,
          esc(summary.scoring.grade),
          summary.errorCount.critical || 0,
          summary.errorCount.high || 0,
          summary.errorCount.medium || 0,
          visitNum,
          esc(error.location?.section || ''),
          esc(error.ruleId || ''),
          esc(error.severity || ''),
          esc(error.message || ''),
          esc(error.expected || ''),
          esc(error.actual || '')
        ].join(','))
      })
    }
  })

  const csv = '\uFEFF' + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `achecker-batch-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

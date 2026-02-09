export function exportReportAsCSV(report) {
  const { patient, summary, timeline, allErrors } = report
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const rows = [
    '患者信息',
    `姓名,${esc(patient.name)}`,
    `患者ID,${esc(patient.patientId)}`,
    `DOB,${esc(patient.dob)}`,
    '',
    '摘要',
    `总就诊,${summary.totalVisits}`,
    `日期范围,${summary.visitDateRange.first} - ${summary.visitDateRange.last}`,
    `总分,${summary.scoring.totalScore}`,
    `等级,${summary.scoring.grade}`,
    `SOAP一致性,${summary.scoring.breakdown.soapConsistency}`,
    `时间线逻辑,${summary.scoring.breakdown.timelineLogic}`,
    `规则合规,${summary.scoring.breakdown.ruleCompliance}`,
    `总错误数,${summary.errorCount.total}`,
    '',
    '就诊时间线',
    '#,日期,类型,Pain,变化',
    ...timeline.visits.map(v =>
      `${v.index + 1},${v.date},${v.type},${v.painScale}/10,${v.symptomChange}`
    ),
    '',
    '错误详情',
    '严重度,规则,消息,位置',
    ...allErrors.map(e =>
      `${e.severity},${esc(e.ruleName)},${esc(e.message)},Visit${e.location.visitIndex + 1}.${e.location.section}.${e.location.field}`
    )
  ]

  const csv = '\uFEFF' + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `achecker-${(patient.name || 'report').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function copyAllCorrections(report) {
  const { allErrors } = report

  if (!allErrors || allErrors.length === 0) {
    throw new Error('No errors with corrections to copy')
  }

  const sectionMap = new Map()

  allErrors.forEach(error => {
    if (!error.correction) return

    const { visitIndex, section } = error.location
    const visitKey = `Visit ${visitIndex + 1}`
    const visitType = error.visitType || ''
    const visitLabel = visitType ? `${visitKey} (${visitType})` : visitKey

    if (!sectionMap.has(section)) {
      sectionMap.set(section, new Map())
    }

    const visitMap = sectionMap.get(section)
    if (!visitMap.has(visitLabel)) {
      visitMap.set(visitLabel, [])
    }

    visitMap.get(visitLabel).push(error.correction)
  })

  const sections = ['Subjective', 'Objective', 'Assessment', 'Plan']
  const output = []

  sections.forEach(section => {
    if (!sectionMap.has(section)) return

    output.push(`=== ${section} ===`)

    const visitMap = sectionMap.get(section)
    const sortedVisits = Array.from(visitMap.keys()).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0])
      const numB = parseInt(b.match(/\d+/)[0])
      return numA - numB
    })

    sortedVisits.forEach(visitLabel => {
      const corrections = visitMap.get(visitLabel)
      output.push(`${visitLabel}:`)
      corrections.forEach(correction => {
        output.push(correction)
      })
      output.push('')
    })
  })

  const text = output.join('\n').trim()

  navigator.clipboard.writeText(text).catch(error => {
    throw new Error(`Failed to copy to clipboard: ${error.message}`)
  })

  return text
}

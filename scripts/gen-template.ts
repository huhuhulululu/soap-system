/**
 * 生成 batch-template.xlsx — 包含 Patients sheet + Instructions sheet
 */
import ExcelJS from 'exceljs'
import path from 'path'

const FIELDS: Array<{
  name: string
  required: string
  example1: string
  example2: string
  note: string
}> = [
  { name: 'Patient *', required: 'All', example1: 'CHEN,AIJIN(09/27/1956)', example2: 'WANG,MEI(03/15/1960)', note: 'Format: LAST,FIRST(MM/DD/YYYY)' },
  { name: 'Gender *', required: 'All', example1: 'F', example2: 'M', note: 'M or F' },
  { name: 'Insurance *', required: 'All', example1: 'HF', example2: 'WC', note: 'HF | OPTUM | WC | VC | ELDERPLAN | NONE' },
  { name: 'BodyPart *', required: 'Full/SOAP', example1: 'LBP', example2: 'SHOULDER', note: 'LBP, NECK, UPPER_BACK, MIDDLE_BACK, MID_LOW_BACK, SHOULDER, ELBOW, WRIST, HAND, HIP, KNEE, ANKLE, FOOT' },
  { name: 'Laterality *', required: 'Full/SOAP', example1: 'B', example2: 'R', note: 'B (bilateral) | L (left) | R (right)' },
  { name: 'ICD', required: 'Full', example1: 'M54.50,M54.41', example2: 'M75.11,M25.511', note: 'Comma-separated ICD-10 codes. Required for Full mode' },
  { name: 'CPT', required: 'Full', example1: '97810,97811x3', example2: '', note: 'Format: CODE or CODExUNITS. Auto-filled if empty' },
  { name: 'TotalVisits *', required: 'All', example1: '12', example2: '8', note: 'Number of visits (IE + TX). Min 1' },
  { name: 'PainWorst', required: '', example1: '8', example2: '7', note: '0-10 scale. Default: 7-8' },
  { name: 'PainBest', required: '', example1: '3', example2: '2', note: '0-10 scale. Default: 2-3' },
  { name: 'PainCurrent', required: '', example1: '6', example2: '5', note: '0-10 scale. Default: 5-7' },
  { name: 'SymptomDuration', required: '', example1: '3 year(s)', example2: '6 month(s)', note: 'N year(s) | N month(s) | N week(s). Default: 3 year(s)' },
  { name: 'PainRadiation', required: '', example1: 'without radiation', example2: 'with radiation to R arm', note: 'Radiation description' },
  { name: 'PainTypes', required: '', example1: 'Dull,Aching', example2: 'Dull,Stabbing', note: 'Comma-separated: Dull, Aching, Stabbing, Sharp, Throbbing, Burning' },
  { name: 'AssociatedSymptoms', required: '', example1: 'soreness', example2: 'stiffness,soreness', note: 'Comma-separated: soreness, stiffness, numbness, tingling, weakness' },
  { name: 'CausativeFactors', required: '', example1: 'age related/degenerative changes', example2: 'over used due to heavy household chores', note: 'Free text describing cause' },
  { name: 'RelievingFactors', required: '', example1: 'Changing positions,Resting,Massage', example2: 'Resting,Applying heating pad', note: 'Comma-separated relieving factors' },
  { name: 'SymptomScale', required: '', example1: '70%-80%', example2: '60%-70%', note: 'Percentage range of symptom severity' },
  { name: 'PainFrequency', required: '', example1: 'Constant', example2: 'Frequent', note: 'INTERMITTENT | OCCASIONAL | FREQUENT | CONSTANT' },
  { name: 'SecondaryParts', required: '', example1: '', example2: 'NECK', note: 'Comma-separated secondary body parts' },
  { name: 'History', required: '', example1: 'Hypertension', example2: 'Diabetes,Osteoporosis', note: 'Comma-separated medical history' },
  { name: 'SoapText', required: 'Continue', example1: '', example2: '', note: 'Paste existing TX SOAP text here. Required for Continue mode' },
]

async function main() {
  const wb = new ExcelJS.Workbook()

  // ── Sheet 1: Patients ──
  const ws = wb.addWorksheet('Patients')

  // Header row
  const headerRow = ws.getRow(1)
  headerRow.getCell(1).value = 'Field'
  for (let i = 1; i <= 10; i++) headerRow.getCell(i + 1).value = `Patient ${i}`

  // Style header
  for (let c = 1; c <= 11; c++) {
    const cell = headerRow.getCell(c)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } }
    cell.alignment = { horizontal: 'center' }
  }

  // Field rows
  FIELDS.forEach((f, i) => {
    const row = ws.getRow(i + 2)
    row.getCell(1).value = f.name

    // Fill examples for Patient 1 & 2
    if (f.example1) row.getCell(2).value = f.example1
    if (f.example2) row.getCell(3).value = f.example2

    // Style field label
    const labelCell = row.getCell(1)
    labelCell.font = { bold: f.name.includes('*') }
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } }

    // Add note as comment on field label
    labelCell.note = f.note
  })

  // Column widths
  ws.getColumn(1).width = 22
  for (let c = 2; c <= 11; c++) ws.getColumn(c).width = 28

  // ── Sheet 2: Instructions ──
  const ins = wb.addWorksheet('Instructions')

  // Header
  const insHeader = ins.getRow(1)
  const insHeaders = ['Field', 'Required In', 'Format / Values', 'Example']
  insHeaders.forEach((h, i) => {
    const cell = insHeader.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } }
  })

  FIELDS.forEach((f, i) => {
    const row = ins.getRow(i + 2)
    row.getCell(1).value = f.name
    row.getCell(2).value = f.required || 'Optional'
    row.getCell(3).value = f.note
    row.getCell(4).value = f.example1 || f.example2 || '—'

    if (f.name.includes('*')) {
      row.getCell(1).font = { bold: true }
    }
  })

  // Mode notes
  const modeRow = ins.getRow(FIELDS.length + 4)
  modeRow.getCell(1).value = 'Mode Guide'
  modeRow.getCell(1).font = { bold: true, size: 12 }

  const modes = [
    ['Full Batch', 'All * fields + ICD required. Generates SOAP + fills ICD/CPT + billing in MDLand.'],
    ['SOAP Only', 'All * fields except ICD/CPT. Generates SOAP notes only, no MDLand automation.'],
    ['Continue', 'Patient/Gender/Insurance/TotalVisits + SoapText required. Continues TX from existing SOAP.'],
  ]
  modes.forEach((m, i) => {
    const r = FIELDS.length + 5 + i
    ins.mergeCells(r, 2, r, 4)
    const row = ins.getRow(r)
    row.getCell(1).value = m[0]
    row.getCell(1).font = { bold: true }
    row.getCell(2).value = m[1]
  })

  // Column widths
  ins.getColumn(1).width = 22
  ins.getColumn(2).width = 16
  ins.getColumn(3).width = 60
  ins.getColumn(4).width = 30

  const outPath = path.resolve(__dirname, '../templates/batch-template.xlsx')
  await wb.xlsx.writeFile(outPath)
  console.log('Template written to', outPath)
}

main()

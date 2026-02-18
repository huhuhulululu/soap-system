/**
 * Excel 模板生成脚本 — 纵向布局 + 下拉框验证
 *
 * Col A = 字段名, Col B+ = 每个患者
 * 运行: npx tsx scripts/create-template.ts
 */

import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'

interface FieldDef {
  key: string
  label: string
  dropdown?: string[]
  note?: string
}

const fields: FieldDef[] = [
  { key: 'Patient', label: 'Patient *', note: 'NAME(MM/DD/YYYY)' },
  { key: 'Gender', label: 'Gender *', dropdown: ['M', 'F'] },
  { key: 'Insurance', label: 'Insurance *', dropdown: ['HF', 'OPTUM', 'WC', 'VC', 'ELDERPLAN', 'NONE'] },
  { key: 'BodyPart', label: 'BodyPart *', dropdown: [
    'LBP', 'NECK', 'SHOULDER', 'KNEE', 'HIP', 'ELBOW',
    'UPPER_BACK', 'MIDDLE_BACK', 'MID_LOW_BACK',
    'WRIST', 'HAND', 'ANKLE', 'FOOT',
    'THIGH', 'CALF', 'ARM', 'FOREARM',
  ]},
  { key: 'Laterality', label: 'Laterality *', dropdown: ['B', 'L', 'R'] },
  { key: 'ICD', label: 'ICD', note: 'Comma-separated, e.g. M54.50,M54.41' },
  { key: 'CPT', label: 'CPT', note: 'e.g. 97810,97811x3' },
  { key: 'TotalVisits', label: 'TotalVisits *', note: '1-30 (1 IE + N-1 TX)' },
  { key: 'PainWorst', label: 'PainWorst', dropdown: ['10','9','8','7','6','5','4','3','2','1','0'] },
  { key: 'PainBest', label: 'PainBest', dropdown: ['10','9','8','7','6','5','4','3','2','1','0'] },
  { key: 'PainCurrent', label: 'PainCurrent', dropdown: ['10','9','8','7','6','5','4','3','2','1','0'] },
  { key: 'SymptomDuration', label: 'SymptomDuration', note: 'e.g. 3 year(s)' },
  { key: 'PainRadiation', label: 'PainRadiation', dropdown: ['without radiation', 'with radiation to R arm', 'with radiation to L arm', 'with radiation to R leg', 'with radiation to L leg', 'with radiation to bilateral legs'] },
  { key: 'PainTypes', label: 'PainTypes', dropdown: ['Dull,Aching', 'Dull,Stabbing', 'Aching,Stabbing', 'Dull', 'Aching', 'Stabbing', 'Sharp', 'Burning', 'Throbbing'] },
  { key: 'AssociatedSymptoms', label: 'AssociatedSymptoms', dropdown: ['soreness', 'tightness', 'stiffness', 'weakness', 'numbness', 'soreness,stiffness', 'tightness,weakness', 'stiffness,soreness'] },
  { key: 'CausativeFactors', label: 'CausativeFactors', note: 'Comma-separated' },
  { key: 'RelievingFactors', label: 'RelievingFactors', note: 'Comma-separated' },
  { key: 'SymptomScale', label: 'SymptomScale', dropdown: ['90%-100%', '80%-90%', '70%-80%', '60%-70%', '50%-60%', '40%-50%'] },
  { key: 'PainFrequency', label: 'PainFrequency', dropdown: ['Constant', 'Frequent', 'Occasional', 'Intermittent'] },
  { key: 'SecondaryParts', label: 'SecondaryParts', note: 'e.g. NECK,SHOULDER' },
  { key: 'History', label: 'History', note: 'e.g. Hypertension,Diabetes or N/A' },
]

const sampleData: Record<string, string | number>[] = [
  {
    Patient: 'CHEN,AIJIN(09/27/1956)', Gender: 'F', Insurance: 'HF',
    BodyPart: 'LBP', Laterality: 'B', ICD: 'M54.50,M54.41', CPT: '97810,97811x3',
    TotalVisits: 12, PainWorst: '8', PainBest: '3', PainCurrent: '6',
    SymptomDuration: '3 year(s)', PainRadiation: 'without radiation',
    PainTypes: 'Dull,Aching', AssociatedSymptoms: 'soreness',
    CausativeFactors: 'age related/degenerative changes',
    RelievingFactors: 'Changing positions,Resting,Massage',
    SymptomScale: '70%-80%', PainFrequency: 'Constant',
    SecondaryParts: '', History: 'Hypertension',
  },
  {
    Patient: 'WANG,MEI(03/15/1960)', Gender: 'F', Insurance: 'WC',
    BodyPart: 'SHOULDER', Laterality: 'R', ICD: 'M75.11,M25.511', CPT: '',
    TotalVisits: 8, PainWorst: '7', PainBest: '2', PainCurrent: '5',
    SymptomDuration: '6 month(s)', PainRadiation: 'with radiation to R arm',
    PainTypes: 'Dull,Stabbing', AssociatedSymptoms: 'stiffness,soreness',
    CausativeFactors: 'over used due to heavy household chores',
    RelievingFactors: 'Resting,Applying heating pad',
    SymptomScale: '60%-70%', PainFrequency: 'Frequent',
    SecondaryParts: 'NECK', History: 'Diabetes,Osteoporosis',
  },
]

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
const LABEL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
const REQ_FONT: Partial<ExcelJS.Font> = { bold: true, size: 11 }

async function main() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Patients')

  // Row 1: header — "Field", "Patient 1", "Patient 2", ...
  const headerRow = ws.getRow(1)
  headerRow.getCell(1).value = 'Field'
  headerRow.getCell(1).fill = HEADER_FILL
  headerRow.getCell(1).font = HEADER_FONT
  for (let p = 0; p < 10; p++) {
    const cell = headerRow.getCell(p + 2)
    cell.value = `Patient ${p + 1}`
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
  }

  // Rows 2+: one field per row
  for (let f = 0; f < fields.length; f++) {
    const field = fields[f]
    const rowNum = f + 2
    const row = ws.getRow(rowNum)

    // Col A: field label
    const labelCell = row.getCell(1)
    labelCell.value = field.label
    labelCell.fill = LABEL_FILL
    if (field.label.endsWith('*')) labelCell.font = REQ_FONT

    // Add note as comment if present
    if (field.note) {
      labelCell.note = field.note
    }

    // Col B+: sample data + dropdown validation
    for (let p = 0; p < 10; p++) {
      const cell = row.getCell(p + 2)

      // Fill sample data for first 2 patients
      if (p < sampleData.length) {
        cell.value = sampleData[p][field.key] ?? ''
      }

      // Add dropdown validation
      if (field.dropdown) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${field.dropdown.join(',')}"`],
          showErrorMessage: true,
          errorTitle: field.key,
          error: `Valid: ${field.dropdown.slice(0, 5).join(', ')}`,
        }
      }
    }
  }

  // Column widths
  ws.getColumn(1).width = 22
  for (let p = 2; p <= 11; p++) ws.getColumn(p).width = 30

  // Freeze first column + first row
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]

  const outDir = path.resolve(__dirname, '../templates')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'batch-template.xlsx')
  await wb.xlsx.writeFile(outPath)
  process.stdout.write(`Template created: ${outPath}\n`)
}

main()

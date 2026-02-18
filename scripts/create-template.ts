/**
 * Excel 模板生成脚本
 *
 * 生成 batch-template.xlsx 供用户下载
 * 运行: npx tsx scripts/create-template.ts
 */

import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'

const headers = [
  'Patient',
  'Gender',
  'Insurance',
  'BodyPart',
  'Laterality',
  'ICD',
  'CPT',
  'TotalVisits',
  'PainWorst',
  'PainBest',
  'PainCurrent',
  'SymptomDuration',
  'PainRadiation',
  'PainTypes',
  'AssociatedSymptoms',
  'CausativeFactors',
  'RelievingFactors',
  'SymptomScale',
  'PainFrequency',
  'SecondaryParts',
  'History',
]

const sampleRows = [
  [
    'CHEN,AIJIN(09/27/1956)', 'F', 'HF', 'LBP', 'B',
    'M54.50,M54.41', '97810,97811x3', 12,
    8, 3, 6, '3 year(s)', 'without radiation',
    'Dull,Aching', 'soreness',
    'age related/degenerative changes',
    'Changing positions,Resting,Massage',
    '70%-80%', 'Constant',
    '', 'Hypertension',
  ],
  [
    'WANG,MEI(03/15/1960)', 'F', 'WC', 'SHOULDER', 'R',
    'M75.11,M25.511', '', 8,
    7, 2, 5, '6 month(s)', 'with radiation to R arm',
    'Dull,Stabbing', 'stiffness,soreness',
    'over used due to heavy household chores',
    'Resting,Applying heating pad',
    '60%-70%', 'Frequent',
    'NECK', 'Diabetes,Osteoporosis',
  ],
  [
    'LI,HONG(11/20/1965)', 'M', 'OPTUM', 'KNEE', 'L',
    'M25.562,M17.12', '', 10,
    9, 4, 7, 'many year(s)', 'without radiation',
    'Aching,Stabbing', 'weakness,stiffness',
    'age related/degenerative changes,prolong walking',
    'Resting,Massage,Medications',
    '80%-90%', 'Constant',
    '', 'Hypertension,Cholesterol',
  ],
]

const colWidths = [30, 8, 12, 14, 12, 20, 20, 12, 10, 10, 12, 16, 25, 20, 20, 35, 35, 12, 14, 20, 25]

const instructionRows = [
  ['=== Batch Template Instructions ==='],
  ['Full Batch: fills ALL columns (ICD, CPT required)'],
  ['SOAP Only: leave ICD & CPT empty, only SOAP notes generated'],
  [],
  ['Column', 'Required', 'Description', 'Example', 'Valid Values'],
  ['Patient', 'Yes', 'NAME(MM/DD/YYYY)', 'CHEN,AIJIN(09/27/1956)', ''],
  ['Gender', 'Yes', 'M or F', 'F', 'M, F'],
  ['Insurance', 'Yes', 'Insurance type', 'HF', 'HF, OPTUM, WC, VC, ELDERPLAN, NONE'],
  ['BodyPart', 'Yes', 'Primary body part', 'LBP', 'LBP, NECK, SHOULDER, KNEE, etc.'],
  ['Laterality', 'Yes', 'Side', 'B', 'B, L, R'],
  ['ICD', 'Full only', 'Comma-separated ICD-10', 'M54.50,M54.41', ''],
  ['CPT', 'Full only', 'CPT with units', '97810,97811x3', ''],
  ['TotalVisits', 'Yes', '1 IE + (N-1) TX', '12', '1-30'],
  ['PainWorst', 'Default: 8', '0-10', '8', ''],
  ['PainBest', 'Default: 3', '0-10', '3', ''],
  ['PainCurrent', 'Default: 6', '0-10, determines severity', '6', ''],
  ['SymptomDuration', 'Default: 3 year(s)', 'N unit(s)', '3 year(s)', ''],
  ['PainRadiation', 'Default: without', 'Radiation description', 'without radiation', ''],
  ['PainTypes', 'Default: Dull,Aching', 'Comma-separated', 'Dull,Aching', ''],
  ['AssociatedSymptoms', 'Default: soreness', 'Comma-separated', 'soreness', ''],
  ['CausativeFactors', 'Default: age related', 'Comma-separated', 'age related/degenerative changes', ''],
  ['RelievingFactors', 'Default: multiple', 'Comma-separated', 'Resting,Massage', ''],
  ['SymptomScale', 'Default: 70%-80%', 'Percentage', '70%-80%', ''],
  ['PainFrequency', 'Default: Constant', 'Shorthand', 'Constant', 'Intermittent, Occasional, Frequent, Constant'],
  ['SecondaryParts', 'No', 'Additional body parts', 'NECK,SHOULDER', ''],
  ['History', 'No', 'Medical history', 'Hypertension,Diabetes', ''],
]

async function main() {
  const wb = new ExcelJS.Workbook()

  // Patients sheet
  const ws = wb.addWorksheet('Patients')
  ws.addRow(headers)
  for (const row of sampleRows) ws.addRow(row)
  ws.columns.forEach((col, i) => { col.width = colWidths[i] ?? 15 })

  // Instructions sheet
  const wsI = wb.addWorksheet('Instructions')
  for (const row of instructionRows) wsI.addRow(row)
  const iWidths = [20, 28, 55, 35, 65]
  wsI.columns.forEach((col, i) => { col.width = iWidths[i] ?? 20 })

  const outDir = path.resolve(__dirname, '../templates')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const outPath = path.join(outDir, 'batch-template.xlsx')
  await wb.xlsx.writeFile(outPath)
  process.stdout.write(`Template created: ${outPath}\n`)
}

main()

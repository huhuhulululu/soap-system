/**
 * Excel 模板生成脚本
 *
 * 生成 batch-template.xlsx 供用户下载
 * 运行: npx tsx scripts/create-template.ts
 */

import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

const headers = [
  'DOS',
  'Patient',
  'Gender',
  'Insurance',
  'BodyPart',
  'Laterality',
  'NoteType',
  'ICD',
  'CPT',
  'SecondaryParts',
  'History',
]

const sampleRows = [
  [1, 'CHEN,AIJIN(09/27/1956)', 'F', 'HF', 'LBP', 'B', 'IE', 'M54.50,M54.41', '97810,97811x3', '', ''],
  [2, 'CHEN,AIJIN(09/27/1956)', 'F', 'HF', 'LBP', 'B', 'TX', '', '', '', ''],
  [3, 'CHEN,AIJIN(09/27/1956)', 'F', 'HF', 'LBP', 'B', 'TX', '', '', '', ''],
  [4, 'CHEN,AIJIN(09/27/1956)', 'F', 'HF', 'LBP', 'B', 'RE', '', '97161', '', ''],
  [1, 'WANG,MEI(03/15/1960)', 'F', 'WC', 'SHOULDER', 'R', 'IE', 'M75.11,M25.511', '', 'NECK', 'HTN,DM'],
  [2, 'WANG,MEI(03/15/1960)', 'F', 'WC', 'SHOULDER', 'R', 'TX', '', '', '', ''],
]

const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows])

// 设置列宽
ws['!cols'] = [
  { wch: 6 },   // DOS
  { wch: 30 },  // Patient
  { wch: 8 },   // Gender
  { wch: 12 },  // Insurance
  { wch: 14 },  // BodyPart
  { wch: 12 },  // Laterality
  { wch: 10 },  // NoteType
  { wch: 20 },  // ICD
  { wch: 20 },  // CPT
  { wch: 20 },  // SecondaryParts
  { wch: 20 },  // History
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Batch')

// 添加说明 sheet
const instructionData = [
  ['Column', 'Required', 'Description', 'Example'],
  ['DOS', 'Yes', 'Visit number (1, 2, 3...)', '1'],
  ['Patient', 'Yes', 'Name and DOB: NAME(MM/DD/YYYY)', 'CHEN,AIJIN(09/27/1956)'],
  ['Gender', 'Yes', 'M or F', 'F'],
  ['Insurance', 'Yes', 'HF, OPTUM, WC, VC, ELDERPLAN, NONE', 'HF'],
  ['BodyPart', 'Yes', 'LBP, NECK, SHOULDER, KNEE, etc.', 'LBP'],
  ['Laterality', 'Yes', 'B (bilateral), L (left), R (right)', 'B'],
  ['NoteType', 'Yes', 'IE (Initial), TX (Treatment), RE (Re-eval)', 'IE'],
  ['ICD', 'IE only', 'Comma-separated ICD-10 codes. TX inherits from IE.', 'M54.50,M54.41'],
  ['CPT', 'Optional', 'Comma-separated CPT codes with units. Empty TX = auto-fill.', '97810,97811x3'],
  ['SecondaryParts', 'Optional', 'Comma-separated additional body parts', 'NECK,SHOULDER'],
  ['History', 'Optional', 'Comma-separated medical history', 'HTN,DM,Pacemaker'],
]

const wsInstructions = XLSX.utils.aoa_to_sheet(instructionData)
wsInstructions['!cols'] = [
  { wch: 16 },
  { wch: 10 },
  { wch: 55 },
  { wch: 25 },
]
XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')

const outDir = path.resolve(__dirname, '../templates')
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const outPath = path.join(outDir, 'batch-template.xlsx')
XLSX.writeFile(wb, outPath)

console.log(`Template created: ${outPath}`)

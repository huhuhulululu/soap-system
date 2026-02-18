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

const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows])

// 设置列宽
ws['!cols'] = [
  { wch: 30 },  // Patient
  { wch: 8 },   // Gender
  { wch: 12 },  // Insurance
  { wch: 14 },  // BodyPart
  { wch: 12 },  // Laterality
  { wch: 20 },  // ICD
  { wch: 20 },  // CPT
  { wch: 12 },  // TotalVisits
  { wch: 10 },  // PainWorst
  { wch: 10 },  // PainBest
  { wch: 12 },  // PainCurrent
  { wch: 16 },  // SymptomDuration
  { wch: 25 },  // PainRadiation
  { wch: 20 },  // PainTypes
  { wch: 20 },  // AssociatedSymptoms
  { wch: 35 },  // CausativeFactors
  { wch: 35 },  // RelievingFactors
  { wch: 12 },  // SymptomScale
  { wch: 14 },  // PainFrequency
  { wch: 20 },  // SecondaryParts
  { wch: 25 },  // History
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Patients')

// 添加说明 sheet
const instructionData = [
  ['Column', 'Required', 'Description', 'Example', 'Valid Values'],
  ['Patient', 'Yes', 'Name and DOB: NAME(MM/DD/YYYY)', 'CHEN,AIJIN(09/27/1956)', ''],
  ['Gender', 'Yes', 'M or F', 'F', 'M, F'],
  ['Insurance', 'Yes', 'Insurance type', 'HF', 'HF, OPTUM, WC, VC, ELDERPLAN, NONE'],
  ['BodyPart', 'Yes', 'Primary body part', 'LBP', 'LBP, NECK, SHOULDER, KNEE, ELBOW, HIP, MID_LOW_BACK, etc.'],
  ['Laterality', 'Yes', 'Side', 'B', 'B (bilateral), L (left), R (right)'],
  ['ICD', 'Yes', 'Comma-separated ICD-10 codes', 'M54.50,M54.41', ''],
  ['CPT', 'No', 'Comma-separated CPT codes with units. Empty TX = auto-fill by insurance.', '97810,97811x3', ''],
  ['TotalVisits', 'Yes', 'Total visits including IE. System generates 1 IE + (N-1) TX.', '12', '1-30'],
  ['PainWorst', 'Default: 8', 'Worst pain level (0-10)', '8', '0-10'],
  ['PainBest', 'Default: 3', 'Best pain level (0-10)', '3', '0-10'],
  ['PainCurrent', 'Default: 6', 'Current pain level (0-10). Determines severity.', '6', '0-10'],
  ['SymptomDuration', 'Default: 3 year(s)', 'How long symptoms have lasted', '3 year(s)', 'N year(s), N month(s), N week(s), N day(s)'],
  ['PainRadiation', 'Default: without radiation', 'Pain radiation description', 'without radiation', 'without radiation, with radiation to R arm, with radiation to L arm, with dizziness, etc.'],
  ['PainTypes', 'Default: Dull,Aching', 'Comma-separated pain types', 'Dull,Aching', 'Dull, Burning, Freezing, Shooting, Tingling, Stabbing, Aching, Squeezing, Cramping'],
  ['AssociatedSymptoms', 'Default: soreness', 'Comma-separated symptoms', 'soreness', 'soreness, stiffness, heaviness, weakness, numbness'],
  ['CausativeFactors', 'Default: age related', 'Comma-separated causes', 'age related/degenerative changes', 'age related/degenerative changes, weather change, poor sleep, prolong walking, etc.'],
  ['RelievingFactors', 'Default: Changing positions,Resting,Massage', 'Comma-separated relief methods', 'Changing positions,Resting', 'Moving around, Changing positions, Stretching, Resting, Lying down, Applying heating pad, Massage, Medications'],
  ['SymptomScale', 'Default: 70%-80%', 'Symptom percentage scale', '70%-80%', '10%, 10%-20%, 20%, ... 100%'],
  ['PainFrequency', 'Default: Constant', 'Pain frequency (shorthand)', 'Constant', 'Intermittent, Occasional, Frequent, Constant'],
  ['SecondaryParts', 'No', 'Comma-separated additional body parts', 'NECK,SHOULDER', ''],
  ['History', 'No', 'Comma-separated medical history', 'Hypertension,Diabetes', 'Hypertension, Diabetes, Heart Disease, Pacemaker, Osteoporosis, Joint Replacement, etc.'],
]

const wsInstructions = XLSX.utils.aoa_to_sheet(instructionData)
wsInstructions['!cols'] = [
  { wch: 20 },  // Column
  { wch: 28 },  // Required
  { wch: 55 },  // Description
  { wch: 35 },  // Example
  { wch: 65 },  // Valid Values
]
XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')

const outDir = path.resolve(__dirname, '../templates')
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const outPath = path.join(outDir, 'batch-template.xlsx')
XLSX.writeFile(wb, outPath)

console.log(`Template created: ${outPath}`)

// S0(b) 真实 parser 调用版本：import 真实模块
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { Window } from '../frontend/node_modules/happy-dom/lib/index.js'
import { parseBillListHtml } from '../frontend/src/services/bill-list-parser'

const here = dirname(fileURLToPath(import.meta.url))
const SAMPLE = resolve(here, '../0416/InsurancePatientPaymentDetail.xls')

const win = new Window()
;(globalThis as any).DOMParser = win.DOMParser

const GOLDEN = [
  { dos: '07/14/2025', icd: ['M54.6', 'M54.50'], cpt: ['9920325', '97813', '97811', '97814'], charge: 690.0 },
  { dos: '08/04/2025', icd: ['M54.6', 'M54.50'], cpt: ['97813', '97811', '97814'], charge: 490.0 },
  { dos: '08/06/2025', icd: ['M54.6', 'M54.50'], cpt: ['97813', '97811', '97814'], charge: 490.0 },
  { dos: '08/25/2025', icd: ['M54.6', 'M54.50'], cpt: ['97813', '97811', '97814'], charge: 490.0 },
  { dos: '08/27/2025', icd: ['M54.6', 'M54.50'], cpt: ['97813', '97811', '97814'], charge: 490.0 },
  { dos: '11/03/2025', icd: ['M54.50'], cpt: ['97810', '97811'], charge: 230.0 },
  { dos: '11/05/2025', icd: ['M54.50'], cpt: ['97813', '97814'], charge: 270.0 },
]

const bill = parseBillListHtml(readFileSync(SAMPLE, 'utf8'))
assert.equal(bill.rows.length, 7, `expected 7 rows, got ${bill.rows.length}`)
bill.rows.forEach((r, i) => assert.deepStrictEqual(
  { dos: r.dos, icd: r.icd, cpt: r.cpt, charge: r.charge },
  GOLDEN[i],
  `row[${i}] mismatch`,
))
console.log('✓ S0(b) smoke pass: 7 rows match Golden Fixture (via real parseBillListHtml)')

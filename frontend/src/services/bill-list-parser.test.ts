import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseBillListHtml, detectBillFormat } from './bill-list-parser'

const here = dirname(fileURLToPath(import.meta.url))
const SAMPLE_PATH = resolve(here, '../../../0416/InsurancePatientPaymentDetail.xls')
const sampleHtml = readFileSync(SAMPLE_PATH, 'utf8')

const GOLDEN_ROWS = [
  { dos: '07/14/2025', icd: ['M54.6', 'M54.50'], cpt: ['9920325', '97813', '97811', '97814'], charge: 690.0 },
  { dos: '08/04/2025', icd: ['M54.6', 'M54.50'], cpt: ['97813', '97811', '97814'], charge: 490.0 },
  { dos: '08/06/2025', icd: ['M54.6', 'M54.50'], cpt: ['97813', '97811', '97814'], charge: 490.0 },
  { dos: '08/25/2025', icd: ['M54.6', 'M54.50'], cpt: ['97813', '97811', '97814'], charge: 490.0 },
  { dos: '08/27/2025', icd: ['M54.6', 'M54.50'], cpt: ['97813', '97811', '97814'], charge: 490.0 },
  { dos: '11/03/2025', icd: ['M54.50'], cpt: ['97810', '97811'], charge: 230.0 },
  { dos: '11/05/2025', icd: ['M54.50'], cpt: ['97813', '97814'], charge: 270.0 },
]

describe('parseBillListHtml - 0416 Golden Fixture', () => {
  it('extracts exactly 7 DOS rows with matching dos/icd/cpt/charge', () => {
    const bill = parseBillListHtml(sampleHtml)
    expect(bill.rows).toHaveLength(7)
    bill.rows.forEach((row, i) => {
      expect({ dos: row.dos, icd: row.icd, cpt: row.cpt, charge: row.charge }).toEqual(GOLDEN_ROWS[i])
    })
  })

  it('extracts patient / insurance / totalCharge correctly', () => {
    const bill = parseBillListHtml(sampleHtml)
    expect(bill.patient).toBe('ZHENG, BIFANG')
    expect(bill.insurance).toBe('ELDERPLAN, INC')
    expect(bill.totalCharge).toBeCloseTo(3150.0, 2)
  })
})

describe('parseBillListHtml - error handling', () => {
  it('throws when #listTable is missing', () => {
    expect(() => parseBillListHtml('<html><body><p>no table</p></body></html>'))
      .toThrow(/listTable not found/)
  })

  it('detectBillFormat identifies XLSX binary by magic bytes', () => {
    const xlsxMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
    expect(detectBillFormat(xlsxMagic)).toBe('xlsx-binary')
  })

  it('detectBillFormat identifies HTML by <table> marker', () => {
    expect(detectBillFormat('<html><body><table id="listTable">')).toBe('html')
    expect(detectBillFormat('<!DOCTYPE html><html></html>')).toBe('html')
    expect(detectBillFormat('<table border="0">hi</table>')).toBe('html')
  })

  it('detectBillFormat returns unknown for plain text', () => {
    expect(detectBillFormat('just some random text')).toBe('unknown')
    expect(detectBillFormat(new Uint8Array([0x41, 0x42, 0x43]))).toBe('unknown')
  })

  it('skips rows with malformed DOS', () => {
    const html = `<table id="listTable"><tbody>
      <tr><td>NAME</td><td>ID</td><td>bad-dos</td><td></td><td></td><td></td><td></td><td>INS</td><td>M00</td><td colspan="7"><table><tr><td>99999</td><td>1</td><td>10.00</td></tr></table></td><td></td></tr>
      <tr><td>NAME</td><td>ID</td><td>01/02/2025</td><td></td><td></td><td></td><td></td><td>INS</td><td>M01</td><td colspan="7"><table><tr><td>88888</td><td>1</td><td>20.00</td></tr></table></td><td></td></tr>
    </tbody></table>`
    const bill = parseBillListHtml(html)
    expect(bill.rows).toHaveLength(1)
    expect(bill.rows[0].dos).toBe('01/02/2025')
  })
})

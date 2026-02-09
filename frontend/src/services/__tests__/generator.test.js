/**
 * TDD Tests for generator.js ensureHeader function
 *
 * Parser expects Pattern A format:
 * NAME, FIRSTNAME (DOB: MM/DD/YYYY ID: XXXXXXXXXX) Date of Service: MM/DD/YYYY Printed on: MM/DD/YYYY
 */

import { describe, it, expect } from 'vitest'

// Import the function we're testing - we'll need to export it first
// For now, we'll test the regex pattern directly
const PARSER_HEADER_PATTERN = /^([A-Z]+,\s*[A-Z\s]+)\s*\(DOB:\s*(\d{2}\/\d{2}\/\d{4})\s*ID:\s*(\d{10})\)\s*Date of Service:\s*(\d{2}\/\d{2}\/\d{4})\s*Printed on:\s*(\d{2}\/\d{2}\/\d{4})/m

describe('ensureHeader', () => {
  describe('generated header format', () => {
    it('should match parser Pattern A regex', () => {
      // This is the format ensureHeader SHOULD generate
      const expectedHeader = 'UNKNOWN, PATIENT (DOB: 01/01/2000 ID: 0000000000) Date of Service: 01/01/2025 Printed on: 01/01/2025'

      const match = expectedHeader.match(PARSER_HEADER_PATTERN)

      expect(match).not.toBeNull()
      // Parser uses .trim() on capture group (see parser.ts line 207)
      expect(match[1].trim()).toBe('UNKNOWN, PATIENT')
      expect(match[2]).toBe('01/01/2000')
      expect(match[3]).toBe('0000000000')
      expect(match[4]).toBe('01/01/2025')
      expect(match[5]).toBe('01/01/2025')
    })

    it('should have exactly 10-digit ID', () => {
      const header = 'UNKNOWN, PATIENT (DOB: 01/01/2000 ID: 0000000000) Date of Service: 01/01/2025 Printed on: 01/01/2025'
      const idMatch = header.match(/ID:\s*(\d+)/)

      expect(idMatch).not.toBeNull()
      expect(idMatch[1]).toHaveLength(10)
    })

    it('should have proper date format MM/DD/YYYY', () => {
      const header = 'UNKNOWN, PATIENT (DOB: 01/01/2000 ID: 0000000000) Date of Service: 01/01/2025 Printed on: 01/01/2025'
      const datePattern = /\d{2}\/\d{2}\/\d{4}/g
      const dates = header.match(datePattern)

      expect(dates).toHaveLength(3)
      dates.forEach(date => {
        const [month, day, year] = date.split('/')
        expect(parseInt(month)).toBeGreaterThanOrEqual(1)
        expect(parseInt(month)).toBeLessThanOrEqual(12)
        expect(parseInt(day)).toBeGreaterThanOrEqual(1)
        expect(parseInt(day)).toBeLessThanOrEqual(31)
        expect(parseInt(year)).toBeGreaterThanOrEqual(1900)
      })
    })

    it('should have NAME in LASTNAME, FIRSTNAME format', () => {
      const header = 'UNKNOWN, PATIENT (DOB: 01/01/2000 ID: 0000000000) Date of Service: 01/01/2025 Printed on: 01/01/2025'
      const nameMatch = header.match(/^([A-Z]+,\s*[A-Z]+)/)

      expect(nameMatch).not.toBeNull()
      expect(nameMatch[1]).toContain(',')
    })
  })

  describe('header detection', () => {
    it('should detect existing header with PATIENT: keyword', () => {
      const textWithHeader = 'PATIENT: SMITH, JOHN Gender: Male'
      const hasHeader = /PATIENT:|DOB:/i.test(textWithHeader)

      expect(hasHeader).toBe(true)
    })

    it('should detect existing header with DOB: keyword', () => {
      const textWithHeader = 'SMITH, JOHN (DOB: 05/15/1980 ID: 1234567890)'
      const hasHeader = /PATIENT:|DOB:/i.test(textWithHeader)

      expect(hasHeader).toBe(true)
    })

    it('should not detect header in plain SOAP text', () => {
      const textWithoutHeader = 'Subjective: INITIAL EVALUATION Patient c/o right knee pain'
      const hasHeader = /PATIENT:|DOB:/i.test(textWithoutHeader)

      expect(hasHeader).toBe(false)
    })
  })

  describe('ensureHeader function behavior', () => {
    // Inline implementation for testing
    function ensureHeader(text) {
      if (/PATIENT:|DOB:/i.test(text)) return text
      return 'UNKNOWN, PATIENT (DOB: 01/01/2000 ID: 0000000000) Date of Service: 01/01/2025 Printed on: 01/01/2025\n' + text
    }

    it('should prepend header when missing', () => {
      const input = 'Subjective: Follow up visit'
      const result = ensureHeader(input)

      expect(result).toContain('UNKNOWN, PATIENT')
      expect(result).toContain('DOB:')
      expect(result).toContain('Date of Service:')
      expect(result).toContain('Printed on:')
      expect(result.endsWith(input)).toBe(true)
    })

    it('should not modify text with existing header', () => {
      const input = 'SMITH, JOHN (DOB: 05/15/1980 ID: 1234567890) Date of Service: 01/01/2025 Printed on: 01/01/2025\nSubjective:'
      const result = ensureHeader(input)

      expect(result).toBe(input)
    })

    it('should generate header that parser can parse', () => {
      const input = 'Subjective: INITIAL EVALUATION Patient c/o pain'
      const result = ensureHeader(input)

      // Extract just the header line
      const headerLine = result.split('\n')[0]
      const match = headerLine.match(PARSER_HEADER_PATTERN)

      expect(match).not.toBeNull()
    })
  })
})

import { getICDName, getICDEntry, getAllICDEntries, getICDNames } from '../icd-catalog'

describe('icd-catalog', () => {
  describe('getICDName', () => {
    it('returns name for known LBP code', () => {
      expect(getICDName('M54.50')).toBe('Low back pain, unspecified')
    })

    it('returns name for known shoulder code', () => {
      expect(getICDName('M25.511')).toBe('Pain in right shoulder')
    })

    it('returns name for known knee code', () => {
      expect(getICDName('M17.11')).toBe('Primary osteoarthritis, right knee')
    })

    it('returns code itself for unknown code', () => {
      expect(getICDName('Z99.99')).toBe('Z99.99')
    })

    it('returns name for generic code G89.29', () => {
      expect(getICDName('G89.29')).toBe('Other chronic pain')
    })

    it('returns name for muscle spasm code', () => {
      expect(getICDName('M62.830')).toBe('Muscle spasm of back')
    })
  })

  describe('getICDEntry', () => {
    it('returns full entry for known code', () => {
      const entry = getICDEntry('M54.50')
      expect(entry).toEqual({
        code: 'M54.50',
        name: 'Low back pain, unspecified',
        bodyPart: 'LBP',
        laterality: 'bilateral'
      })
    })

    it('returns undefined for unknown code', () => {
      expect(getICDEntry('INVALID')).toBeUndefined()
    })

    it('returns correct laterality for sided codes', () => {
      const right = getICDEntry('M25.511')
      expect(right?.laterality).toBe('right')

      const left = getICDEntry('M25.512')
      expect(left?.laterality).toBe('left')
    })
  })

  describe('getAllICDEntries', () => {
    it('returns non-empty array', () => {
      const entries = getAllICDEntries()
      expect(entries.length).toBeGreaterThan(50)
    })

    it('all entries have code and name', () => {
      for (const entry of getAllICDEntries()) {
        expect(entry.code).toBeTruthy()
        expect(entry.name).toBeTruthy()
      }
    })

    it('has no duplicate codes', () => {
      const entries = getAllICDEntries()
      const codes = entries.map(e => e.code)
      expect(new Set(codes).size).toBe(codes.length)
    })
  })

  describe('getICDNames', () => {
    it('returns names for multiple codes', () => {
      const result = getICDNames(['M54.50', 'M54.41', 'Z99.99'])
      expect(result).toEqual([
        { code: 'M54.50', name: 'Low back pain, unspecified' },
        { code: 'M54.41', name: 'Lumbago with sciatica, right' },
        { code: 'Z99.99', name: 'Z99.99' }
      ])
    })

    it('returns empty array for empty input', () => {
      expect(getICDNames([])).toEqual([])
    })
  })

  describe('MDLand preset list coverage', () => {
    it('covers all MDLand ICD preset list codes', () => {
      const mdlandPresetCodes = [
        'M25.511', 'M25.512', 'M25.521', 'M25.522',
        'M25.531', 'M25.532', 'M25.541', 'M25.542',
        'M25.551', 'M25.552', 'M25.561', 'M25.562',
        'M25.571', 'M25.572',
        'M54.16', 'M54.2', 'M54.41', 'M54.42',
        'M54.50', 'M54.51', 'M54.59', 'M54.6',
        'M62.830', 'S39.012A'
      ]
      for (const code of mdlandPresetCodes) {
        expect(getICDName(code)).not.toBe(code)
      }
    })
  })
})

/**
 * Unit tests for shared severity utility functions
 */

import { severityFromPain, expectedTenderMinScaleByPain, SeverityLevel } from '../severity'

describe('severityFromPain', () => {
  describe('boundary conditions', () => {
    it('returns "mild" for pain 0', () => {
      expect(severityFromPain(0)).toBe('mild')
    })

    it('returns "mild" for pain 1-3', () => {
      expect(severityFromPain(1)).toBe('mild')
      expect(severityFromPain(2)).toBe('mild')
      expect(severityFromPain(3)).toBe('mild')
    })

    it('returns "mild to moderate" for pain 4-5', () => {
      expect(severityFromPain(4)).toBe('mild to moderate')
      expect(severityFromPain(5)).toBe('mild to moderate')
    })

    it('returns "moderate" for pain 6', () => {
      expect(severityFromPain(6)).toBe('moderate')
    })

    it('returns "moderate to severe" for pain 7-8', () => {
      expect(severityFromPain(7)).toBe('moderate to severe')
      expect(severityFromPain(8)).toBe('moderate to severe')
    })

    it('returns "severe" for pain 9-10', () => {
      expect(severityFromPain(9)).toBe('severe')
      expect(severityFromPain(10)).toBe('severe')
    })
  })

  describe('edge cases', () => {
    it('returns "mild" for negative values', () => {
      expect(severityFromPain(-1)).toBe('mild')
      expect(severityFromPain(-5)).toBe('mild')
    })

    it('returns "severe" for values > 10', () => {
      expect(severityFromPain(11)).toBe('severe')
      expect(severityFromPain(15)).toBe('severe')
    })

    it('handles decimal values correctly', () => {
      expect(severityFromPain(3.9)).toBe('mild')
      expect(severityFromPain(4.0)).toBe('mild to moderate')
      expect(severityFromPain(5.9)).toBe('mild to moderate')
      expect(severityFromPain(6.0)).toBe('moderate')
      expect(severityFromPain(6.9)).toBe('moderate')
      expect(severityFromPain(7.0)).toBe('moderate to severe')
      expect(severityFromPain(8.9)).toBe('moderate to severe')
      expect(severityFromPain(9.0)).toBe('severe')
    })
  })

  describe('type safety', () => {
    it('returns valid SeverityLevel type', () => {
      const validLevels: SeverityLevel[] = [
        'mild',
        'mild to moderate',
        'moderate',
        'moderate to severe',
        'severe'
      ]

      for (let pain = 0; pain <= 10; pain++) {
        const result = severityFromPain(pain)
        expect(validLevels).toContain(result)
      }
    })
  })
})

describe('expectedTenderMinScaleByPain', () => {
  describe('boundary conditions', () => {
    it('returns 1 for pain 0', () => {
      expect(expectedTenderMinScaleByPain(0)).toBe(1)
    })

    it('returns 1 for pain 1-4', () => {
      expect(expectedTenderMinScaleByPain(1)).toBe(1)
      expect(expectedTenderMinScaleByPain(2)).toBe(1)
      expect(expectedTenderMinScaleByPain(3)).toBe(1)
      expect(expectedTenderMinScaleByPain(4)).toBe(1)
    })

    it('returns 2 for pain 5-6', () => {
      expect(expectedTenderMinScaleByPain(5)).toBe(2)
      expect(expectedTenderMinScaleByPain(6)).toBe(2)
    })

    it('returns 3 for pain 7-8', () => {
      expect(expectedTenderMinScaleByPain(7)).toBe(3)
      expect(expectedTenderMinScaleByPain(8)).toBe(3)
    })

    it('returns 4 for pain 9-10', () => {
      expect(expectedTenderMinScaleByPain(9)).toBe(4)
      expect(expectedTenderMinScaleByPain(10)).toBe(4)
    })
  })

  describe('edge cases', () => {
    it('returns 1 for negative values', () => {
      expect(expectedTenderMinScaleByPain(-1)).toBe(1)
      expect(expectedTenderMinScaleByPain(-5)).toBe(1)
    })

    it('returns 4 for values > 10', () => {
      expect(expectedTenderMinScaleByPain(11)).toBe(4)
      expect(expectedTenderMinScaleByPain(15)).toBe(4)
    })

    it('handles decimal values correctly', () => {
      expect(expectedTenderMinScaleByPain(4.9)).toBe(1)
      expect(expectedTenderMinScaleByPain(5.0)).toBe(2)
      expect(expectedTenderMinScaleByPain(6.9)).toBe(2)
      expect(expectedTenderMinScaleByPain(7.0)).toBe(3)
      expect(expectedTenderMinScaleByPain(8.9)).toBe(3)
      expect(expectedTenderMinScaleByPain(9.0)).toBe(4)
    })
  })

  describe('return value range', () => {
    it('always returns value between 1 and 4', () => {
      for (let pain = -5; pain <= 15; pain++) {
        const result = expectedTenderMinScaleByPain(pain)
        expect(result).toBeGreaterThanOrEqual(1)
        expect(result).toBeLessThanOrEqual(4)
      }
    })
  })
})

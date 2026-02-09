import { describe, it, expect } from 'vitest'
import { normalizeReport, calculateTrends } from './normalizer'

describe('normalizeReport', () => {
  it('should wrap timeline array with entries and trends', () => {
    const raw = {
      timeline: [
        { visitIndex: 0, visitType: 'IE', indicators: { pain: { value: 7 } } },
        { visitIndex: 1, visitType: 'TX', indicators: { pain: { value: 5 } } }
      ],
      errors: []
    }
    const result = normalizeReport(raw)
    expect(result.timeline.entries).toHaveLength(2)
    expect(result.timeline.trends).toBeDefined()
    expect(result.timeline.trends.painScale.direction).toBe('improving')
  })

  it('should normalize error location', () => {
    const raw = {
      timeline: [],
      errors: [{ visitIndex: 0, section: 'S', field: 'pain' }]
    }
    const result = normalizeReport(raw)
    expect(result.errors[0].location).toEqual({
      visitIndex: 0,
      section: 'S',
      field: 'pain'
    })
  })

  it('should preserve other report properties', () => {
    const raw = {
      timeline: [],
      errors: [],
      metadata: { patientId: '123' }
    }
    const result = normalizeReport(raw)
    expect(result.metadata).toEqual({ patientId: '123' })
  })

  it('should handle empty timeline', () => {
    const raw = {
      timeline: [],
      errors: []
    }
    const result = normalizeReport(raw)
    expect(result.timeline.entries).toHaveLength(0)
    expect(result.timeline.trends).toEqual({})
  })

  it('should handle single entry timeline', () => {
    const raw = {
      timeline: [
        { visitIndex: 0, visitType: 'IE', indicators: { pain: { value: 7 } } }
      ],
      errors: []
    }
    const result = normalizeReport(raw)
    expect(result.timeline.entries).toHaveLength(1)
    expect(result.timeline.trends.painScale.direction).toBe('stable')
  })
})

describe('calculateTrends', () => {
  it('should detect improving pain trend', () => {
    const entries = [
      { indicators: { pain: { value: 8 } } },
      { indicators: { pain: { value: 6 } } },
      { indicators: { pain: { value: 4 } } }
    ]
    const trends = calculateTrends(entries)
    expect(trends.painScale.direction).toBe('improving')
  })

  it('should detect worsening trend', () => {
    const entries = [
      { indicators: { pain: { value: 4 } } },
      { indicators: { pain: { value: 6 } } }
    ]
    const trends = calculateTrends(entries)
    expect(trends.painScale.direction).toBe('worsening')
  })

  it('should detect stable trend', () => {
    const entries = [
      { indicators: { pain: { value: 5 } } },
      { indicators: { pain: { value: 5 } } }
    ]
    const trends = calculateTrends(entries)
    expect(trends.painScale.direction).toBe('stable')
  })

  it('should return empty object for empty entries', () => {
    const trends = calculateTrends([])
    expect(trends).toEqual({})
  })

  it('should handle entries without pain indicator', () => {
    const entries = [
      { indicators: {} },
      { indicators: {} }
    ]
    const trends = calculateTrends(entries)
    expect(trends.painScale).toBeUndefined()
  })

  it('should calculate percentage change', () => {
    const entries = [
      { indicators: { pain: { value: 10 } } },
      { indicators: { pain: { value: 5 } } }
    ]
    const trends = calculateTrends(entries)
    expect(trends.painScale.percentChange).toBe(-50)
  })
})

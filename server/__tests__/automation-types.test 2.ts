import { describe, it, expect } from 'vitest'
import { classifyError, isPermanentError } from '../services/automation-types'

describe('classifyError', () => {
  it('returns session_expired for session expired error', () => {
    expect(classifyError(new Error('session expired'))).toBe('session_expired')
  })

  it('returns session_expired case-insensitively', () => {
    expect(classifyError(new Error('SESSION EXPIRED'))).toBe('session_expired')
  })

  it('returns patient_not_found for Patient not found error', () => {
    expect(classifyError(new Error('Patient not found'))).toBe('patient_not_found')
  })

  it('returns visit_not_found for Visit # not found error', () => {
    expect(classifyError(new Error('Visit #3 not found'))).toBe('visit_not_found')
  })

  it('returns timeout for TimeoutError by name', () => {
    const err = new Error('some timeout')
    err.name = 'TimeoutError'
    expect(classifyError(err)).toBe('timeout')
  })

  it('returns timeout for message containing timeout', () => {
    expect(classifyError(new Error('timeout waiting for selector'))).toBe('timeout')
  })

  it('returns element_not_found for element not found error', () => {
    expect(classifyError(new Error('element not found'))).toBe('element_not_found')
  })

  it('returns element_not_found for not accessible error', () => {
    expect(classifyError(new Error('not accessible'))).toBe('element_not_found')
  })

  it('returns unknown for unrecognized error', () => {
    expect(classifyError(new Error('unexpected crash'))).toBe('unknown')
  })

  it('returns unknown for raw string', () => {
    expect(classifyError('raw string error')).toBe('unknown')
  })
})

describe('isPermanentError', () => {
  it('returns true for session_expired', () => {
    expect(isPermanentError('session_expired')).toBe(true)
  })

  it('returns true for patient_not_found', () => {
    expect(isPermanentError('patient_not_found')).toBe(true)
  })

  it('returns true for visit_not_found', () => {
    expect(isPermanentError('visit_not_found')).toBe(true)
  })

  it('returns false for timeout', () => {
    expect(isPermanentError('timeout')).toBe(false)
  })

  it('returns false for element_not_found', () => {
    expect(isPermanentError('element_not_found')).toBe(false)
  })

  it('returns false for unknown', () => {
    expect(isPermanentError('unknown')).toBe(false)
  })
})

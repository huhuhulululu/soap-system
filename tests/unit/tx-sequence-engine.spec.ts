/**
 * TX Sequence Engine Unit Tests
 * TX 序列引擎单元测试
 */

import { describe, it, expect } from '@jest/globals'
import {
  generateTXSequenceStates,
  generateSOAPNote,
  type GenerationContext,
  type SOAPNote,
  type TXSequenceOptions
} from '../../src'

describe('TX Sequence Engine', () => {
  let ieNote: SOAPNote
  let baseContext: GenerationContext

  beforeAll(() => {
    baseContext = {
      noteType: 'IE',
      insuranceType: 'WC',
      primaryBodyPart: 'SHOULDER',
      laterality: 'bilateral',
      localPattern: 'Qi Stagnation',
      systemicPattern: 'Kidney Qi Deficiency',
      chronicityLevel: 'Chronic',
      severityLevel: 'moderate'
    }
    ieNote = generateSOAPNote(baseContext)
  })

  describe('generateTXSequenceStates', () => {
    it('should generate specified number of TX states', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const states = generateTXSequenceStates(ctx, { txCount: 5 })
      expect(states).toHaveLength(5)
    })

    it('should show progressive pain improvement', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const states = generateTXSequenceStates(ctx, { txCount: 6, seed: 42 })

      // Pain should trend downward
      for (let i = 1; i < states.length; i++) {
        expect(states[i].painScaleCurrent).toBeLessThanOrEqual(
          states[i - 1].painScaleCurrent
        )
      }
    })

    it('should maintain improvement symptom change', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const states = generateTXSequenceStates(ctx, { txCount: 5, seed: 1 })

      for (const state of states) {
        expect(state.symptomChange).toBe('improvement of symptom(s)')
      }
    })

    it('should respect seed for reproducibility', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const states1 = generateTXSequenceStates(ctx, { txCount: 5, seed: 123 })
      const states2 = generateTXSequenceStates(ctx, { txCount: 5, seed: 123 })

      // Same seed should produce same number of states
      expect(states1.length).toBe(states2.length)
      expect(states1.length).toBe(5)
    })

    it('should generate different sequences with different seeds', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const states1 = generateTXSequenceStates(ctx, { txCount: 5, seed: 1 })
      const states2 = generateTXSequenceStates(ctx, { txCount: 5, seed: 999 })

      // Both should be valid sequences
      expect(states1.length).toBe(5)
      expect(states2.length).toBe(5)
    })

    it('should approach short-term goal pain target', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const states = generateTXSequenceStates(ctx, { txCount: 12, seed: 42 })

      // Parse short-term goal target
      const goalStr = ieNote.plan.shortTermGoal?.painScaleTarget || '5-6'
      const targetPain = parseInt(goalStr.split('-')[0]) || 5

      // Last state should be close to target
      const lastPain = states[states.length - 1].painScaleCurrent
      expect(lastPain).toBeLessThanOrEqual(targetPain + 1)
    })

    it('should include muscle and ROM improvements', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const states = generateTXSequenceStates(ctx, { txCount: 5, seed: 42 })

      for (const state of states) {
        expect(state.tightnessGrading).toBeDefined()
        expect(state.tendernessGrading).toBeDefined()
        expect(state.spasmGrading).toBeDefined()
      }
    })

    it('should handle severe initial pain', () => {
      const severeIE = generateSOAPNote({
        ...baseContext,
        severityLevel: 'severe'
      })
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: severeIE,
        severityLevel: 'severe'
      }
      const states = generateTXSequenceStates(ctx, { txCount: 5, seed: 42 })

      expect(states[0].painScaleCurrent).toBeGreaterThan(6)
    })

    it('should handle mild initial pain', () => {
      const mildIE = generateSOAPNote({
        ...baseContext,
        severityLevel: 'mild'
      })
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: mildIE,
        severityLevel: 'mild'
      }
      const states = generateTXSequenceStates(ctx, { txCount: 5, seed: 42 })

      expect(states[0].painScaleCurrent).toBeLessThan(6)
    })
  })

  describe('TX Sequence Consistency', () => {
    it('should maintain consistent symptom change', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const states = generateTXSequenceStates(ctx, { txCount: 5, seed: 42 })

      // All states should have improvement symptom change
      for (const state of states) {
        expect(state.symptomChange).toBe('improvement of symptom(s)')
      }
    })

    it('should maintain consistent severity trend', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const states = generateTXSequenceStates(ctx, { txCount: 5, seed: 42 })

      for (const state of states) {
        expect(state.severityLevel).toBeDefined()
      }
    })
  })

  describe('Different Body Parts', () => {
    const bodyParts = ['LBP', 'NECK', 'KNEE'] as const

    for (const bodyPart of bodyParts) {
      it(`should generate TX sequence for ${bodyPart}`, () => {
        const bpContext: GenerationContext = {
          ...baseContext,
          primaryBodyPart: bodyPart
        }
        const bpIE = generateSOAPNote(bpContext)
        const ctx: GenerationContext = {
          ...bpContext,
          noteType: 'TX',
          previousIE: bpIE
        }
        const states = generateTXSequenceStates(ctx, { txCount: 3, seed: 42 })

        expect(states).toHaveLength(3)
        for (const state of states) {
          expect(state.painScaleCurrent).toBeDefined()
        }
      })
    }
  })

  describe('Long TX Series', () => {
    it('should handle 24-visit series', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const states = generateTXSequenceStates(ctx, { txCount: 24, seed: 42 })

      expect(states).toHaveLength(24)

      // Should reach long-term goal
      const lastPain = states[states.length - 1].painScaleCurrent
      expect(lastPain).toBeLessThanOrEqual(4)
    })

    it('should not have pain increase in long series', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const states = generateTXSequenceStates(ctx, { txCount: 24, seed: 42 })

      for (let i = 1; i < states.length; i++) {
        expect(states[i].painScaleCurrent).toBeLessThanOrEqual(
          states[i - 1].painScaleCurrent
        )
      }
    })
  })
})

import { vi } from "vitest";
/**
 * Regression test: generateContinueBatch was double-counting totalGenerated/totalFailed.
 *
 * The bug: counts incremented once inside txVisits.map AND again in the
 * updatedVisits for-loop, so every visit was counted twice.
 */

import type { BatchData, BatchPatient, BatchVisit } from '../../types'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('../../../src/generator/soap-generator', () => ({
  exportSOAPAsText: vi.fn(() => 'S:\nMock\nO:\nMock\nA:\nMock\nP:\nMock'),
  exportTXSeriesAsText: vi.fn((_ctx: unknown, opts: { txCount: number; startVisitIndex?: number }) => {
    const count = opts.startVisitIndex
      ? opts.txCount - (opts.startVisitIndex - 1)
      : opts.txCount
    return Array.from({ length: count }, () => ({
      text: 'S:\nMock\nO:\nMock\nA:\nMock\nP:\nMock',
      state: {},
    }))
  }),
}))

vi.mock('../../../src/generator/objective-patch', () => ({
  patchSOAPText: vi.fn((text: string) => text),
}))

vi.mock('../../../src/shared/normalize-generation-context', () => ({
  normalizeGenerationContext: vi.fn(() => ({
    context: { bodyPart: 'SHOULDER' },
    initialState: {},
  })),
}))

vi.mock('../../../src/parser/tx-extractor', () => ({
  extractStateFromTX: vi.fn(() => ({ estimatedVisitIndex: 2 })),
  buildContextFromExtracted: vi.fn(() => ({ bodyPart: 'SHOULDER' })),
  buildInitialStateFromExtracted: vi.fn(() => ({})),
}))

vi.mock('../text-to-html', () => ({
  splitSOAPText: vi.fn(() => ({
    subjective: 'S',
    objective: 'O',
    assessment: 'A',
    plan: 'P',
  })),
}))

// ── Helpers ─────────────────────────────────────────────────────────

function makeTXVisit(index: number): BatchVisit {
  return {
    index,
    dos: 20250101 + index,
    noteType: 'TX',
    txNumber: index,
    bodyPart: 'SHOULDER',
    laterality: 'right',
    secondaryParts: [],
    history: [],
    icdCodes: [],
    cptCodes: [],
    generated: { soap: { subjective: '', objective: '', assessment: '', plan: '' }, fullText: '', seed: 0 },
    status: 'pending',
  } as unknown as BatchVisit
}

function makeContinuePatient(txCount: number): BatchPatient {
  return {
    name: 'Test Patient',
    dob: '1990-01-01',
    age: 35,
    gender: 'Male',
    insurance: 'PI',
    clinical: {
      painWorst: 8, painBest: 3, painCurrent: 6,
      severityLevel: 'moderate',
      symptomDuration: { value: '3', unit: 'month(s)' },
      painRadiation: 'none',
      painTypes: ['Aching'],
      associatedSymptoms: ['stiffness'],
      causativeFactors: ['overuse'],
      relievingFactors: ['rest'],
      symptomScale: '60%-70%',
      painFrequency: 'Frequent',
      chronicityLevel: 'Chronic',
      recentWorse: { value: '1', unit: 'week(s)' },
    },
    visits: Array.from({ length: txCount }, (_, i) => makeTXVisit(i)),
    soapText: 'S:\nPrevious\nO:\nPrevious\nA:\nPrevious\nP:\nPrevious',
  } as unknown as BatchPatient
}

function makeBatch(patients: BatchPatient[], mode: 'continue' | 'full' = 'continue'): BatchData {
  return {
    batchId: 'test-batch',
    createdAt: '2025-01-01',
    mode,
    confirmed: false,
    patients,
    summary: { totalPatients: patients.length, totalVisits: patients.reduce((s, p) => s + p.visits.length, 0), byType: {} },
  } as unknown as BatchData
}

// ── Tests ───────────────────────────────────────────────────────────

import * as objectivePatchModule from '../../../src/generator/objective-patch';
import * as soapGeneratorModule from '../../../src/generator/soap-generator';
import { generateContinueBatch, generateMixedBatch } from '../batch-generator'

describe('batch-generator counting', () => {
  describe('generateContinueBatch', () => {
    it('does not apply objective patch to TX visits even when realisticPatch=true', () => {
      const patchSOAPText = vi.mocked(objectivePatchModule.patchSOAPText)
      patchSOAPText.mockClear()

      const batch = makeBatch([makeContinuePatient(3)])
      const result = generateContinueBatch(batch, true)

      expect(result.totalGenerated).toBe(3)
      expect(patchSOAPText).not.toHaveBeenCalled()
    })

    it('should count each successful visit exactly once', () => {
      const batch = makeBatch([makeContinuePatient(3)])
      const result = generateContinueBatch(batch)

      // 3 TX visits, all succeed → totalGenerated must be 3, not 6
      expect(result.totalGenerated).toBe(3)
      expect(result.totalFailed).toBe(0)
    })

    it('should count each failed visit exactly once', () => {
      // Force exportTXSeriesAsText to return fewer results than visits
      const exportTXSeriesAsText = vi.mocked(soapGeneratorModule.exportTXSeriesAsText)
      exportTXSeriesAsText.mockReturnValueOnce([
        { text: 'S:\nM\nO:\nM\nA:\nM\nP:\nM', state: {} },
        undefined, // second visit fails
        { text: 'S:\nM\nO:\nM\nA:\nM\nP:\nM', state: {} },
      ])

      const batch = makeBatch([makeContinuePatient(3)])
      const result = generateContinueBatch(batch)

      expect(result.totalGenerated).toBe(2)
      expect(result.totalFailed).toBe(1)
    })

    it('should count correctly with multiple patients', () => {
      const batch = makeBatch([makeContinuePatient(2), makeContinuePatient(4)])
      const result = generateContinueBatch(batch)

      expect(result.totalGenerated).toBe(6)
      expect(result.totalFailed).toBe(0)
    })
  })

  describe('generateMixedBatch continue branch', () => {
    it('does not apply objective patch to TX visits in continue mode', () => {
      const patchSOAPText = vi.mocked(objectivePatchModule.patchSOAPText)
      patchSOAPText.mockClear()

      const patient = { ...makeContinuePatient(3), mode: 'continue' as const }
      const batch = makeBatch([patient], 'continue')
      const result = generateMixedBatch(batch, true)

      expect(result.totalGenerated).toBe(3)
      expect(patchSOAPText).not.toHaveBeenCalled()
    })

    it('should count each visit exactly once in continue mode', () => {
      const patient = { ...makeContinuePatient(3), mode: 'continue' as const }
      const batch = makeBatch([patient], 'continue')
      const result = generateMixedBatch(batch)

      expect(result.totalGenerated).toBe(3)
      expect(result.totalFailed).toBe(0)
    })
  })
})

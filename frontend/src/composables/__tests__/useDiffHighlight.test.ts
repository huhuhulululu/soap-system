/**
 * REAL-01: useDiffHighlight composable tests
 * Validates summary generation and diff highlighting for batch view integration
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useDiffHighlight, shortFreq, shortSpasm, shortTight, shortTender, type GeneratedNote } from '../../composables/useDiffHighlight'

describe('useDiffHighlight', () => {
  it('shortFreq extracts frequency label before parenthesis', () => {
    expect(shortFreq('Constant (symptoms occur between 76% and 100% of the time)')).toBe('Constant')
    expect(shortFreq('Frequent (symptoms occur between 51% and 75% of the time)')).toBe('Frequent')
    expect(shortFreq('')).toBe('')
  })

  it('shortSpasm extracts grade from parentheses', () => {
    expect(shortSpasm('(+3)=>1 but < 10 spontaneous spasms per hour.')).toBe('+3')
    expect(shortSpasm('(+2)=Occasional spontaneous spasms and easily induced spasms.')).toBe('+2')
  })

  it('shortTight maps tightness levels to abbreviations', () => {
    expect(shortTight('Severe')).toBe('Sev')
    expect(shortTight('Moderate to severe')).toBe('M-S')
    expect(shortTight('Moderate')).toBe('Mod')
    expect(shortTight('Mild to moderate')).toBe('Mi-M')
    expect(shortTight('Mild')).toBe('Mild')
  })

  it('shortTender extracts grade from parentheses', () => {
    expect(shortTender('(+4) = Patient complains of severe tenderness')).toBe('+4')
    expect(shortTender('(+2) = Patient states that the area is moderately tender')).toBe('+2')
  })

  it('getNoteSummary returns null for IE notes', () => {
    const notes = ref<GeneratedNote[]>([
      { visitIndex: undefined, text: 'IE text', type: 'IE', state: { painScaleLabel: '8' } }
    ])
    const { getNoteSummary } = useDiffHighlight(notes)
    expect(getNoteSummary(notes.value[0], 0)).toBeNull()
  })

  it('getNoteSummary returns value changes for TX notes', () => {
    const notes = ref<GeneratedNote[]>([
      { visitIndex: 1, text: 'TX1', type: 'TX', state: { painScaleLabel: '8', symptomScale: '70%' } },
      { visitIndex: 2, text: 'TX2', type: 'TX', state: { painScaleLabel: '7', symptomScale: '60%' } },
    ])
    const { getNoteSummary } = useDiffHighlight(notes)
    const summary = getNoteSummary(notes.value[1], 1)
    expect(summary).not.toBeNull()
    expect(summary!.values.find(v => v.label === 'Pain')).toEqual({ label: 'Pain', from: '8', to: '7' })
    expect(summary!.values.find(v => v.label === 'Sx')).toEqual({ label: 'Sx', from: '70%', to: '60%' })
  })

  it('getNoteSummary includes trends from soaChain', () => {
    const notes = ref<GeneratedNote[]>([
      { visitIndex: 1, text: 'TX1', type: 'TX', state: { painScaleLabel: '8' } },
      { visitIndex: 2, text: 'TX2', type: 'TX', state: {
        painScaleLabel: '7',
        soaChain: {
          objective: { romTrend: 'improved', strengthTrend: 'stable' },
          subjective: { adlChange: 'improved', frequencyChange: 'stable' }
        }
      }},
    ])
    const { getNoteSummary } = useDiffHighlight(notes)
    const summary = getNoteSummary(notes.value[1], 1)
    expect(summary!.trends).toContainEqual({ label: 'ROM', trend: 'improved' })
    expect(summary!.trends).toContainEqual({ label: 'ADL', trend: 'improved' })
  })

  it('getDiffLines highlights changed words between consecutive TX notes', () => {
    const notes = ref<GeneratedNote[]>([
      { visitIndex: 1, text: 'Subjective\nPatient reports pain level 8', type: 'TX' },
      { visitIndex: 2, text: 'Subjective\nPatient reports pain level 7', type: 'TX' },
    ])
    const { getDiffLines } = useDiffHighlight(notes)
    const lines = getDiffLines(1)
    // Should have some highlighted segments for the changed "7" vs "8"
    const hasHighlight = lines.some(l => l.segments.some(s => s.hl))
    expect(hasHighlight).toBe(true)
  })
})

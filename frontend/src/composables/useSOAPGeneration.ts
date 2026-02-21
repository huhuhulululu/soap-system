/**
 * 编写页 SOAP 生成与复制 composable
 * 从 WriterView 提取：generationContext、generate、generatedNotes、seed、复制函数
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { generateTXSequenceStates } from '../../../src/generator/tx-sequence-engine.ts'
import { exportSOAPAsText } from '../../../src/generator/soap-generator.ts'
import { patchSOAPText } from '../../../src/generator/objective-patch.ts'
import {
  validateGeneratedSequence,
  visitStateToSnapshot,
  contextToSnapshot,
  type ValidationResult,
  type VisitSnapshot,
} from '../../../src/shared/soap-constraints.ts'

export interface UseSOAPGenerationOptions {
  fields: Record<string, string | string[]>
  noteType: Ref<string>
  txCount: Ref<number>
  bodyPart: Ref<string>
  laterality: Ref<string>
  insuranceType: Ref<string>
  recentWorseValue: Ref<string>
  recentWorseUnit: Ref<string>
  patientAge: Ref<number>
  patientGender: Ref<string>
  secondaryBodyParts: Ref<string[]>
  secondaryLaterality: Ref<Record<string, string>> | ComputedRef<Record<string, string>>
  medicalHistory: Ref<string[]>
  ieTxCount?: Ref<number>
  derivedSeverity: ComputedRef<string>
  currentPain: ComputedRef<number>
  /** 是否启用 Objective 补丁（更真实的 Strength/ROM 评分） */
  realisticPatch?: Ref<boolean>
}

export function useSOAPGeneration(options: UseSOAPGenerationOptions) {
  const {
    fields,
    noteType,
    txCount,
    bodyPart,
    laterality,
    insuranceType,
    recentWorseValue,
    recentWorseUnit,
    patientAge,
    patientGender,
    secondaryBodyParts,
    secondaryLaterality,
    medicalHistory,
    derivedSeverity,
    currentPain,
  } = options
  const ieTxCount = options.ieTxCount
  const realisticPatch = options.realisticPatch

  const generationContext = computed(() => ({
    noteType: noteType.value,
    insuranceType: insuranceType.value,
    primaryBodyPart: bodyPart.value,
    laterality: laterality.value,
    localPattern: (fields['assessment.tcmDiagnosis.localPattern'] as string) || 'Qi Stagnation',
    systemicPattern: (fields['assessment.tcmDiagnosis.systemicPattern'] as string) || 'Kidney Yang Deficiency',
    chronicityLevel: (fields['subjective.chronicityLevel'] as string) || 'Chronic',
    severityLevel: derivedSeverity.value,
    painCurrent: currentPain.value,
    painWorst: parseInt(((fields['subjective.painScale.worst'] as string) || '').match(/\d+/)?.[0] || '', 10) || undefined,
    painBest: parseInt(((fields['subjective.painScale.best'] as string) || '').match(/\d+/)?.[0] || '', 10) || undefined,
    associatedSymptoms: (fields['subjective.associatedSymptoms'] as string[]) || ['soreness'],
    associatedSymptom: ((fields['subjective.associatedSymptoms'] as string[])?.[0]) || 'soreness',
    symptomDuration: {
      value: (fields['subjective.symptomDuration.value'] as string) || '3',
      unit: (fields['subjective.symptomDuration.unit'] as string) || 'year(s)',
    },
    painRadiation: (fields['subjective.painRadiation'] as string) || 'without radiation',
    recentWorse: { value: recentWorseValue.value, unit: recentWorseUnit.value },
    painTypes: (fields['subjective.painTypes'] as string[]) || ['Dull', 'Aching'],
    symptomScale: (fields['subjective.symptomScale'] as string) || '70%-80%',
    painFrequency:
      (fields['subjective.painFrequency'] as string) ||
      'Constant (symptoms occur between 76% and 100% of the time)',
    causativeFactors: (fields['subjective.causativeFactors'] as string[]) || ['age related/degenerative changes'],
    relievingFactors: (fields['subjective.relievingFactors'] as string[]) || [
      'Changing positions',
      'Resting',
      'Massage',
    ],
    age: patientAge.value,
    gender: patientGender.value,
    secondaryBodyParts: [...secondaryBodyParts.value],
    hasPacemaker: medicalHistory.value.includes('Pacemaker'),
    hasMetalImplant: medicalHistory.value.includes('Joint Replacement'),
    medicalHistory: medicalHistory.value,
  }))

  const generatedNotes = ref<Array<{ visitIndex?: number; text: string; type: string; state: unknown }>>([])
  const copiedIndex = ref(-1)
  const currentSeed = ref<number | null>(null)
  const seedInput = ref('')
  const seedCopied = ref(false)
  const generationError = ref('')
  const validationResult = ref<ValidationResult | null>(null)

  function runValidation(states: Parameters<typeof visitStateToSnapshot>[0][], ctx: typeof generationContext.value) {
    const snapshots: VisitSnapshot[] = states.map(s => visitStateToSnapshot(s))
    const ctxSnap = contextToSnapshot(ctx as any)
    validationResult.value = validateGeneratedSequence(snapshots, ctxSnap)
  }

  function generate(useSeed?: number) {
    try {
      const ctx = generationContext.value
      const txCtx = { ...ctx, noteType: 'TX' }
      const usePatch = realisticPatch?.value ?? false
      const mayPatch = (text: string, c: typeof ctx, vs?: any) =>
        usePatch ? patchSOAPText(text, c as any, vs) : text
      const seed =
        useSeed != null
          ? useSeed
          : seedInput.value
            ? parseInt(seedInput.value, 10) || undefined
            : undefined

      const freqText = (fields['subjective.painFrequency'] as string) || ''
      const freqLevel = freqText.includes('Constant')
        ? 3
        : freqText.includes('Frequent')
          ? 2
          : freqText.includes('Occasional')
            ? 1
            : freqText.includes('Intermittent')
              ? 0
              : 3

      const initialState = {
        pain: ctx.painCurrent,
        associatedSymptom: ctx.associatedSymptom || 'soreness',
        symptomScale: (fields['subjective.symptomScale'] as string) || '70%-80%',
        frequency: freqLevel,
        painTypes: (fields['subjective.painTypes'] as string[]) || ['Dull', 'Aching'],
      }

      if (noteType.value === 'IE') {
        const ieText = mayPatch(exportSOAPAsText(ctx, {}), ctx)
        const { states, seed: actualSeed } = generateTXSequenceStates(txCtx, {
          txCount: ieTxCount ? ieTxCount.value : 11,
          startVisitIndex: 1,
          seed,
          initialState,
        })
        currentSeed.value = actualSeed
        generatedNotes.value = [
          { visitIndex: 0, text: ieText, type: 'IE', state: null },
          ...states.map(state => ({
            visitIndex: state.visitIndex,
            text: mayPatch(exportSOAPAsText(txCtx, state), txCtx, state),
            type: 'TX',
            state,
          })),
        ]
        runValidation(states, ctx)
      } else {
        const { states, seed: actualSeed } = generateTXSequenceStates(txCtx, {
          txCount: txCount.value,
          startVisitIndex: 1,
          seed,
          initialState,
        })
        currentSeed.value = actualSeed
        generatedNotes.value = states.map(state => ({
          visitIndex: state.visitIndex,
          text: mayPatch(exportSOAPAsText(txCtx, state), txCtx, state),
          type: 'TX',
          state,
          _open: false,
        }))
        runValidation(states, ctx)
      }
    } catch (e) {
      validationResult.value = null
      generationError.value = '生成失败: ' + (e as Error).message
      setTimeout(() => { generationError.value = '' }, 5000)
    }
  }

  function copySeed() {
    if (currentSeed.value == null) return
    navigator.clipboard.writeText(String(currentSeed.value))
    seedCopied.value = true
    setTimeout(() => (seedCopied.value = false), 1500)
  }

  function regenerate() {
    if (currentSeed.value != null) {
      generate(currentSeed.value)
    }
  }

  function splitSOAP(text: string): { S: string; O: string; A: string; P: string } {
    if (!text) return { S: '', O: '', A: '', P: '' }
    const sections = { S: '', O: '', A: '', P: '' }
    const markers = [
      { key: 'S' as const, re: /^Subjective\n/m },
      { key: 'O' as const, re: /^Objective\n/m },
      { key: 'A' as const, re: /^Assessment\n/m },
      { key: 'P' as const, re: /^Plan\n/m },
    ]
    const positions = markers
      .map(m => {
        const match = text.match(m.re)
        return {
          key: m.key,
          start: match ? text.indexOf(match[0]) : -1,
          headerLen: match ? match[0].length : 0,
        }
      })
      .filter(p => p.start >= 0)
      .sort((a, b) => a.start - b.start)

    positions.forEach((pos, i) => {
      const contentStart = pos.start + pos.headerLen
      const contentEnd = i < positions.length - 1 ? positions[i + 1].start! : text.length
      sections[pos.key] = text.slice(contentStart, contentEnd).replace(/\n{2,}$/, '').trim()
    })
    return sections
  }

  const copiedSection = ref<{ idx: number; section: string } | null>(null)

  function copySection(idx: number, sectionKey: string) {
    const note = generatedNotes.value[idx]
    if (!note) return
    const parts = splitSOAP(note.text)
    navigator.clipboard.writeText((parts as Record<string, string>)[sectionKey] || '')
    copiedSection.value = { idx, section: sectionKey }
    setTimeout(() => (copiedSection.value = null), 1500)
  }

  function isCopied(idx: number, sectionKey: string) {
    return copiedSection.value?.idx === idx && copiedSection.value?.section === sectionKey
  }

  function copyNote(idx: number) {
    navigator.clipboard.writeText(generatedNotes.value[idx]?.text || '')
    copiedIndex.value = idx
    setTimeout(() => (copiedIndex.value = -1), 1500)
  }

  function copyAll() {
    const all = generatedNotes.value
      .map(n => `=== ${n.type}${n.visitIndex ?? ''} ===\n${n.text}`)
      .join('\n\n')
    navigator.clipboard.writeText(all)
    copiedIndex.value = -999
    setTimeout(() => (copiedIndex.value = -1), 1500)
  }

  return {
    generationContext,
    generatedNotes,
    generationError,
    validationResult,
    copiedIndex,
    currentSeed,
    seedInput,
    seedCopied,
    copiedSection,
    generate,
    copySeed,
    regenerate,
    splitSOAP,
    copySection,
    isCopied,
    copyNote,
    copyAll,
  }
}

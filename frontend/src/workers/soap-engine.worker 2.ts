/**
 * Web Worker — runs SOAP generation off the main thread.
 *
 * Receives a GenerateRequest, runs the full tx-sequence pipeline,
 * and posts back a GenerateResponse with the generated notes.
 */
import { generateTXSequenceStates } from '../../../src/generator/tx-sequence-engine'
import { exportSOAPAsText } from '../../../src/generator/soap-generator'
import { patchSOAPText } from '../../../src/generator/objective-patch'
import {
  normalizeGenerationContext,
  type NormalizeInput,
} from '../../../src/shared/normalize-generation-context'

export interface GenerateRequest {
  readonly type: 'generate'
  readonly input: NormalizeInput
  readonly noteType: string
  readonly txCount: number
  readonly startVisitIndex?: number
  readonly seed?: number
  readonly realisticPatch: boolean
  readonly ieTxCount?: number
}

export interface GenerateResponse {
  readonly type: 'result' | 'error'
  readonly notes?: ReadonlyArray<{
    visitIndex?: number
    text: string
    type: string
    state: unknown
  }>
  readonly seed?: number
  readonly states?: readonly unknown[]
  readonly error?: string
}

self.onmessage = (e: MessageEvent<GenerateRequest>) => {
  try {
    const msg = e.data
    if (msg.type !== 'generate') return

    const { context: ctx, initialState } = normalizeGenerationContext(msg.input)
    const txCtx = { ...ctx, noteType: 'TX' as const }
    const usePatch = msg.realisticPatch
    const mayPatch = (text: string, c: typeof ctx, vs?: unknown) =>
      usePatch ? patchSOAPText(text, c as Parameters<typeof patchSOAPText>[1], vs) : text

    const { states, seed: actualSeed } = generateTXSequenceStates(txCtx, {
      txCount: msg.noteType === 'IE' ? (msg.ieTxCount ?? 11) : msg.txCount,
      startVisitIndex: msg.startVisitIndex ?? 1,
      seed: msg.seed,
      initialState,
    })

    const notes: Array<{ visitIndex?: number; text: string; type: string; state: unknown }> = []

    if (msg.noteType === 'IE') {
      const ieText = mayPatch(exportSOAPAsText(ctx, {}), ctx)
      notes.push({ visitIndex: 0, text: ieText, type: 'IE', state: null })
    }

    for (const state of states) {
      const text = mayPatch(exportSOAPAsText(txCtx, state), txCtx, state)
      notes.push({ visitIndex: state.visitIndex, text, type: 'TX', state })
    }

    const response: GenerateResponse = { type: 'result', notes, seed: actualSeed, states }
    self.postMessage(response)
  } catch (err) {
    const response: GenerateResponse = {
      type: 'error',
      error: err instanceof Error ? err.message : 'Unknown worker error',
    }
    self.postMessage(response)
  }
}

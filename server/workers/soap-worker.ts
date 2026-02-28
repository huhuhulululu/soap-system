/**
 * Worker Thread for SOAP batch generation.
 * Receives batch data + options, runs generation, posts result back.
 */
import { parentPort } from 'worker_threads'
import { generateMixedBatch, type BatchGenerationResult } from '../services/batch-generator'
import type { BatchData } from '../types'

if (!parentPort) {
  throw new Error('This file must be run as a Worker Thread')
}

interface WorkerMessage {
  readonly type: 'generate'
  readonly batch: BatchData
  readonly realisticPatch?: boolean
  readonly disableChronicCaps?: boolean
}

interface WorkerResponse {
  readonly type: 'result' | 'error'
  readonly result?: BatchGenerationResult
  readonly error?: string
}

parentPort.on('message', (msg: WorkerMessage) => {
  try {
    if (msg.type === 'generate') {
      const result = generateMixedBatch(msg.batch, msg.realisticPatch, msg.disableChronicCaps)
      const response: WorkerResponse = { type: 'result', result }
      parentPort!.postMessage(response)
    }
  } catch (err) {
    const response: WorkerResponse = {
      type: 'error',
      error: err instanceof Error ? err.message : 'Unknown worker error',
    }
    parentPort!.postMessage(response)
  }
})

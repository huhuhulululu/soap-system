/**
 * Worker Thread pool for SOAP generation.
 * Single worker (avoids PRNG concurrency issues).
 * Sends entire batch to worker, returns Promise<BatchGenerationResult>.
 */
import { Worker } from 'worker_threads'
import path from 'path'
import type { BatchData } from '../types'
import type { BatchGenerationResult } from './batch-generator'

const WORKER_PATH = path.resolve(__dirname, '../workers/soap-worker.ts')
const WORKER_TIMEOUT = 120_000 // 120s for large batches

let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(WORKER_PATH, {
      execArgv: ['--require', 'tsx/cjs'],
    })
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`SOAP worker exited with code ${code}`)
      }
      worker = null
    })
  }
  return worker
}

export async function generateBatchAsync(
  batch: BatchData,
  realisticPatch?: boolean,
  disableChronicCaps?: boolean,
): Promise<BatchGenerationResult> {
  return new Promise((resolve, reject) => {
    const w = getWorker()

    const timeout = setTimeout(() => {
      w.terminate()
      worker = null
      reject(new Error('SOAP generation timed out'))
    }, WORKER_TIMEOUT)

    const handler = (response: { type: string; result?: BatchGenerationResult; error?: string }) => {
      clearTimeout(timeout)
      w.removeListener('message', handler)
      w.removeListener('error', errorHandler)

      if (response.type === 'result' && response.result) {
        resolve(response.result)
      } else {
        reject(new Error(response.error ?? 'Worker returned no result'))
      }
    }

    const errorHandler = (err: Error) => {
      clearTimeout(timeout)
      w.removeListener('message', handler)
      worker = null
      reject(err)
    }

    w.on('message', handler)
    w.on('error', errorHandler)

    w.postMessage({
      type: 'generate',
      batch,
      realisticPatch,
      disableChronicCaps,
    })
  })
}

/**
 * Gracefully terminate the worker (for shutdown)
 */
export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate()
    worker = null
  }
}

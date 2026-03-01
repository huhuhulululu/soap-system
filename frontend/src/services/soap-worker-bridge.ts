/**
 * Bridge between main thread and SOAP Web Worker.
 * Wraps Worker communication in a Promise with timeout + cleanup.
 */
import type { GenerateRequest, GenerateResponse } from '../workers/soap-engine.worker'

const WORKER_TIMEOUT_MS = 30_000

let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/soap-engine.worker.ts', import.meta.url),
      { type: 'module' },
    )
  }
  return worker
}

export interface WorkerGenerateResult {
  readonly notes: ReadonlyArray<{ visitIndex?: number; text: string; type: string; state: unknown }>
  readonly seed: number
  readonly states: readonly unknown[]
}

export function generateInWorker(
  request: Omit<GenerateRequest, 'type'>,
): Promise<WorkerGenerateResult> {
  return new Promise((resolve, reject) => {
    const w = getWorker()

    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Worker generation timed out'))
    }, WORKER_TIMEOUT_MS)

    function cleanup() {
      clearTimeout(timeout)
      w.removeEventListener('message', handler)
      w.removeEventListener('error', errorHandler)
    }

    function handler(e: MessageEvent<GenerateResponse>) {
      cleanup()
      if (e.data.type === 'result' && e.data.notes) {
        resolve({
          notes: e.data.notes,
          seed: e.data.seed ?? 0,
          states: e.data.states ?? [],
        })
      } else {
        reject(new Error(e.data.error ?? 'Worker returned no result'))
      }
    }

    function errorHandler(e: ErrorEvent) {
      cleanup()
      reject(new Error(e.message))
    }

    w.addEventListener('message', handler)
    w.addEventListener('error', errorHandler)
    w.postMessage({ type: 'generate', ...request })
  })
}

export function terminateWorker(): void {
  worker?.terminate()
  worker = null
}

// Shared automation types — single source of truth for parent + child process

export type AutomationErrorKind =
  | 'session_expired'
  | 'patient_not_found'
  | 'visit_not_found'
  | 'timeout'
  | 'element_not_found'
  | 'unknown'

export interface AttemptRecord {
  readonly attempt: number
  readonly error: string
  readonly errorKind: AutomationErrorKind
  readonly durationMs: number
}

export interface VisitResult {
  readonly patient: string
  readonly visitIndex: number
  readonly noteType: string
  readonly success: boolean
  readonly error?: string
  readonly failedStep?: string
  readonly errorKind?: AutomationErrorKind
  readonly duration: number
  readonly attempts: number
  readonly retryHistory?: ReadonlyArray<AttemptRecord>
}

export type BatchEvent =
  | {
      readonly type: 'visit_start'
      readonly patient: string
      readonly visitIndex: number
      readonly noteType: string
      readonly ts: number
    }
  | {
      readonly type: 'visit_result'
      readonly patient: string
      readonly visitIndex: number
      readonly noteType: string
      readonly success: boolean
      readonly error?: string
      readonly errorKind?: AutomationErrorKind
      readonly failedStep?: string
      readonly duration: number
      readonly attempts: number
      readonly retryHistory?: ReadonlyArray<AttemptRecord>
      readonly ts: number
    }
  | {
      readonly type: 'batch_summary'
      readonly total: number
      readonly passed: number
      readonly failed: number
      readonly skipped: number
      readonly durationMs: number
      readonly aborted: boolean
      readonly abortReason?: string
      readonly failures: ReadonlyArray<{
        readonly patient: string
        readonly visitIndex: number
        readonly error: string
        readonly retryHistory?: ReadonlyArray<AttemptRecord>
      }>
      readonly ts: number
    }

export function classifyError(err: unknown): AutomationErrorKind {
  const msg = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ''
  const lower = msg.toLowerCase()

  // Permanent errors (check first — more specific patterns)
  if (lower.includes('session expired')) return 'session_expired'
  if (msg.includes('Patient not found')) return 'patient_not_found'
  if (msg.includes('Visit #') && lower.includes('not found')) return 'visit_not_found'

  // Transient errors
  if (name === 'TimeoutError' || lower.includes('timeout')) return 'timeout'
  if (lower.includes('not found') || lower.includes('not accessible')) return 'element_not_found'

  return 'unknown'
}

export function isPermanentError(kind: AutomationErrorKind): boolean {
  return kind === 'session_expired' || kind === 'patient_not_found' || kind === 'visit_not_found'
}

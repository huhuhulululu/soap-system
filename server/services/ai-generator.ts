/**
 * AI SOAP Generator — Vertex AI Fine-tuned Model Integration
 *
 * Calls the Vertex AI v2 fine-tuned Gemini model to generate SOAP notes.
 * Uses Python google-genai bridge (already authenticated via gcloud).
 */

import { spawn } from 'child_process'
import type { NoteType, BodyPart, Laterality, SeverityLevel } from '../../src/types'

const VERTEX_PROJECT = process.env.VERTEX_PROJECT ?? 'tenfu-data-sync'
const VERTEX_LOCATION = process.env.VERTEX_LOCATION ?? 'us-central1'
const VERTEX_ENDPOINT = process.env.VERTEX_ENDPOINT
  ?? 'projects/625662508139/locations/us-central1/endpoints/4778460491884265472'
const PYTHON_BIN = process.env.PYTHON_BIN ?? 'python3'

export interface AIGenerateInput {
  readonly noteType: NoteType
  readonly bodyPart: BodyPart
  readonly laterality: Laterality
  readonly painCurrent: number
  readonly painWorst: number
  readonly painBest: number
  readonly chronicityLevel: 'Acute' | 'Sub Acute' | 'Chronic'
  readonly severityLevel: SeverityLevel
  readonly tcmLocal: string
  readonly tcmSystemic: string
  readonly associatedSymptoms: readonly string[]
  readonly painTypes: readonly string[]
  readonly painFrequency: string
  readonly symptomScale: string
  readonly duration: string
  readonly causativeFactors: readonly string[]
  readonly aggravatingFactors: readonly string[]
  readonly relievingFactors: readonly string[]
  readonly tongue?: string
  readonly pulse?: string
  readonly age?: number
  readonly gender?: 'Male' | 'Female'
}

export interface AIGenerateResult {
  readonly success: boolean
  readonly fullText: string
  readonly soap: {
    readonly subjective: string
    readonly objective: string
    readonly assessment: string
    readonly plan: string
  }
  readonly elapsed: number
  readonly error?: string
}

export function buildPrompt(input: AIGenerateInput): string {
  const noteLabel = input.noteType === 'IE' ? 'Initial Evaluation' : 'Treatment'
  const genderShort = input.gender === 'Female' ? 'F' : 'M'
  const ageStr = input.age ? `${input.age}${genderShort}` : genderShort

  const lines = [
    `Generate ${noteLabel} SOAP for:`,
    `Body Part: ${input.bodyPart}, Laterality: ${input.laterality}`,
    `Patient: ${ageStr}, Pain: ${input.painCurrent}/10 (worst ${input.painWorst}, best ${input.painBest})`,
    `Chronicity: ${input.chronicityLevel}, Severity: ${input.severityLevel}`,
    `TCM: ${input.tcmLocal} (local), ${input.tcmSystemic} (systemic)`,
    `Symptoms: ${input.associatedSymptoms.join(', ')}`,
    `Pain Types: ${input.painTypes.join(', ')}`,
    `Frequency: ${input.painFrequency}`,
    `Symptom Scale: ${input.symptomScale}`,
    `Duration: ${input.duration}`,
    `Causatives: ${input.causativeFactors.join(', ')}`,
    `Aggravating: ${input.aggravatingFactors.join(', ')}`,
    `Relieving: ${input.relievingFactors.join(', ')}`,
  ]

  if (input.tongue) lines.push(`Tongue: ${input.tongue}`)
  if (input.pulse) lines.push(`Pulse: ${input.pulse}`)

  return lines.join('\n')
}

export function splitSOAP(text: string): AIGenerateResult['soap'] {
  const sections = { subjective: '', objective: '', assessment: '', plan: '' }
  const markers = [
    { key: 'subjective' as const, pattern: /^Subjective\b/im },
    { key: 'objective' as const, pattern: /^Objective\b/im },
    { key: 'assessment' as const, pattern: /^Assessment\b/im },
    { key: 'plan' as const, pattern: /^Plan\b/im },
  ]

  const positions = markers
    .map(m => {
      const match = m.pattern.exec(text)
      return match ? { key: m.key, start: match.index } : null
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.start - b.start)

  for (let i = 0; i < positions.length; i++) {
    const end = i + 1 < positions.length ? positions[i + 1].start : text.length
    sections[positions[i].key] = text.slice(positions[i].start, end).trim()
  }

  return sections
}

const PYTHON_SCRIPT = `
import sys, json, time
from google import genai
from google.genai.types import HttpOptions

project = sys.argv[1]
location = sys.argv[2]
endpoint = sys.argv[3]
prompt = sys.stdin.read()

client = genai.Client(
    vertexai=True,
    project=project,
    location=location,
    http_options=HttpOptions(api_version="v1beta1"),
)

start = time.time()
resp = client.models.generate_content(model=endpoint, contents=prompt)
elapsed = time.time() - start

print(json.dumps({"text": resp.text, "elapsed": round(elapsed, 2)}))
`

function callPython(prompt: string): Promise<{ text: string; elapsed: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [
      '-c', PYTHON_SCRIPT,
      VERTEX_PROJECT,
      VERTEX_LOCATION,
      VERTEX_ENDPOINT,
    ], {
      env: { ...process.env },
      timeout: 120_000,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`Python exit ${code}: ${stderr.slice(0, 500)}`))
        return
      }
      try {
        resolve(JSON.parse(stdout))
      } catch {
        reject(new Error(`Invalid JSON from Python: ${stdout.slice(0, 200)}`))
      }
    })

    proc.on('error', reject)
    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}

export async function generateWithAI(input: AIGenerateInput): Promise<AIGenerateResult> {
  const prompt = buildPrompt(input)
  const start = Date.now()

  try {
    const result = await callPython(prompt)
    const soap = splitSOAP(result.text)

    return {
      success: true,
      fullText: result.text,
      soap,
      elapsed: result.elapsed,
    }
  } catch (err) {
    const elapsed = (Date.now() - start) / 1000
    return {
      success: false,
      fullText: '',
      soap: { subjective: '', objective: '', assessment: '', plan: '' },
      elapsed,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

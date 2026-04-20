/**
 * 30 deterministic fixture snapshot tests.
 *
 * Captures the CURRENT SOAP generation engine output as regression baselines.
 * Any future engine change that shifts the PRNG sequence will be detected.
 *
 * Run `npm test -- src/generator/__fixtures__/fixture-snapshots.test.ts --runInBand -u`
 * to regenerate snapshots after intentional engine changes.
 */
import { exportSOAP, exportTXSeriesAsText } from '../soap-generator'
import { patchSOAPText } from '../objective-patch'
import { setWhitelist } from '../../parser/template-rule-whitelist'
import { FIXTURES, type FixtureDefinition } from './fixture-data'
import whitelistData from '../../../frontend/src/data/whitelist.json'

import type { BodyPart, GenerationContext } from '../../types'
import type { TXSequenceOptions } from '../tx-sequence-engine'

beforeAll(() => {
  setWhitelist(whitelistData as Record<string, string[]>)
})

function makeContext(fx: FixtureDefinition): GenerationContext {
  // NOTE: for TX fixtures (default), the fields below must remain
  // byte-identical to the pre-v3 shape so the existing 42 snapshots
  // stay 0-diff. IE/RE fixtures opt into the extension branch via
  // the fx.noteType field.
  const base: GenerationContext = {
    noteType: fx.noteType ?? 'TX',
    insuranceType: fx.insuranceType ?? 'OPTUM',
    primaryBodyPart: fx.bodyPart,
    laterality: fx.laterality,
    localPattern: fx.localPattern ?? 'Qi Stagnation',
    systemicPattern: fx.systemicPattern ?? 'Kidney Yang Deficiency',
    chronicityLevel: fx.chronicityLevel ?? 'Chronic',
    severityLevel: fx.severityLevel,
    painCurrent: fx.painCurrent,
    associatedSymptoms: [
      (fx.associatedSymptom ?? 'soreness') as NonNullable<
        GenerationContext['associatedSymptoms']
      >[number],
    ],
    hasPacemaker: fx.hasPacemaker,
    hasMetalImplant: fx.hasMetalImplant,
    medicalHistory: fx.medicalHistory ? [...fx.medicalHistory] : undefined,
    age: fx.age,
    gender: fx.gender,
    disableChronicCaps: fx.disableChronicCaps,
    allowNegativeEvents: fx.allowNegativeEvents,
  }
  // IE/RE need seed on context; multi-bodypart needs secondaryBodyParts.
  // Both fields are additive and only present when fx opts in — TX
  // fixtures without these opts get an object identical to pre-v3.
  if (fx.noteType && fx.noteType !== 'TX') {
    ;(base as { seed?: number }).seed = fx.seed
  }
  if (fx.secondaryBodyParts && fx.secondaryBodyParts.length > 0) {
    ;(base as { secondaryBodyParts?: BodyPart[] }).secondaryBodyParts = [
      ...fx.secondaryBodyParts,
    ]
  }
  return base
}

function makeOptions(fx: FixtureDefinition): TXSequenceOptions {
  return {
    txCount: fx.txCount,
    seed: fx.seed,
    startVisitIndex: fx.startVisitIndex,
    initialState: {
      pain: fx.painCurrent,
      tightness: fx.painCurrent >= 7 ? 3 : 2,
      tenderness: fx.painCurrent >= 7 ? 3 : 2,
      spasm: fx.painCurrent >= 7 ? 3 : 2,
      frequency: fx.initialFrequency ?? 3,
      associatedSymptom: fx.associatedSymptom ?? 'soreness',
      painTypes: ['Dull', 'Aching'],
    },
  }
}

describe('Fixture Snapshots', () => {
  for (const fx of FIXTURES) {
    it(`snapshot: ${fx.name}`, () => {
      const context = makeContext(fx)

      if (fx.noteType === 'IE' || fx.noteType === 'RE' || fx.noteType === 'NEW_IE') {
        // Non-TX note: single-pass render via exportSOAP, no visit state.
        const output = exportSOAP(context, undefined, 'text')
        expect(output).toMatchSnapshot()
        return
      }

      // TX path — unchanged from pre-v3.
      const options = makeOptions(fx)
      const results = exportTXSeriesAsText(context, options)

      const output = results
        .map(r => {
          if (fx.realisticPatch) {
            return patchSOAPText(r.text, context, r.state)
          }
          return r.text
        })
        .join('\n---VISIT---\n')

      expect(output).toMatchSnapshot()
    })
  }
})

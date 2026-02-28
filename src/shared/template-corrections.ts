export interface CorrectionEntry {
  readonly corrected: string;
  readonly type: 'typo' | 'grammar' | 'duplication' | 'punctuation' | 'anatomy' | 'template-bug';
  readonly reason: string;
}

export const TEMPLATE_CORRECTIONS: Record<string, CorrectionEntry> = {
  // === Typos ===
  'RE-EVALUATIOIN': { corrected: 'RE-EVALUATION', type: 'typo', reason: 'misspelling' },
  'Prolonge walking': { corrected: 'Prolonged walking', type: 'typo', reason: 'misspelling' },
  'Assesment': { corrected: 'Assessment', type: 'typo', reason: 'misspelling' },
  'assitant': { corrected: 'assistant', type: 'typo', reason: 'misspelling' },
  'Lattisimus dorsi': { corrected: 'Latissimus dorsi', type: 'typo', reason: 'anatomy misspelling' },
  'Illiac Crest': { corrected: 'Iliac Crest', type: 'typo', reason: 'anatomy misspelling' },
  'Gastronemius muscle': { corrected: 'Gastrocnemius muscle', type: 'typo', reason: 'anatomy misspelling' },
  'intense excise': { corrected: 'intense exercise', type: 'typo', reason: 'misspelling' },
  'dusk': { corrected: 'dusky', type: 'typo', reason: 'TCM tongue term' },

  // === Grammar ===
  'continue to be emphasize': { corrected: 'continue to emphasize', type: 'grammar', reason: 'incorrect be + base form' },
  'may related of': { corrected: 'may be related to', type: 'grammar', reason: 'missing be, of→to' },
  'exacerbate of symptom(s)': { corrected: 'exacerbation of symptom(s)', type: 'grammar', reason: 'verb→noun' },
  'slight increased': { corrected: 'slightly increased', type: 'grammar', reason: 'adj→adv' },
  'over used due to nature of work': { corrected: 'overuse due to nature of work', type: 'grammar', reason: 'verb→noun' },
  'over used due to heavy household chores': { corrected: 'overuse due to heavy household chores', type: 'grammar', reason: 'verb→noun' },
  'excessive used of phone/tablet': { corrected: 'excessive use of phone/tablet', type: 'grammar', reason: 'past tense→noun' },
  'activating Blood circulation to dissipate blood stagnant': { corrected: 'activating Blood circulation to dissipate blood stagnation', type: 'grammar', reason: 'adj→noun' },
  'with excellent outcome due reducing pain': { corrected: 'with excellent outcome due to reducing pain', type: 'grammar', reason: 'missing to' },
  'with increase ease with functional mobility': { corrected: 'with increased ease with functional mobility', type: 'grammar', reason: 'base→past participle' },
  'with increase ease with function': { corrected: 'with increased ease with function', type: 'grammar', reason: 'base→past participle' },
  'Patient also complaints of': { corrected: 'Patient also complains of', type: 'grammar', reason: 'noun→verb' },
  'which promoted the patient to seek': { corrected: 'which prompted the patient to seek', type: 'grammar', reason: 'promoted→prompted' },
  'handing/carrying moderate objects': { corrected: 'handling/carrying moderate objects', type: 'grammar', reason: 'handing→handling' },
  'Contraindication or Precision': { corrected: 'Contraindication or Precaution', type: 'grammar', reason: 'Precision→Precaution' },
  'Detail explanation from patient': { corrected: 'Detailed explanation from patient', type: 'grammar', reason: 'noun→adj' },

  // === Duplication ===
  'in order to to reduce stagnation': { corrected: 'in order to reduce stagnation', type: 'duplication', reason: 'double to' },

  // === Anatomy ===
  'greater tubercle': { corrected: 'greater trochanter', type: 'anatomy', reason: 'tubercle is shoulder, trochanter is hip' },
  'lesser tubercle': { corrected: 'lesser trochanter', type: 'anatomy', reason: 'tubercle is shoulder, trochanter is hip' },
} as const;

export function applyCorrection(value: string): string {
  return TEMPLATE_CORRECTIONS[value]?.corrected ?? value;
}

export function applyCorrections(values: readonly string[]): string[] {
  return values.map(applyCorrection);
}

/**
 * Parse MDLand HTML templates to extract ppnSelectCombo field definitions.
 * Each field has: index (position order), type (Single/Multi), options, defaultValue
 */
import * as fs from 'fs';
import * as path from 'path';

export interface TemplateField {
  index: number;
  type: 'single' | 'multi';
  options: string[];
  defaultValue: string;
  context: string;
  label: string;
}

export interface ParsedTemplate {
  bodyPart: string;
  noteType: 'IE' | 'TX';
  fields: TemplateField[];
}

const TEMPLATE_DIR_IE = path.resolve(__dirname, '../../..', 'ie');
const TEMPLATE_DIR_TX = path.resolve(__dirname, '../../..', 'tx');

const PPN_REGEX = /<span\s+class="(ppnSelectComboSingle|ppnSelectCombo)\s+([^"]*)"[^>]*>([^<]*)<\/span>/g;

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function inferLabel(options: string[], index: number, ctx: string): string {
  const o = options.join('|').toLowerCase();
  if (o.includes('initial evaluation')) return 'noteType';
  if (o.includes('acute') && o.includes('chronic') && options.length <= 4) return 'chronicityLevel';
  if (o.includes('dull') && o.includes('burning')) return 'painTypes';
  if (o.includes('along right') && o.includes('bilateral')) return 'laterality';
  if (o.includes('shoulder area') || o.includes('knee area') || o.includes('lower back')) return 'bodyArea';
  if (o.includes('without radiation')) return 'painRadiation';
  if (o.includes('week(s)') && o.includes('month(s)')) return 'durationUnit';
  if (o.includes('soreness') && o.includes('stiffness') && options.length <= 6) return 'associatedSymptoms';
  if (o.includes('10%') && o.includes('100%')) return 'symptomScale';
  if (o.includes('because of') && o.includes('due to')) return 'causativeConnector';
  if (o.includes('age related') && o.includes('poor sleep')) return 'causativeFactors';
  if (o.includes('exacerbated by') || o.includes('aggravated by')) return 'aggravatingConnector';
  if (o.includes('strenuous activities') || o.includes('repetitive motions')) return 'exacerbatingFactors';
  if (o.includes('severe') && o.includes('mild') && !o.includes('degree')) return 'severityLevel';
  if (o.includes('household chores') || o.includes('daily activities') || o.includes('cooking')) return 'adlActivities';
  if (o.includes('moving around') || o.includes('stretching') || o.includes('resting')) return 'relievingFactors';
  if (o.includes('decrease outside') || o.includes('stay in bed')) return 'conditionImpact';
  if (o.includes('over-the-counter')) return 'medications';
  if (o.includes('intermittent') && o.includes('constant')) return 'painFrequency';
  if (o.includes('cane') && o.includes('wheel chair')) return 'assistiveDevice';
  if (o.includes('smoking') && o.includes('diabetes')) return 'medicalHistory';
  if (o.includes('skin no damage')) return 'inspection';
  if (o.includes('trapezius') || o.includes('tuberosity') || o.includes('gluteal') || o.includes('piriformis')) return 'muscles';
  if (o.includes('patient complains of severe') || o.includes('patient states')) return 'tendernessScale';
  if (o.includes('no spasm') || o.includes('spontaneous spasm')) return 'spasmGrading';
  if (o.includes('degree(normal)') || o.includes('degrees(normal)') || o.includes('degree(mild)') || o.includes('degrees(mild)')) return 'romDegrees';
  if (/^[234][+-]?\|/.test(o)) return 'romStrength';
  if (o.includes('purple') || o.includes('pale') || o.includes('thin white coat')) return 'tongue';
  if (o.includes('wiry') || o.includes('choppy') || o.includes('thready')) return 'pulse';
  if (o.includes('qi stagnation') || o.includes('blood stasis')) return 'tcmPattern';
  if (o.includes('moving qi') || o.includes('activating blood')) return 'treatmentPrinciples';
  if (o.includes('continue to be emphasize') || o.includes('promote')) return 'txVerb';
  if (o.includes('improvement of symptom') && o.includes('exacerbate')) return 'symptomChange';
  if (o.includes('emotion stress') || o.includes('lassitude')) return 'emotionalState';
  if (o.includes('maintain regular') && o.includes('still need more')) return 'txReason';
  if (o.includes('can move joint') || o.includes('reduced level of pain')) return 'txWhatChanged';
  if (o.includes('decreased') && o.includes('remained the same') && options.length <= 6) return 'changeDirection';
  if (o.includes('pain frequency') && o.includes('muscles weakness')) return 'whatChangedDimensions';
  if (o.includes('local muscles tightness') && o.includes('joint rom')) return 'objectiveChangeDimensions';
  if (o.includes('session') && o.includes('treatment') && options.length <= 5) return 'treatmentWord';
  if (o.includes('well') && o.includes('good positioning')) return 'toleratedResponse';
  if (o.includes('good') && o.includes('fair') && o.includes('poor') && options.length <= 4) return 'generalCondition';
  if (o.includes('slight improvement') && o.includes('no change')) return 'assessmentChange';
  if (o.includes('neck') && o.includes('upper back') && o.includes('knee')) return 'otherBodyParts';
  if (options.every(x => /^\d+(-\d+)?$/.test(x.trim()))) return 'numericValue';
  if (o.includes('right') && o.includes('left') && options.length <= 3) return 'side';
  return 'field_' + index;
}

function getTextBefore(html: string, pos: number): string {
  const start = Math.max(0, pos - 80);
  return html.substring(start, pos).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(-40);
}

export function parseTemplate(filePath: string): ParsedTemplate {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.md');
  const isIE = fileName.includes('IE');
  const noteType = isIE ? 'IE' as const : 'TX' as const;
  const bpMatch = fileName.match(/AC-(?:IE|TX)\s+(.+)/);
  const bodyPart = bpMatch ? bpMatch[1].trim().toUpperCase() : 'UNKNOWN';

  const fields: TemplateField[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = PPN_REGEX.exec(content)) !== null) {
    const type = match[1] === 'ppnSelectComboSingle' ? 'single' as const : 'multi' as const;
    const rawOptions = decodeHtml(match[2]);
    const defaultValue = decodeHtml(match[3].trim());
    const options = rawOptions.split('|').map(x => x.trim());
    const ctx = getTextBefore(content, match.index);
    const label = inferLabel(options, index, ctx);

    fields.push({ index, type, options, defaultValue, context: ctx, label });
    index++;
  }

  return { bodyPart, noteType, fields };
}

export function parseAllTemplates(bodyPart: string): { ie: ParsedTemplate | null; tx: ParsedTemplate | null } {
  const ieFile = path.join(TEMPLATE_DIR_IE, `AC-IE ${bodyPart}.md`);
  const txFile = path.join(TEMPLATE_DIR_TX, `AC-TX ${bodyPart}.md`);

  return {
    ie: fs.existsSync(ieFile) ? parseTemplate(ieFile) : null,
    tx: fs.existsSync(txFile) ? parseTemplate(txFile) : null,
  };
}

if (require.main === module) {
  const bp = process.argv[2] || 'SHOULDER';
  const templates = parseAllTemplates(bp);
  if (templates.ie) {
    console.log('\n=== IE ' + bp + ' (' + templates.ie.fields.length + ' fields) ===');
    for (const f of templates.ie.fields) {
      const opts = f.options.length > 3
        ? '[' + f.options.slice(0, 3).join(', ') + ', ... (' + f.options.length + ')]'
        : '[' + f.options.join(', ') + ']';
      console.log('  #' + f.index + ' ' + f.label + ' (' + f.type + '): ' + opts + ' -> "' + f.defaultValue + '"');
    }
  }
  if (templates.tx) {
    console.log('\n=== TX ' + bp + ' (' + templates.tx.fields.length + ' fields) ===');
    for (const f of templates.tx.fields) {
      const opts = f.options.length > 3
        ? '[' + f.options.slice(0, 3).join(', ') + ', ... (' + f.options.length + ')]'
        : '[' + f.options.join(', ') + ']';
      console.log('  #' + f.index + ' ' + f.label + ' (' + f.type + '): ' + opts + ' -> "' + f.defaultValue + '"');
    }
  }
}

/**
 * Extract MDLand field values from generated SOAP text.
 * Maps SOAP text content back to template ppnSelectCombo field selections.
 */
import type { TemplateField, ParsedTemplate } from './template-parser';

export interface FieldValue {
  index: number;
  label: string;
  type: 'single' | 'multi';
  value: string | string[];
}

export function extractFieldValues(
  soapText: string,
  template: ParsedTemplate,
): Record<string, FieldValue> {
  const result: Record<string, FieldValue> = {};

  for (const field of template.fields) {
    const key = field.label + '_' + field.index;

    if (field.type === 'single') {
      const matched = findBestSingleMatch(soapText, field);
      result[key] = {
        index: field.index,
        label: field.label,
        type: 'single',
        value: matched || field.defaultValue,
      };
    } else {
      const matched = findMultiMatches(soapText, field);
      result[key] = {
        index: field.index,
        label: field.label,
        type: 'multi',
        value: matched.length > 0 ? matched : [field.defaultValue],
      };
    }
  }

  return result;
}

function findBestSingleMatch(text: string, field: TemplateField): string | null {
  // Sort by length descending — longest match first
  const sorted = [...field.options].sort((a, b) => b.length - a.length);
  for (const opt of sorted) {
    if (opt.length < 2) continue;
    if (text.includes(opt)) return opt;
    if (text.toLowerCase().includes(opt.toLowerCase())) return opt;
  }
  return null;
}

function findMultiMatches(text: string, field: TemplateField): string[] {
  const matches: string[] = [];

  // Sort by length descending to prefer longer matches
  const sorted = [...field.options].sort((a, b) => b.length - a.length);
  const alreadyMatched = new Set<number>(); // track matched text positions

  for (const opt of sorted) {
    if (opt.length < 2) continue;

    // For short options (< 5 chars like "70%", "Dull"), use word-boundary matching
    if (opt.length < 5) {
      // Escape regex special chars
      const escaped = opt.replace(/[.*+?^${}()|[\]\\%]/g, '\\$&');
      const re = new RegExp('(?:^|[\\s,;(])' + escaped + '(?:$|[\\s,;).])', 'i');
      if (re.test(text)) {
        matches.push(opt);
      }
    } else {
      // Longer options: simple includes is safe
      const idx = text.indexOf(opt);
      if (idx >= 0 && !alreadyMatched.has(idx)) {
        matches.push(opt);
        // Mark positions to avoid double-counting substrings
        for (let i = idx; i < idx + opt.length; i++) alreadyMatched.add(i);
      } else if (text.toLowerCase().includes(opt.toLowerCase())) {
        matches.push(opt);
      }
    }
  }

  return matches;
}

/**
 * Simplified field map: label -> value for training data
 */
export function extractSimpleFieldMap(
  soapText: string,
  template: ParsedTemplate,
): Record<string, string | string[]> {
  const detailed = extractFieldValues(soapText, template);
  const simple: Record<string, string | string[]> = {};

  const labelCounts: Record<string, number> = {};
  for (const [, fv] of Object.entries(detailed)) {
    const count = (labelCounts[fv.label] || 0);
    labelCounts[fv.label] = count + 1;
    const key = count > 0 ? fv.label + '_' + count : fv.label;
    simple[key] = fv.value;
  }

  return simple;
}

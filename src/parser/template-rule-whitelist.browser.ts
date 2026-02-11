/**
 * Browser-safe template rule whitelist operations.
 * No fs/path dependencies - whitelist must be injected via setWhitelist().
 */

import type { LogicRule } from './logic-rules'

interface TemplateWhitelist {
  allowedFields: Set<string>
  optionsByField: Map<string, Map<string, string>>
}

let cachedWhitelist: TemplateWhitelist | null = null

/**
 * Normalize option string for comparison.
 */
export function normalizeOption(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Inject whitelist from pre-built JSON (for browser environment).
 * Must be called before any getTemplateOptionsForField / getTemplateAlignedRules.
 */
export function setWhitelist(data: Record<string, string[]>): void {
  const allowedFields = new Set<string>(Object.keys(data))
  const optionsByField = new Map<string, Map<string, string>>()
  for (const [field, options] of Object.entries(data)) {
    const m = new Map<string, string>()
    for (const o of options) {
      const key = normalizeOption(o)
      if (!m.has(key)) m.set(key, o)
    }
    optionsByField.set(field, m)
  }
  cachedWhitelist = { allowedFields, optionsByField }
}

/**
 * Check if whitelist is initialized.
 */
export function isWhitelistInitialized(): boolean {
  return cachedWhitelist !== null
}

function getWhitelist(): TemplateWhitelist {
  if (!cachedWhitelist) {
    throw new Error('Whitelist not initialized. Call setWhitelist() first.')
  }
  return cachedWhitelist
}

/**
 * Check if rule is aligned with template fields/options.
 */
export function isRuleTemplateAligned(rule: LogicRule): boolean {
  const whitelist = getWhitelist()

  for (const condition of rule.conditions) {
    if (!whitelist.allowedFields.has(condition.field)) {
      return false
    }
  }

  for (const effect of rule.effects) {
    if (!whitelist.allowedFields.has(effect.targetField)) {
      return false
    }

    const fieldOptionMap = whitelist.optionsByField.get(effect.targetField)
    if (!fieldOptionMap) return false

    for (const option of effect.options) {
      if (!fieldOptionMap.has(normalizeOption(option))) {
        return false
      }
    }
  }

  return true
}

export function getTemplateAlignedRules(rules: LogicRule[]): LogicRule[] {
  return rules.filter(isRuleTemplateAligned)
}

export function getTemplateOptionsForField(fieldPath: string): string[] {
  const whitelist = getWhitelist()
  const optionMap = whitelist.optionsByField.get(fieldPath)
  if (!optionMap) return []
  return Array.from(optionMap.values())
}

export function isTemplateField(fieldPath: string): boolean {
  const whitelist = getWhitelist()
  return whitelist.allowedFields.has(fieldPath)
}

export function getAllTemplateFieldPaths(): string[] {
  const whitelist = getWhitelist()
  return Array.from(whitelist.allowedFields.values())
}

export function getAllTemplateOptionsNormalized(): Set<string> {
  const whitelist = getWhitelist()
  const all = new Set<string>()
  for (const optionMap of whitelist.optionsByField.values()) {
    for (const key of optionMap.keys()) {
      all.add(key)
    }
  }
  return all
}

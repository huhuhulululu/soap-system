/**
 * 模板规则白名单
 * 只允许使用从模板动态解析得到的字段与选项。
 */

import * as fs from 'fs'
import * as path from 'path'
import { parseTemplate, extractDropdowns } from './dropdown-parser'
import type { LogicRule } from './logic-rules'

const TEMPLATE_ROOT = '/Users/ping/Desktop/Code/2_8/templete'
const BASE_TEMPLATE_FOLDERS = ['ie', 'tx']

interface TemplateWhitelist {
  allowedFields: Set<string>
  // key: normalized option, value: first-seen original option
  optionsByField: Map<string, Map<string, string>>
}

let cachedWhitelist: TemplateWhitelist | null = null

/**
 * 从预构建 JSON 注入 whitelist（浏览器环境使用，绕过 fs）。
 * 必须在任何 getTemplateOptionsForField / getTemplateAlignedRules 调用之前执行。
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

function buildTemplateWhitelist(): TemplateWhitelist {
  const allowedFields = new Set<string>()
  const optionsByField = new Map<string, Map<string, string>>()

  const appendDropdowns = (dropdowns: ReturnType<typeof extractDropdowns>) => {
    for (const dropdown of dropdowns) {
      if (dropdown.fieldPath === 'unknown') continue

      allowedFields.add(dropdown.fieldPath)
      if (!optionsByField.has(dropdown.fieldPath)) {
        optionsByField.set(dropdown.fieldPath, new Map<string, string>())
      }

      const optionMap = optionsByField.get(dropdown.fieldPath)!
      for (const option of dropdown.options) {
        const key = normalizeOption(option)
        if (!optionMap.has(key)) {
          optionMap.set(key, option.trim())
        }
      }
    }
  }

  // 1) 基础模板先加载 (IE/TX)
  for (const folder of BASE_TEMPLATE_FOLDERS) {
    const folderPath = path.join(TEMPLATE_ROOT, folder)
    if (!fs.existsSync(folderPath)) continue

    const files = fs.readdirSync(folderPath).filter(name => name.endsWith('.md'))
    for (const fileName of files) {
      const fullPath = path.join(folderPath, fileName)
      const content = fs.readFileSync(fullPath, 'utf-8')
      const parsed = parseTemplate(content, fileName, 'UNKNOWN')
      appendDropdowns(parsed.dropdowns)
    }
  }

  // 2) TONE 统一追加到 O 最后
  {
    const folder = 'tone'
    const folderPath = path.join(TEMPLATE_ROOT, folder)
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath).filter(name => name.endsWith('.md'))
      for (const fileName of files) {
        const fullPath = path.join(folderPath, fileName)
        const content = fs.readFileSync(fullPath, 'utf-8')
        appendDropdowns(extractDropdowns(content, 'O', fileName))
      }
    }
  }

  // 3) NEEDLE 统一追加到 P 最后
  {
    const folder = 'needles'
    const folderPath = path.join(TEMPLATE_ROOT, folder)
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath).filter(name => name.endsWith('.md'))
      for (const fileName of files) {
        const fullPath = path.join(folderPath, fileName)
        const content = fs.readFileSync(fullPath, 'utf-8')
        appendDropdowns(extractDropdowns(content, 'P', fileName))
      }
    }
  }

  return { allowedFields, optionsByField }
}

function getWhitelist(): TemplateWhitelist {
  if (!cachedWhitelist) {
    cachedWhitelist = buildTemplateWhitelist()
  }
  return cachedWhitelist
}

/**
 * 判定规则是否完全来自模板动态字段/选项。
 * 任一 condition/effect 不满足即视为模板外规则。
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

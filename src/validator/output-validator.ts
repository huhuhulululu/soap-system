/**
 * Output Validator — 生成后自检模块
 * 独立于 Generator 和 Checker，避免循环依赖
 *
 * 流程：
 *   SOAP text → parseOptumNote() → checkDocument() → ValidationResult
 */

import { parseOptumNote } from '../../parsers/optum-note/parser'
import { checkDocument } from '../../parsers/optum-note/checker/note-checker'
import type { CheckError, RuleSeverity } from '../../parsers/optum-note/checker/types'

// ============ Types ============

export interface ValidationResult {
    /** 是否通过验证（无 CRITICAL 或 HIGH 错误） */
    valid: boolean
    /** SOAP 原文（透传） */
    text: string
    /** 检测到的错误列表 */
    errors: ValidationError[]
    /** 按严重等级汇总 */
    summary: {
        critical: number
        high: number
        medium: number
        low: number
        total: number
    }
}

export interface ValidationError {
    ruleId: string
    severity: RuleSeverity
    field: string
    message: string
    expected: string
    actual: string
}

// ============ Configuration ============

/** 阻止输出的最低严重等级（CRITICAL 和 HIGH 会阻止） */
const BLOCKING_SEVERITIES: Set<RuleSeverity> = new Set(['CRITICAL', 'HIGH'])

// ============ Core ============

/**
 * 验证 SOAP 文本输出的一致性
 *
 * @param soapText - 由 exportSOAPAsText() 生成的 SOAP 文本
 * @returns ValidationResult — valid=true 表示可安全输出
 */
export function validateOutput(soapText: string): ValidationResult {
    // 1. 回解析
    const parseResult = parseOptumNote(soapText)

    if (!parseResult.document) {
        return {
            valid: false,
            text: soapText,
            errors: [{
                ruleId: 'PARSE_FAIL',
                severity: 'CRITICAL',
                field: 'document',
                message: '生成的 SOAP 文本无法回解析',
                expected: '可解析的 SOAP 文档',
                actual: `解析失败: ${parseResult.errors.map(e => e.message).join('; ')}`,
            }],
            summary: { critical: 1, high: 0, medium: 0, low: 0, total: 1 },
        }
    }

    // 2. 运行 checker
    const checkResult = checkDocument({ document: parseResult.document })

    // 3. 汇总
    const errors: ValidationError[] = checkResult.errors.map(mapError)
    const summary = {
        critical: countBySeverity(checkResult.errors, 'CRITICAL'),
        high: countBySeverity(checkResult.errors, 'HIGH'),
        medium: countBySeverity(checkResult.errors, 'MEDIUM'),
        low: countBySeverity(checkResult.errors, 'LOW'),
        total: checkResult.errors.length,
    }

    const hasBlocking = errors.some(e => BLOCKING_SEVERITIES.has(e.severity))

    return {
        valid: !hasBlocking,
        text: soapText,
        errors,
        summary,
    }
}

/**
 * 仅检查是否有阻塞级别错误（轻量版，不返回完整错误列表）
 */
export function isOutputValid(soapText: string): boolean {
    return validateOutput(soapText).valid
}

// ============ Helpers ============

function mapError(err: CheckError): ValidationError {
    return {
        ruleId: err.ruleId,
        severity: err.severity,
        field: err.field,
        message: err.message,
        expected: err.expected,
        actual: err.actual,
    }
}

function countBySeverity(errors: CheckError[], severity: RuleSeverity): number {
    return errors.filter(e => e.severity === severity).length
}

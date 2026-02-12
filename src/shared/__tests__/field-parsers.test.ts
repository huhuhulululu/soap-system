/**
 * field-parsers.ts 单元测试
 * TDD：覆盖所有 12 个迁移函数的边界情况
 */
import {
    extractPainCurrent,
    parseGoalPainTarget,
    parseAdlSeverity,
    severityToRank,
    compareSeverity,
    parseTendernessScale,
    parseSpasmScale,
    parseStrengthScore,
    parseFrequencyLevel,
    parseProgressStatus,
    extractProgressReasons,
    POSITIVE_PROGRESS_REASONS,
    NEGATIVE_PROGRESS_REASONS,
} from '../field-parsers'

// ============ extractPainCurrent ============

describe('extractPainCurrent', () => {
    it('reads { current } format', () => {
        expect(extractPainCurrent({ current: 6 })).toBe(6)
    })

    it('reads { value } format', () => {
        expect(extractPainCurrent({ value: 5 })).toBe(5)
    })

    it('reads { range: { max } } format', () => {
        expect(extractPainCurrent({ range: { max: 8 } })).toBe(8)
    })

    it('prefers current over value', () => {
        expect(extractPainCurrent({ current: 3, value: 5 })).toBe(3)
    })

    it('returns 7 for null/undefined/empty', () => {
        expect(extractPainCurrent(null)).toBe(7)
        expect(extractPainCurrent(undefined)).toBe(7)
        expect(extractPainCurrent({})).toBe(7)
    })

    it('returns 7 for non-object input', () => {
        expect(extractPainCurrent('string')).toBe(7)
        expect(extractPainCurrent(42)).toBe(7)
    })
})

// ============ parseGoalPainTarget ============

describe('parseGoalPainTarget', () => {
    it('extracts single number', () => {
        expect(parseGoalPainTarget('3')).toBe(3)
    })

    it('extracts min from range "5-6"', () => {
        expect(parseGoalPainTarget('5-6')).toBe(5)
    })

    it('returns null for empty/undefined', () => {
        expect(parseGoalPainTarget(undefined)).toBeNull()
        expect(parseGoalPainTarget('')).toBeNull()
    })

    it('returns null for no numbers', () => {
        expect(parseGoalPainTarget('abc')).toBeNull()
    })
})

// ============ parseAdlSeverity ============

describe('parseAdlSeverity', () => {
    it('detects "moderate to severe"', () => {
        expect(parseAdlSeverity('moderate to severe difficulty of walking')).toBe('moderate to severe')
    })

    it('detects "mild to moderate"', () => {
        expect(parseAdlSeverity('mild to moderate impairment')).toBe('mild to moderate')
    })

    it('detects plain "severe"', () => {
        expect(parseAdlSeverity('severe difficulty')).toBe('severe')
    })

    it('detects plain "moderate" (not confused with compounds)', () => {
        expect(parseAdlSeverity('moderate difficulty')).toBe('moderate')
    })

    it('defaults to "mild" for unrecognized text', () => {
        expect(parseAdlSeverity('some unknown text')).toBe('mild')
        expect(parseAdlSeverity('')).toBe('mild')
    })

    it('is case insensitive', () => {
        expect(parseAdlSeverity('MODERATE TO SEVERE')).toBe('moderate to severe')
    })
})

// ============ severityToRank ============

describe('severityToRank', () => {
    it('maps all severity levels correctly', () => {
        expect(severityToRank('mild')).toBe(1)
        expect(severityToRank('mild to moderate')).toBe(2)
        expect(severityToRank('moderate')).toBe(3)
        expect(severityToRank('moderate to severe')).toBe(4)
        expect(severityToRank('severe')).toBe(5)
    })

    it('defaults to 3 (moderate) for unknown', () => {
        expect(severityToRank('unknown')).toBe(3)
    })

    it('is case insensitive', () => {
        expect(severityToRank('SEVERE')).toBe(5)
        expect(severityToRank('Mild To Moderate')).toBe(2)
    })
})

// ============ compareSeverity ============

describe('compareSeverity', () => {
    it('returns positive when cur is worse', () => {
        expect(compareSeverity('severe', 'mild')).toBeGreaterThan(0)
    })

    it('returns negative when cur is better', () => {
        expect(compareSeverity('mild', 'severe')).toBeLessThan(0)
    })

    it('returns 0 when equal', () => {
        expect(compareSeverity('moderate', 'moderate')).toBe(0)
    })

    it('returns 0 for unknown values', () => {
        expect(compareSeverity('unknown', 'mild')).toBe(0)
        expect(compareSeverity('mild', 'unknown')).toBe(0)
    })
})

// ============ parseTendernessScale ============

describe('parseTendernessScale', () => {
    it('extracts from "(+3) = ..." format', () => {
        expect(parseTendernessScale('(+3) = Patient states that the area is very tender')).toBe(3)
    })

    it('handles +1 through +4', () => {
        expect(parseTendernessScale('+1')).toBe(1)
        expect(parseTendernessScale('+4')).toBe(4)
    })

    it('defaults to 2 when no match', () => {
        expect(parseTendernessScale('no scale info')).toBe(2)
    })
})

// ============ parseSpasmScale ============

describe('parseSpasmScale', () => {
    it('extracts from "(+2)=Occasional" format', () => {
        expect(parseSpasmScale('(+2)=Occasional spontaneous spasms')).toBe(2)
    })

    it('defaults to 2 when no match', () => {
        expect(parseSpasmScale('no scale')).toBe(2)
    })
})

// ============ parseStrengthScore ============

describe('parseStrengthScore', () => {
    it('maps standard strength values', () => {
        expect(parseStrengthScore('0/5')).toBe(0)
        expect(parseStrengthScore('3/5')).toBe(3)
        expect(parseStrengthScore('5/5')).toBe(5)
    })

    it('maps half-grades', () => {
        expect(parseStrengthScore('2+/5')).toBe(2.5)
        expect(parseStrengthScore('3+/5')).toBe(3.5)
        expect(parseStrengthScore('4+/5')).toBe(4.5)
    })

    it('maps minus-grades', () => {
        expect(parseStrengthScore('4-/5')).toBe(3.8)
    })

    it('defaults to 4 for unknown', () => {
        expect(parseStrengthScore('unknown')).toBe(4)
    })

    it('trims whitespace', () => {
        expect(parseStrengthScore('  4/5  ')).toBe(4)
    })
})

// ============ parseFrequencyLevel ============

describe('parseFrequencyLevel', () => {
    it('maps all frequency levels', () => {
        expect(parseFrequencyLevel('Intermittent')).toBe(0)
        expect(parseFrequencyLevel('Occasional')).toBe(1)
        expect(parseFrequencyLevel('Frequent')).toBe(2)
        expect(parseFrequencyLevel('Constant')).toBe(3)
    })

    it('is case insensitive', () => {
        expect(parseFrequencyLevel('OCCASIONAL')).toBe(1)
    })

    it('matches partial text (includes)', () => {
        expect(parseFrequencyLevel('Frequent (50-75% of the day)')).toBe(2)
    })

    it('defaults to 2 (frequent) for unknown', () => {
        expect(parseFrequencyLevel('unknown')).toBe(2)
        expect(parseFrequencyLevel('')).toBe(2)
    })
})

// ============ parseProgressStatus ============

describe('parseProgressStatus', () => {
    it('detects improvement', () => {
        expect(parseProgressStatus('improvement of symptom(s)')).toBe('improvement')
    })

    it('detects exacerbate', () => {
        expect(parseProgressStatus('exacerbate of symptom(s)')).toBe('exacerbate')
    })

    it('detects similar', () => {
        expect(parseProgressStatus('similar symptom as last visit')).toBe('similar')
    })

    it('returns null for unrecognized', () => {
        expect(parseProgressStatus('something else')).toBeNull()
        expect(parseProgressStatus('')).toBeNull()
    })
})

// ============ extractProgressReasons ============

describe('extractProgressReasons', () => {
    it('extracts positive reasons', () => {
        const result = extractProgressReasons(
            'improvement of symptom(s) because of maintain regular treatments and reduced level of pain'
        )
        expect(result.positive).toContain('maintain regular treatments')
        expect(result.positive).toContain('reduced level of pain')
        expect(result.negative).toHaveLength(0)
    })

    it('extracts negative reasons', () => {
        const result = extractProgressReasons(
            'exacerbate of symptom(s) because of skipped treatments and bad posture'
        )
        expect(result.negative).toContain('skipped treatments')
        expect(result.negative).toContain('bad posture')
        expect(result.positive).toHaveLength(0)
    })

    it('returns empty arrays for unrecognized text', () => {
        const result = extractProgressReasons('no known reasons')
        expect(result.positive).toHaveLength(0)
        expect(result.negative).toHaveLength(0)
    })

    it('reason lists are exported and non-empty', () => {
        expect(POSITIVE_PROGRESS_REASONS.length).toBeGreaterThan(0)
        expect(NEGATIVE_PROGRESS_REASONS.length).toBeGreaterThan(0)
    })
})

/**
 * body-part-constants.ts 单元测试
 * 验证所有身体部位映射的完整性和 romLimitFactor 的计算正确性
 */
import {
    BODY_PART_MUSCLES,
    BODY_PART_ADL,
    BODY_PART_ROM,
    romLimitFactor,
    ICD_BODY_MAP,
    ICD_LATERALITY_SUFFIX,
    BODY_PART_NEEDLE_GAUGES,
} from '../body-part-constants'

// ============ BODY_PART_MUSCLES ============

describe('BODY_PART_MUSCLES', () => {
    const REQUIRED_BODY_PARTS = ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'HIP', 'ELBOW']

    it('covers all required body parts', () => {
        for (const bp of REQUIRED_BODY_PARTS) {
            expect(BODY_PART_MUSCLES[bp]).toBeDefined()
            expect(BODY_PART_MUSCLES[bp].length).toBeGreaterThan(0)
        }
    })

    it('LBP has core muscles', () => {
        expect(BODY_PART_MUSCLES.LBP).toContain('Iliopsoas Muscle')
        expect(BODY_PART_MUSCLES.LBP).toContain('Gluteal Muscles')
    })

    it('KNEE has full treatment chain', () => {
        expect(BODY_PART_MUSCLES.KNEE).toContain('Rectus Femoris')
        expect(BODY_PART_MUSCLES.KNEE).toContain('Hamstrings muscle group')
        expect(BODY_PART_MUSCLES.KNEE.length).toBeGreaterThanOrEqual(10)
    })
})

// ============ BODY_PART_ADL ============

describe('BODY_PART_ADL', () => {
    it('covers all required body parts', () => {
        for (const bp of ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'HIP', 'ELBOW']) {
            expect(BODY_PART_ADL[bp]).toBeDefined()
            expect(BODY_PART_ADL[bp].length).toBeGreaterThan(0)
        }
    })

    it('SHOULDER has cooking and computer ADLs', () => {
        expect(BODY_PART_ADL.SHOULDER).toContain('holding the pot for cooking')
        expect(BODY_PART_ADL.SHOULDER).toContain('working long time in front of computer')
    })
})

// ============ BODY_PART_ROM ============

describe('BODY_PART_ROM', () => {
    it('covers core body parts', () => {
        for (const bp of ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'ELBOW']) {
            expect(BODY_PART_ROM[bp]).toBeDefined()
            expect(BODY_PART_ROM[bp].length).toBeGreaterThan(0)
        }
    })

    it('each ROM entry has required fields', () => {
        for (const bp of Object.keys(BODY_PART_ROM)) {
            for (const rom of BODY_PART_ROM[bp]) {
                expect(rom.movement).toBeTruthy()
                expect(typeof rom.normalDegrees).toBe('number')
                expect(['EASY', 'MEDIUM', 'HARD']).toContain(rom.difficulty)
            }
        }
    })

    it('LBP has 6 ROM movements', () => {
        expect(BODY_PART_ROM.LBP).toHaveLength(6)
    })

    it('KNEE has Flexion and Extension', () => {
        const movements = BODY_PART_ROM.KNEE.map(r => r.movement)
        expect(movements).toContain('Flexion(fully bent)')
        expect(movements).toContain('Extension(fully straight)')
    })
})

// ============ romLimitFactor ============

describe('romLimitFactor', () => {
    it('returns 1.0 for pain=0', () => {
        expect(romLimitFactor(0)).toBe(1.0)
    })

    it('returns 0.6 for pain=10', () => {
        expect(romLimitFactor(10)).toBe(0.6)
    })

    it('breakpoints match exactly', () => {
        expect(romLimitFactor(3)).toBeCloseTo(0.95, 2)
        expect(romLimitFactor(6)).toBeCloseTo(0.85, 2)
        expect(romLimitFactor(8)).toBeCloseTo(0.77, 2)
    })

    it('interpolates between breakpoints', () => {
        const f5 = romLimitFactor(5)
        expect(f5).toBeGreaterThan(romLimitFactor(6))
        expect(f5).toBeLessThan(romLimitFactor(3))
    })

    it('clamps at boundaries', () => {
        expect(romLimitFactor(-1)).toBe(1.0)
        expect(romLimitFactor(11)).toBe(0.6)
    })
})

// ============ ICD_BODY_MAP ============

describe('ICD_BODY_MAP', () => {
    it('KNEE starts with M17', () => {
        expect(ICD_BODY_MAP.KNEE).toContain('M17')
    })

    it('LBP starts with M54.5', () => {
        expect(ICD_BODY_MAP.LBP).toContain('M54.5')
    })
})

// ============ ICD_LATERALITY_SUFFIX ============

describe('ICD_LATERALITY_SUFFIX', () => {
    it('right includes suffix 1', () => {
        expect(ICD_LATERALITY_SUFFIX.right).toContain('1')
    })

    it('left includes suffix 2', () => {
        expect(ICD_LATERALITY_SUFFIX.left).toContain('2')
    })

    it('bilateral includes suffix 3', () => {
        expect(ICD_LATERALITY_SUFFIX.bilateral).toContain('3')
    })
})

// ============ BODY_PART_NEEDLE_GAUGES ============

describe('BODY_PART_NEEDLE_GAUGES', () => {
    it('all parts have at least 2 gauge sizes', () => {
        for (const bp of Object.keys(BODY_PART_NEEDLE_GAUGES)) {
            expect(BODY_PART_NEEDLE_GAUGES[bp].length).toBeGreaterThanOrEqual(2)
        }
    })
})

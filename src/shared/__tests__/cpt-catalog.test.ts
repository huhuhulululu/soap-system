import { getCPTName, getCPTEntry, getAllCPTEntries, getDefaultTXCPT, parseCPTString } from '../cpt-catalog'

describe('cpt-catalog', () => {
  describe('getCPTName', () => {
    it('returns name for acupuncture codes', () => {
      expect(getCPTName('97810')).toBe('ACUP 1/> WO ESTIM 1ST 15 MIN')
      expect(getCPTName('97811')).toBe('ACUP 1/> W/O ESTIM EA ADD 15')
      expect(getCPTName('97813')).toBe('ACUP 1/> W/ESTIM 1ST 15 MIN')
      expect(getCPTName('97814')).toBe('ACUP 1/> W/ESTIM EA ADDL 15')
    })

    it('returns name for manual therapy code', () => {
      expect(getCPTName('97140')).toBe('MANUAL THERAPY 1/> REGIONS')
    })

    it('returns name for PT eval codes', () => {
      expect(getCPTName('97161')).toBe('PT EVAL LOW COMPLEX 20 MIN')
      expect(getCPTName('97162')).toBe('PT EVAL MOD COMPLEX 30 MIN')
      expect(getCPTName('97163')).toBe('PT EVAL HIGH COMPLEX 45 MIN')
    })

    it('returns name for office visit codes', () => {
      expect(getCPTName('99203')).toBe('OFFICE O/P NEW LOW 30 MIN')
      expect(getCPTName('99213')).toBe('OFFICE O/P EST LOW 20 MIN')
    })

    it('returns code itself for unknown code', () => {
      expect(getCPTName('99999')).toBe('99999')
    })
  })

  describe('getCPTEntry', () => {
    it('returns full entry with electrical stimulation flag', () => {
      const entry = getCPTEntry('97813')
      expect(entry).toEqual({
        code: '97813',
        name: 'ACUP 1/> W/ESTIM 1ST 15 MIN',
        hasElectricalStimulation: true
      })
    })

    it('97810 has no electrical stimulation', () => {
      expect(getCPTEntry('97810')?.hasElectricalStimulation).toBe(false)
    })

    it('97814 has electrical stimulation', () => {
      expect(getCPTEntry('97814')?.hasElectricalStimulation).toBe(true)
    })

    it('returns undefined for unknown code', () => {
      expect(getCPTEntry('INVALID')).toBeUndefined()
    })
  })

  describe('getAllCPTEntries', () => {
    it('returns all entries', () => {
      const entries = getAllCPTEntries()
      expect(entries.length).toBeGreaterThanOrEqual(11)
    })

    it('has no duplicate codes', () => {
      const entries = getAllCPTEntries()
      const codes = entries.map(e => e.code)
      expect(new Set(codes).size).toBe(codes.length)
    })
  })

  describe('getDefaultTXCPT', () => {
    it('HF returns 97810 x1 only', () => {
      const result = getDefaultTXCPT('HF')
      expect(result).toEqual([
        { code: '97810', name: 'ACUP 1/> WO ESTIM 1ST 15 MIN', units: 1 }
      ])
    })

    it('OPTUM returns 97810 x1 only', () => {
      const result = getDefaultTXCPT('OPTUM')
      expect(result).toHaveLength(1)
      expect(result[0].code).toBe('97810')
    })

    it('WC returns 97813x1 + 97814x2 + 97811x1', () => {
      const result = getDefaultTXCPT('WC')
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ code: '97813', name: 'ACUP 1/> W/ESTIM 1ST 15 MIN', units: 1 })
      expect(result[1]).toEqual({ code: '97814', name: 'ACUP 1/> W/ESTIM EA ADDL 15', units: 2 })
      expect(result[2]).toEqual({ code: '97811', name: 'ACUP 1/> W/O ESTIM EA ADD 15', units: 1 })
    })

    it('VC returns 97813x1 + 97814x1 + 97811x2', () => {
      const result = getDefaultTXCPT('VC')
      expect(result).toHaveLength(3)
      expect(result[1].units).toBe(1)  // 97814 x1 for VC
      expect(result[2].units).toBe(2)  // 97811 x2 for VC
    })

    it('ELDERPLAN returns 97810 x1', () => {
      const result = getDefaultTXCPT('ELDERPLAN')
      expect(result).toHaveLength(1)
      expect(result[0].code).toBe('97810')
    })

    it('NONE returns 97810 x1', () => {
      const result = getDefaultTXCPT('NONE')
      expect(result).toHaveLength(1)
    })
  })

  describe('parseCPTString', () => {
    it('parses single code', () => {
      expect(parseCPTString('97810')).toEqual([
        { code: '97810', name: 'ACUP 1/> WO ESTIM 1ST 15 MIN', units: 1 }
      ])
    })

    it('parses code with units', () => {
      expect(parseCPTString('97811x3')).toEqual([
        { code: '97811', name: 'ACUP 1/> W/O ESTIM EA ADD 15', units: 3 }
      ])
    })

    it('parses comma-separated codes', () => {
      const result = parseCPTString('97813,97814x2,97811')
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ code: '97813', name: 'ACUP 1/> W/ESTIM 1ST 15 MIN', units: 1 })
      expect(result[1]).toEqual({ code: '97814', name: 'ACUP 1/> W/ESTIM EA ADDL 15', units: 2 })
      expect(result[2]).toEqual({ code: '97811', name: 'ACUP 1/> W/O ESTIM EA ADD 15', units: 1 })
    })

    it('returns empty array for empty string', () => {
      expect(parseCPTString('')).toEqual([])
      expect(parseCPTString('   ')).toEqual([])
    })

    it('throws for invalid format', () => {
      expect(() => parseCPTString('abc')).toThrow('Invalid CPT format')
    })

    it('handles unknown code with code as name', () => {
      const result = parseCPTString('12345x2')
      expect(result[0]).toEqual({ code: '12345', name: '12345', units: 2 })
    })

    it('handles spaces around commas', () => {
      const result = parseCPTString('97810 , 97811x3')
      expect(result).toHaveLength(2)
    })
  })
})

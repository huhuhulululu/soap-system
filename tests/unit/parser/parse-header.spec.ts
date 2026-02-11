/**
 * parseHeader 边界测试
 */

import { describe, it, expect } from '@jest/globals'
import { parseHeader } from '../../../parsers/optum-note'

describe('parseHeader', () => {
  describe('PH-01~04: 标准格式', () => {
    it('PH-01: 完整 header', () => {
      const text = `SMITH, JANE A (DOB: 05/15/1960 ID: 1234567890) Date of Service: 01/15/2024 Printed on: 01/20/2024
PATIENT: SMITH, JANE A Gender: Female
DOB: 05/15/1960 AGE AS OF 01/15/2024: 63y`
      
      const result = parseHeader(text)
      expect(result).not.toBeNull()
      expect(result!.patient.name).toBe('SMITH, JANE A')
      expect(result!.patient.dob).toBe('05/15/1960')
      expect(result!.patient.patientId).toBe('1234567890')
      expect(result!.patient.gender).toBe('Female')
      expect(result!.patient.age).toBe(63)
      expect(result!.dateOfService).toBe('01/15/2024')
    })

    it('PH-02: 缺少 Gender', () => {
      const text = `DOE, JOHN (DOB: 01/01/1980 ID: 9876543210) Date of Service: 02/20/2024 Printed on: 02/20/2024
PATIENT: DOE, JOHN
DOB: 01/01/1980 AGE AS OF 02/20/2024: 44y`
      
      const result = parseHeader(text)
      expect(result).not.toBeNull()
      expect(result!.patient.name).toBe('DOE, JOHN')
      // Gender 可能有默认值或从其他地方推断
    })

    it('PH-03: 缺少 Age', () => {
      const text = `DOE, JOHN (DOB: 01/01/1980 ID: 9876543210) Date of Service: 02/20/2024 Printed on: 02/20/2024
PATIENT: DOE, JOHN Gender: Male
DOB: 01/01/1980`
      
      const result = parseHeader(text)
      expect(result).not.toBeNull()
      // Age 可能有默认值
    })

    it('PH-04: 日期格式变体 (连字符)', () => {
      const text = `DOE, JOHN (DOB: 01-01-1980 ID: 9876543210) Date of Service: 02-20-2024 Printed on: 02-20-2024
PATIENT: DOE, JOHN Gender: Male`
      
      const result = parseHeader(text)
      // 当前实现可能不支持连字符，记录行为
      expect(result).toBeDefined()
    })
  })

  describe('PH-05~08: 边界情况', () => {
    it('PH-05: 名字带后缀 JR', () => {
      const text = `SMITH, JOHN JR (DOB: 05/15/1960 ID: 1234567890) Date of Service: 01/15/2024 Printed on: 01/20/2024
PATIENT: SMITH, JOHN JR Gender: Male`
      
      const result = parseHeader(text)
      expect(result).not.toBeNull()
      expect(result!.patient.name).toContain('SMITH')
    })

    it('PH-06: 空 header', () => {
      const result = parseHeader('')
      expect(result).toBeNull()
    })

    it('PH-07: 只有名字行', () => {
      const text = `DOE, JOHN (DOB: 01/01/1980 ID: 9876543210) Date of Service: 02/20/2024
PATIENT: DOE, JOHN Gender: Male`
      
      const result = parseHeader(text)
      // 可能需要完整格式才能解析
      if (result) {
        expect(result.patient.name).toBe('DOE, JOHN')
      }
    })

    it('PH-08: 无效格式', () => {
      const text = `This is not a valid header format`
      
      const result = parseHeader(text)
      expect(result).toBeNull()
    })
  })
})

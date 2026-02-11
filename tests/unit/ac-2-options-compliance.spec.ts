/**
 * AC-2: 选项合规测试
 * 验证生成器输出的动态字段值在模板定义的选项中
 */
import { exportSOAPAsText } from '../../src/index'
import * as fs from 'fs'

const templateOptions = JSON.parse(
  fs.readFileSync('src/auditor/baselines/template-options.json', 'utf-8')
)

describe('AC-2: 选项合规', () => {
  const baseContext = {
    noteType: 'IE' as const,
    insuranceType: 'OPTUM' as const,
    primaryBodyPart: 'KNEE' as const,
    laterality: 'bilateral' as const,
    localPattern: 'Cold-Damp + Wind-Cold',
    systemicPattern: 'Kidney Yang Deficiency',
    chronicityLevel: 'Chronic' as const,
    severityLevel: 'moderate to severe' as const,
    hasPacemaker: false,
  }

  describe('AC-2.1 chronicityLevel', () => {
    const valid = templateOptions.chronicityLevel.options as string[]
    
    it('Acute 是合法值', () => expect(valid).toContain('Acute'))
    it('Sub Acute 是合法值', () => expect(valid).toContain('Sub Acute'))
    it('Chronic 是合法值', () => expect(valid).toContain('Chronic'))
    it('生成文本包含 chronicityLevel', () => {
      const text = exportSOAPAsText(baseContext)
      expect(text).toContain('Chronic')
    })
  })

  describe('AC-2.2 severityLevel', () => {
    const valid = templateOptions.severityLevel.options as string[]

    it('severe 是合法值', () => expect(valid).toContain('severe'))
    it('moderate to severe 是合法值', () => expect(valid).toContain('moderate to severe'))
    it('moderate 是合法值', () => expect(valid).toContain('moderate'))
    it('mild to moderate 是合法值', () => expect(valid).toContain('mild to moderate'))
    it('mild 是合法值', () => expect(valid).toContain('mild'))
  })

  describe('AC-2.3 generalCondition', () => {
    const valid = templateOptions.generalCondition.options as string[]

    it('good 是合法值', () => expect(valid).toContain('good'))
    it('fair 是合法值', () => expect(valid).toContain('fair'))
    it('poor 是合法值', () => expect(valid).toContain('poor'))
  })

  describe('AC-2.4 painTypes', () => {
    const valid = templateOptions.painTypes.options as string[]

    it('Dull 是合法值', () => expect(valid).toContain('Dull'))
    it('Aching 是合法值', () => expect(valid).toContain('Aching'))
    it('Burning 是合法值', () => expect(valid).toContain('Burning'))
    it('Freezing 是合法值', () => expect(valid).toContain('Freezing'))
    it('Stabbing 是合法值', () => expect(valid).toContain('Stabbing'))
  })

  describe('AC-2.5 localPattern', () => {
    const valid = templateOptions.localPattern.options as string[]

    it('Qi Stagnation 是合法值', () => expect(valid).toContain('Qi Stagnation'))
    it('Blood Stasis 是合法值', () => expect(valid).toContain('Blood Stasis'))
    it('Cold-Damp + Wind-Cold 是合法值', () => expect(valid).toContain('Cold-Damp + Wind-Cold'))
  })

  describe('AC-2.6 systemicPattern', () => {
    const valid = templateOptions.systemicPattern.options as string[]

    it('Kidney Yang Deficiency 是合法值', () => expect(valid).toContain('Kidney Yang Deficiency'))
    it('Qi Deficiency 是合法值', () => expect(valid).toContain('Qi Deficiency'))
    it('Blood Deficiency 是合法值', () => expect(valid).toContain('Blood Deficiency'))
  })

  describe('AC-2.7 painScale', () => {
    const valid = templateOptions.painScale.options as string[]

    it('包含 10', () => expect(valid).toContain('10'))
    it('包含 8-7', () => expect(valid).toContain('8-7'))
    it('包含 5', () => expect(valid).toContain('5'))
    it('包含 0', () => expect(valid).toContain('0'))
  })
})

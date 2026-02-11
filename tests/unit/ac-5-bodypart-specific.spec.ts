/**
 * AC-5: 部位特定规则测试
 * 验证不同身体部位的肌肉群和 ROM 项匹配
 */
import { exportSOAPAsText } from '../../src/index'

describe('AC-5: 部位特定规则', () => {
  const makeContext = (bodyPart: string) => ({
    noteType: 'IE' as const,
    insuranceType: 'OPTUM' as const,
    primaryBodyPart: bodyPart as any,
    laterality: 'bilateral' as const,
    localPattern: bodyPart === 'KNEE' ? 'Cold-Damp + Wind-Cold' : 'Qi Stagnation, Blood Stasis',
    systemicPattern: bodyPart === 'KNEE' ? 'Kidney Yang Deficiency' : 'Qi & Blood Deficiency',
    chronicityLevel: 'Chronic' as const,
    severityLevel: 'moderate to severe' as const,
    hasPacemaker: false,
  })

  describe('AC-5.1 KNEE 肌肉群', () => {
    it('包含 Quadratus femoris', () => {
      const text = exportSOAPAsText(makeContext('KNEE'))
      expect(text).toMatch(/Quadratus femoris|quadratus femoris/i)
    })

    it('包含 Flexion ROM', () => {
      const text = exportSOAPAsText(makeContext('KNEE'))
      expect(text).toMatch(/Flexion/i)
    })

    it('包含 Extension ROM', () => {
      const text = exportSOAPAsText(makeContext('KNEE'))
      expect(text).toMatch(/Extension/i)
    })
  })

  describe('AC-5.2 LBP 肌肉群', () => {
    it('包含腰部肌肉', () => {
      const text = exportSOAPAsText(makeContext('LBP'))
      expect(text).toMatch(/Quadratus Lumborum|Iliopsoas|Gluteal|iliocostalis/i)
    })

    it('包含 Flexion ROM', () => {
      const text = exportSOAPAsText(makeContext('LBP'))
      expect(text).toMatch(/Flexion/i)
    })
  })

  describe('AC-5.3 SHOULDER 肌肉群', () => {
    it('包含肩部肌肉', () => {
      const text = exportSOAPAsText(makeContext('SHOULDER'))
      expect(text).toMatch(/Supraspinatus|Infraspinatus|Deltoid|Trapezius|Rotator/i)
    })

    it('包含 Abduction ROM', () => {
      const text = exportSOAPAsText(makeContext('SHOULDER'))
      expect(text).toMatch(/Abduction/i)
    })
  })

  describe('AC-5.4 NECK 肌肉群', () => {
    it('包含颈部肌肉', () => {
      const text = exportSOAPAsText(makeContext('NECK'))
      expect(text).toMatch(/Sternocleidomastoid|Scalene|Trapezius|Levator|SCM/i)
    })

    it('包含 Rotation ROM', () => {
      const text = exportSOAPAsText(makeContext('NECK'))
      expect(text).toMatch(/Rotation/i)
    })
  })

  describe('AC-5.5 ELBOW 肌肉群', () => {
    it('包含肘部肌肉', () => {
      const text = exportSOAPAsText(makeContext('ELBOW'))
      expect(text).toMatch(/Biceps|Triceps|Brachioradialis|Pronator|Supinator/i)
    })
  })
})

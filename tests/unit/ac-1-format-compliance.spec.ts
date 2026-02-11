/**
 * AC-1: 格式合规测试
 * 验证生成文本包含 generator 定义的静态文本
 */
import { exportSOAPAsText, exportTXSeriesAsText } from '../../src/index'
import * as fs from 'fs'

const generatorFormat = JSON.parse(
  fs.readFileSync('src/auditor/baselines/generator-format.json', 'utf-8')
)

describe('AC-1: 格式合规', () => {
  const ieContext = {
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

  const txContext = { ...ieContext, noteType: 'TX' as const }

  describe('AC-1.1 Subjective 静态文本', () => {
    it('包含 "Patient c/o"', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Patient c\/o/i)
    })

    it('包含 "Pain Scale:"', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Pain Scale:/i)
    })

    it('包含 "Pain Frequency:"', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Pain Frequency:/i)
    })
  })

  describe('AC-1.2 Objective 静态文本', () => {
    it('包含 "Tightness" 相关文本', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Tightness|tightness/i)
    })

    it('包含 "Tenderness" 相关文本', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Tenderness|tenderness/i)
    })

    it('包含 ROM 相关文本', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/ROM|Flexion|Extension/i)
    })
  })

  describe('AC-1.3 Assessment 静态文本', () => {
    it('包含 "TCM Dx:"', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/TCM Dx:|TCM diagnosis/i)
    })

    it('包含证型描述', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Cold-Damp|Kidney Yang/i)
    })
  })

  describe('AC-1.4 Plan 静态文本 (IE)', () => {
    it('IE 包含 "Short Term Goal"', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Short Term Goal/i)
    })

    it('IE 包含 "Long Term Goal"', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Long Term Goal/i)
    })
  })

  describe('AC-1.5 Plan 静态文本 (TX)', () => {
    it('TX 包含针刺治疗描述', () => {
      const series = exportTXSeriesAsText(txContext, { txCount: 1 })
      expect(series[0].text).toMatch(/Acupuncture|needle|treatment/i)
    })
  })

  describe('AC-1.6 SOAP 段落结构', () => {
    it('IE 包含 Subjective 段落', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Subjective|Patient c\/o/i)
    })

    it('IE 包含 Objective 段落', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Objective|Muscles Testing/i)
    })

    it('IE 包含 Assessment 段落', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Assessment|TCM Dx/i)
    })

    it('IE 包含 Plan 段落', () => {
      const text = exportSOAPAsText(ieContext)
      expect(text).toMatch(/Plan|Goal/i)
    })
  })
})

/**
 * 从 tx-sequence-engine.ts 提取逻辑约束
 * 基准 3: 引擎逻辑约束
 */
import * as fs from 'fs'

const rules = {
  pain: {
    trend: "TX(n+1).pain ≤ TX(n).pain + 0.1",
    firstDecrease: "TX1.pain ∈ [IE.pain - 1.5, IE.pain - 0.5]",
    snapGrid: "pain 吸附到 0.5 刻度网格"
  },
  tightness: {
    trend: "随 pain 同向变化",
    mapping: {
      "severe": 4,
      "moderate to severe": 3.5,
      "moderate": 3,
      "mild to moderate": 2,
      "mild": 1
    }
  },
  tenderness: {
    trend: "整体下降，允许波动",
    scale: "(+4) → (+3) → (+2) → (+1) → (0)"
  },
  rom: {
    trend: "整体改善（数值增加）"
  },
  soaChain: {
    painToSymptom: {
      "pain↓ ≥1": ["improvement", "slight improvement"],
      "pain↓ <1": ["slight improvement", "no change"],
      "pain↑": ["exacerbate", "no change"]
    },
    objectiveToAssessment: {
      "tightness↓": ["reduced", "slightly reduced"],
      "tightness=": ["remained the same"],
      "tightness↑": ["increased"]
    }
  },
  generalCondition: {
    "pain ≥7": ["poor", "fair"],
    "pain 4-6": ["fair", "good"],
    "pain ≤3": ["good"]
  },
  txLimit: 11
}

const outputDir = 'src/auditor/baselines'
fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(
  `${outputDir}/engine-rules.json`,
  JSON.stringify(rules, null, 2)
)

console.log('引擎规则提取完成')
console.log(JSON.stringify(rules, null, 2))

# Goals 动态计算流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           用户输入 / 解析结果                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  GenerationContext                                                          │
│  ├── severityLevel: "moderate to severe"                                    │
│  ├── primaryBodyPart: "KNEE"                                                │
│  ├── associatedSymptom: "soreness" | "weakness" | "numbness" | ...          │
│  └── chronicityLevel: "Chronic"                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        calculateDynamicGoals()                              │
│                     (goals-calculator.ts)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ parsePainFrom   │    │ calculatePain   │    │ calculateSymptom│         │
│  │ Severity()      │───▶│ Goals()         │    │ PctGoals()      │         │
│  │                 │    │                 │    │                 │         │
│  │ "mod-sev" → 8   │    │ Pain 8:         │    │ "mod-sev":      │         │
│  └─────────────────┘    │ ST: 5-6         │    │ ST: (50%-60%)   │         │
│                         │ LT: 2-3         │    │ LT: (20%-30%)   │         │
│                         └─────────────────┘    └─────────────────┘         │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ calculateTight  │    │ calculateTender │    │ calculateSpasm  │         │
│  │ nessGoals()     │    │ nessGoals()     │    │ Goals()         │         │
│  │                 │    │                 │    │                 │         │
│  │ idx=3 (mod-sev) │    │ Grade 4:        │    │ Grade 3:        │         │
│  │ ST: moderate    │    │ ST: Grade 3     │    │ ST: Grade 2     │         │
│  │ LT: mild        │    │ LT: Grade 1     │    │ LT: Grade 0     │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ calculateROM    │    │ calculateStreng │    │ calculateADL    │         │
│  │ Goals()         │    │ thGoals()       │    │ Goals()         │         │
│  │                 │    │                 │    │                 │         │
│  │ "mod-sev":      │    │ 3+/5:           │    │ = Tightness     │         │
│  │ ST: 60%         │    │ ST: 4           │    │ ST: moderate    │         │
│  │ LT: 80%         │    │ LT: 4+          │    │ LT: mild        │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DynamicGoals 输出                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  {                                                                          │
│    pain:        { st: "5-6",      lt: "2-3"      }                          │
│    symptomType: "soreness"                                                  │
│    symptomPct:  { st: "(50%-60%)", lt: "(20%-30%)" }                        │
│    tightness:   { st: "moderate", lt: "mild"     }                          │
│    tenderness:  { st: 3,          lt: 1          }                          │
│    spasm:       { st: 2,          lt: 0          }                          │
│    strength:    { st: "4",        lt: "4+"       }                          │
│    rom:         { st: "60%",      lt: "80%"      }                          │
│    adl:         { st: "moderate", lt: "mild"     }                          │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          generatePlanIE()                                   │
│                       (soap-generator.ts)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Short Term Goal (12 treatments in 5-6 weeks):                              │
│  ├── Decrease Pain Scale to5-6.                                             │
│  ├── Decrease soreness sensation Scale to (50%-60%)                         │
│  ├── Decrease Muscles Tightness to moderate                                 │
│  ├── Decrease Muscles Tenderness to Grade 3                                 │
│  ├── Decrease Muscles Spasms to Grade 2                                     │
│  └── Increase Muscles Strength to4                                          │
│                                                                             │
│  Long Term Goal (8 treatments in 5-6 weeks):                                │
│  ├── Decrease Pain Scale to2-3                                              │
│  ├── Decrease soreness sensation Scale to (20%-30%)                         │
│  ├── Decrease Muscles Tightness to mild                                     │
│  ├── Decrease Muscles Tenderness to Grade 1                                 │
│  ├── Decrease Muscles Spasms to Grade 0                                     │
│  ├── Increase Muscles Strength to4+                                         │
│  ├── Increase ROM 80%                                                       │
│  └── Decrease impaired Activities of Daily Living to mild.                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TX Sequence Engine                                   │
│                    (tx-sequence-engine.ts)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  IE ──▶ TX1 ──▶ TX2 ──▶ ... ──▶ TX12 ──▶ ... ──▶ TX20                      │
│  │      │       │               │                 │                         │
│  │      │       │               │                 │                         │
│  ▼      ▼       ▼               ▼                 ▼                         │
│  Pain   Pain    Pain            Pain              Pain                      │
│  8.0    7.7     7.5             5.5               2.5                       │
│                                 ▲                 ▲                         │
│                                 │                 │                         │
│                            ST Goal 达成       LT Goal 达成                   │
│                            (5-6 范围内)       (2-3 范围内)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                              调用链路总览
═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   前端 UI    │     │   Parser     │     │  Generator   │
  │  (用户输入)   │────▶│  (解析文档)   │────▶│  (生成SOAP)  │
  └──────────────┘     └──────────────┘     └──────────────┘
                                                   │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                              ▼                     ▼                     ▼
                    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
                    │ generatePlan │     │ generateTX   │     │ tx-sequence  │
                    │ IE()         │     │ Sequence()   │     │ -engine      │
                    └──────────────┘     └──────────────┘     └──────────────┘
                              │                     │                     │
                              ▼                     │                     │
                    ┌──────────────┐                │                     │
                    │ calculate    │◀───────────────┴─────────────────────┘
                    │ DynamicGoals │        Goals 用于验证 TX 序列是否达标
                    └──────────────┘


═══════════════════════════════════════════════════════════════════════════════
                           Severity → Goals 映射表
═══════════════════════════════════════════════════════════════════════════════

  Severity          │ Pain │ ST Pain │ LT Pain │ Tightness ST │ Tightness LT
  ──────────────────┼──────┼─────────┼─────────┼──────────────┼──────────────
  severe            │  10  │    6    │   3-4   │  mod-sev     │  mild-mod
  moderate to severe│   8  │   5-6   │   2-3   │  moderate    │  mild
  moderate          │   7  │    4    │   2-3   │  mild-mod    │  mild
  mild to moderate  │   5  │    5    │    3    │  mild-mod    │  mild
  mild              │   4  │    4    │    2    │  mild        │  mild


═══════════════════════════════════════════════════════════════════════════════
                           指标关联性约束
═══════════════════════════════════════════════════════════════════════════════

  Pain ────────────▶ Tenderness (强相关: Pain↓ → Tenderness↓)
    │
    ▼
  Tightness ───────▶ Spasm (强相关: Tightness↓ → Spasm↓)
    │
    ▼
  ROM ─────────────▶ (Tightness↓ → ROM↑)
    │
    ▼
  Strength ────────▶ (ROM↑ → Strength 可训练)
    │
    ▼
  ADL ─────────────▶ (综合指标 = Tightness)

```

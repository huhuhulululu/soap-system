# SPEC 1: 全面测试模块

**版本**: v1.0  
**日期**: 2026-02-10  
**范围**: 生成器、解析器、引擎的功能验证

---

## 审核基准 (三层)

| 层级 | 来源文件 | 验证内容 |
|------|----------|----------|
| **基准 1** | `soap-generator.ts` | 文本格式 |
| **基准 2** | `tests/alltest/*.md` | 动态字段合法值 |
| **基准 3** | `tx-sequence-engine.ts` | 数值逻辑 |

---

## AC-1: 格式合规

### AC-1.1 静态文本完整
| 段落 | 必须包含 |
|------|----------|
| S | `"Patient c/o"`, `"which is"`, `"Pain Scale:"`, `"Pain Frequency:"` |
| O | `"Tightness muscles noted along"`, `"Tenderness muscle noted along"`, `"Muscles spasm noted along"` |
| A | `"TCM Dx:"`, `"Today's TCM treatment principles:"` |
| P | `"Short Term Goal"`, `"Long Term Goal"` (IE) |

### AC-1.2 动态插值位置
```
✅ "Patient c/o Chronic pain in bilateral Knee area"
❌ "Chronic Patient c/o pain..."
```

**用例**: 10

---

## AC-2: 选项合规

### AC-2.1 单选字段
| 字段 | 合法值 |
|------|--------|
| chronicityLevel | `Acute`, `Sub Acute`, `Chronic` |
| laterality | `along right`, `along left`, `along bilateral`, `in left`, `in right`, `in bilateral` |
| severityLevel | `severe`, `moderate to severe`, `moderate`, `mild to moderate`, `mild` |
| generalCondition | `good`, `fair`, `poor` |
| symptomChange | `improvement`, `slight improvement`, `no change`, `exacerbate` |

### AC-2.2 多选字段
| 字段 | 合法值 |
|------|--------|
| painTypes | `Dull`, `Burning`, `Freezing`, `Shooting`, `Tingling`, `Stabbing`, `Aching`, ... |
| localPattern | `Qi Stagnation`, `Blood Stasis`, `Cold-Damp + Wind-Cold`, ... |
| systemicPattern | `Kidney Yang Deficiency`, `Kidney Yin Deficiency`, ... |

### AC-2.3 Pain Scale
```
10, 10-9, 9, 9-8, 8, 8-7, 7, 7-6, 6, 6-5, 5, 5-4, 4, 4-3, 3, 3-2, 2, 2-1, 1, 1-0, 0
```

### AC-2.4 Grading Scale
```
Tenderness/Spasm: (+4), (+3), (+2), (+1), (0)
Tightness: severe, moderate to severe, moderate, mild to moderate, mild
```

**用例**: 30

---

## AC-3: 纵向逻辑

### AC-3.1 Pain 趋势
```
TX(n+1).pain ≤ TX(n).pain + 0.1
```

### AC-3.2 Pain 首次降幅
```
TX1.pain ∈ [IE.pain - 1.5, IE.pain - 0.5]
```

### AC-3.3 Tightness/ROM/Tenderness 趋势
整体改善方向。

**用例**: 25

---

## AC-4: S-O-A 链一致性

### AC-4.1 Pain-Symptom
| Pain 变化 | 允许的 symptomChange |
|-----------|---------------------|
| pain↓ ≥1 | `improvement`, `slight improvement` |
| pain↓ <1 | `slight improvement`, `no change` |
| pain↑ | `exacerbate`, `no change` |

### AC-4.2 Objective-Assessment
| Objective 变化 | 允许的 physicalFindingChange |
|----------------|------------------------------|
| tightness↓ | `reduced`, `slightly reduced` |
| tightness= | `remained the same` |

### AC-4.3 GeneralCondition
| Pain | 允许的 generalCondition |
|------|------------------------|
| ≥7 | `poor`, `fair` |
| 4-6 | `fair`, `good` |
| ≤3 | `good` |

**用例**: 20

---

## AC-5: 部位特定

### AC-5.1 肌肉群匹配
| 部位 | 肌肉群 |
|------|--------|
| KNEE | Quadratus femoris, ITB, Rectus Femoris, Gastronemius, Hamstrings |
| LBP | iliocostalis, spinalis, longissimus, Iliopsoas, Quadratus Lumborum |
| SHOULDER | Supraspinatus, Infraspinatus, Subscapularis, Teres, Deltoid |
| NECK | SCM, Scalene, Trapezius, Levator Scapulae, Splenius |
| ELBOW | Biceps, Triceps, Brachioradialis, Pronator teres |

### AC-5.2 ROM 项匹配
| 部位 | ROM 项 |
|------|--------|
| KNEE | Flexion, Extension |
| LBP | Flexion, Extension, Lateral Flexion, Rotation |
| SHOULDER | Flexion, Extension, Abduction, Adduction, Rotation |

**用例**: 20

---

## AC-6: 针刺协议

### AC-6.1 穴位数量
```
IE: 8-15 穴位
TX: 6-12 穴位
```

### AC-6.2 穴位-部位匹配
参考 `tests/alltest/needles/`

### AC-6.3 电刺激禁忌
```
hasPacemaker = true → electricalStimulation = false
```

**用例**: 15

---

## AC-7: 续写功能

### AC-7.1 解析桥接
正确提取: laterality, bodyPart, pattern, 最后 TX 状态

### AC-7.2 状态衔接
```
续写TX1.pain ≤ 输入TX(last).pain + 0.1
```

### AC-7.3 TX 上限
```
总 TX ≤ 11
```

**用例**: 20 (已有 105 用例通过)

---

## 测试矩阵

### 覆盖维度
```
5 部位 × 3 侧别 × 3 保险 × 3 慢性度 × 2 类型 = 270 组合
```

### 用例汇总
| AC | 用例数 | 优先级 |
|----|--------|--------|
| AC-1 格式 | 10 | HIGH |
| AC-2 选项 | 30 | CRITICAL |
| AC-3 纵向 | 25 | CRITICAL |
| AC-4 S-O-A | 20 | HIGH |
| AC-5 部位 | 20 | MEDIUM |
| AC-6 针刺 | 15 | HIGH |
| AC-7 续写 | 20 | CRITICAL |
| **总计** | **140** | - |

---

## 验收标准

| 指标 | 目标 |
|------|------|
| AC-2 选项合规 | 100% |
| AC-3 纵向逻辑 | 100% |
| AC-7 续写 | 100% |
| 整体通过率 | ≥97% |

---

## 实施计划

### Week 1-2: 基准提取 + 现有测试修复
- 提取三层基准 JSON
- 修复 3 个失败测试套件
- 29 PDF 解析验证

### Week 3-4: 规则测试
- CRITICAL 规则 (AC-2, AC-3, AC-7)
- HIGH 规则 (AC-1, AC-4, AC-6)
- MEDIUM 规则 (AC-5)

### Week 5: 集成测试
- Parser → Generator → Validator 流程
- IE → TX 序列验证

# 修复计划: correction-generator.ts 质量提升

> 日期: 2026-02-09
> 状态: 待执行

## 背景

用户反馈"生成的修正文本信息不全，质量很低"。经多代理并行分析发现：

1. **类型覆盖率实际为 98.5%** - 远高于预期
2. **7 种修正类型均已实现** - 逻辑完整
3. **主要问题是格式和防御性编程** - 非核心逻辑缺失

## 关键发现

| 问题 | 严重性 | 根因 |
|------|--------|------|
| 测试失败 "range pain scale" | CRITICAL | `parsePainCurrent()` 未处理 `range.max` 优先级 |
| 缺少段落标题 | HIGH | 格式化函数无 `=== SECTION ===` 标题 |
| ADL 硬编码 | HIGH | 使用 `ADL_MAP` 替代 `adlImpairment` 原文 |
| Null 安全缺失 | HIGH | 直接访问嵌套属性无 `?.` 防护 |
| romTarget 未显示 | LOW | shortTermGoal 缺少该字段输出 |

---

## 修复清单

### Fix 1: parsePainCurrent() 优先级修正 (CRITICAL)

**文件**: `parsers/optum-note/checker/correction-generator.ts:70-76`

**问题**: 当 `current` 不存在但 `range.max` 存在时，应使用 `range.max`

```typescript
// 当前代码
function parsePainCurrent(v: VisitRecord): number {
  const ps = v.subjective.painScale as PainScaleDetailed | { value?: number; range?: { max: number } }
  if ('current' in ps && typeof ps.current === 'number') return ps.current
  if ('value' in ps && typeof ps.value === 'number') return ps.value
  if ('range' in ps && ps.range && typeof ps.range.max === 'number') return ps.range.max
  return 7
}

// 修正后 - 调整优先级
function parsePainCurrent(v: VisitRecord): number {
  const ps = v.subjective.painScale as PainScaleDetailed | { value?: number; range?: { max: number } }
  // 1. 优先使用 current (详细格式)
  if ('current' in ps && typeof ps.current === 'number') return ps.current
  // 2. 使用 range.max (范围格式)
  if ('range' in ps && ps.range && typeof ps.range.max === 'number') return ps.range.max
  // 3. 使用 value (简单格式)
  if ('value' in ps && typeof ps.value === 'number') return ps.value
  return 5  // 更合理的默认值
}
```

### Fix 2: 添加段落标题 (HIGH)

**修改 4 个格式化函数开头**:

```typescript
// formatSubjectiveText
lines.push('=== SUBJECTIVE ===')
lines.push('')

// formatObjectiveText
lines.push('=== OBJECTIVE ===')
lines.push('')

// formatAssessmentText
lines.push('=== ASSESSMENT ===')
lines.push('')

// formatPlanText
lines.push('=== PLAN ===')
lines.push('')
```

### Fix 3: 使用实际 ADL 描述 (HIGH)

**文件**: `correction-generator.ts:297-304` 和 `341-347`

```typescript
// 当前代码 (硬编码)
const adlActivities = ADL_MAP[bodyPartNorm] || ADL_MAP['LBP']
lines.push(`ADL Impairment: Patient reports ${adlSeverity} difficulty with:`)
for (const activity of adlActivities.slice(0, 4)) {
  lines.push(`  - ${activity}`)
}

// 修正后 (优先使用原始数据)
const adlText = s.adlImpairment || ''
if (adlText) {
  // 应用修正后的严重程度到原始描述
  const correctedAdl = adlText.replace(
    /(mild|moderate|severe)(\s+to\s+(mild|moderate|severe))?\s+difficulty/i,
    `${adlSeverity} difficulty`
  )
  lines.push(`ADL Impairment: ${correctedAdl}`)
} else {
  // 回退到模板
  const adlActivities = ADL_MAP[bodyPartNorm] || ADL_MAP['LBP']
  lines.push(`ADL Impairment: Patient reports ${adlSeverity} difficulty with:`)
  for (const activity of adlActivities.slice(0, 4)) {
    lines.push(`  - ${activity}`)
  }
}
```

### Fix 4: Null 安全防护 (HIGH)

**文件**: `formatObjectiveText()` 全函数

添加可选链操作符 `?.` 和空值合并 `??`:

```typescript
function formatObjectiveText(visit: VisitRecord, fixes: FixMap): string {
  const o = visit.objective
  const lines: string[] = []

  lines.push('=== OBJECTIVE ===')
  lines.push('')

  lines.push(`Inspection: ${o?.inspection ?? 'No abnormalities noted'}`)
  lines.push('')

  const tightness = o?.tightnessMuscles
  lines.push(`Tightness: ${tightness?.gradingScale ?? 'moderate'} tightness noted in:`)
  lines.push(`  ${formatMuscles(tightness?.muscles ?? [])}`)
  lines.push('')

  const tenderness = o?.tendernessMuscles
  const tenderScale = fixes.tenderness || `+${tenderness?.scale ?? 2}`
  lines.push(`Tenderness: ${tenderScale} tenderness noted along:`)
  lines.push(`  ${formatMuscles(tenderness?.muscles ?? [])}`)
  lines.push(`  Scale: ${tenderness?.scaleDescription ?? tenderScale + ' tenderness'}`)
  lines.push('')

  const spasm = o?.spasmMuscles
  lines.push(`Spasm: +${spasm?.frequencyScale ?? 1} spasm noted in:`)
  lines.push(`  ${formatMuscles(spasm?.muscles ?? [])}`)
  lines.push(`  Scale: ${spasm?.scaleDescription ?? '+' + (spasm?.frequencyScale ?? 1) + ' spasm'}`)
  lines.push('')

  const rom = o?.rom
  lines.push(`ROM (${rom?.bodyPart ?? 'Affected Area'}):`)
  lines.push(formatRomItems(rom?.items ?? []))
  lines.push('')

  const tonguePulse = o?.tonguePulse
  if (fixes.tonguePulse) {
    const parts = fixes.tonguePulse.split('/')
    const tongue = parts[0]?.trim() || tonguePulse?.tongue || 'pale'
    const pulse = parts[1]?.trim() || tonguePulse?.pulse || 'thready'
    lines.push(`Tongue: ${tongue}`)
    lines.push(`Pulse: ${pulse}`)
  } else {
    lines.push(`Tongue: ${tonguePulse?.tongue ?? 'pale, thin white coat'}`)
    lines.push(`Pulse: ${tonguePulse?.pulse ?? 'thready'}`)
  }

  return lines.join('\n')
}
```

### Fix 5: 补充 romTarget 字段 (LOW)

**文件**: `formatPlanText()` shortTermGoal 部分

```typescript
if (p.shortTermGoal) {
  lines.push('Short Term Goal:')
  lines.push(`  Frequency: ${p.shortTermGoal.frequency ?? 'Not specified'}`)
  lines.push(`  Pain Scale Target: ${p.shortTermGoal.painScaleTarget ?? 'Not specified'}`)
  lines.push(`  Sensation Scale Target: ${p.shortTermGoal.sensationScaleTarget ?? 'Not specified'}`)
  lines.push(`  Tightness Target: ${p.shortTermGoal.tightnessTarget ?? 'Not specified'}`)
  lines.push(`  Tenderness Target: ${p.shortTermGoal.tendernessTarget ?? 'Not specified'}`)
  lines.push(`  Spasms Target: ${p.shortTermGoal.spasmsTarget ?? 'Not specified'}`)
  lines.push(`  Strength Target: ${p.shortTermGoal.strengthTarget ?? 'Not specified'}`)
  if (p.shortTermGoal.romTarget) {
    lines.push(`  ROM Target: ${p.shortTermGoal.romTarget}`)
  }
  lines.push('')
}
```

---

## 文件修改清单

| 文件 | 修改点 |
|------|--------|
| `parsers/optum-note/checker/correction-generator.ts` | Fix 1-5 全部 |

---

## 验证步骤

1. **类型检查**
   ```bash
   cd parsers/optum-note && npx tsc --noEmit checker/correction-generator.ts
   ```

2. **单元测试**
   ```bash
   npm test -- --testPathPattern="correction-generator" --verbose
   ```

3. **关键测试用例验证**
   - "handles visit with range pain scale" 应 PASS
   - 所有 61 个测试应 PASS

4. **输出质量检查**
   - 确认输出包含 `=== SUBJECTIVE ===` 等标题
   - 确认 ADL 描述使用原始文本而非模板

---

## 预计工作量

| 修复项 | 时间 |
|--------|------|
| Fix 1: parsePainCurrent | 5 分钟 |
| Fix 2: 段落标题 | 5 分钟 |
| Fix 3: ADL 原文 | 10 分钟 |
| Fix 4: Null 安全 | 15 分钟 |
| Fix 5: romTarget | 2 分钟 |
| 测试验证 | 10 分钟 |
| **总计** | **~45 分钟** |

---

## 风险评估

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| 正则替换 ADL 描述可能失败 | LOW | 保留模板作为回退 |
| 测试可能需要更新期望值 | MEDIUM | 仅更新格式相关断言 |

---

## 快速恢复指令

明天继续时，输入：
```
继续执行 correction-generator 修复计划
```

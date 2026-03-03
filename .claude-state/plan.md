# 修复计划：#8 #13 #15 #18（v2 — critic 审查后修订）

## 基线
- 测试: 96/98 suites, 2947/2953 tests
- Git: 32b130f + Codex 未提交改动

---

## Phase 1: #15 whatChanged 动态选择（最小风险）

### 文件: src/generator/tx-sequence-engine.ts

**Step 1.1** — deriveAssessmentFromSOA 输入类型（L346）加可选字段:
```
associatedSymptom?: string;  // 可选，默认 fallback "soreness"，不破坏现有 34 处测试调用
```

**Step 1.2** — 函数体内 whatChanged IIFE 之前（L376 前）加映射:
```
const symptomToWhatChanged: Record<string, string> = {
  soreness:  TEMPLATE_TX_WHAT_CHANGED[5],
  stiffness: TEMPLATE_TX_WHAT_CHANGED[6],
  heaviness: TEMPLATE_TX_WHAT_CHANGED[7],
  weakness:  TEMPLATE_TX_WHAT_CHANGED[4],
  numbness:  TEMPLATE_TX_WHAT_CHANGED[3],
};
const symptomWhatChanged = symptomToWhatChanged[input.associatedSymptom ?? "soreness"]
  ?? TEMPLATE_TX_WHAT_CHANGED[5];
```
注: 变量定义在函数体顶层，IIFE 闭包可访问。

**Step 1.3** — L395 仅替换 symptomScaleChanged 分支内的值:
```
- parts.push(TEMPLATE_TX_WHAT_CHANGED[5]); // "muscles soreness sensation"
+ parts.push(symptomWhatChanged);
```
不动 NECK 分支（L411）和其他使用 [5] 的地方。

**Step 1.4** — L424 仅替换 fallback dimToWhatChanged 字典的 symptomScale 键:
```
- symptomScale: TEMPLATE_TX_WHAT_CHANGED[5],
+ symptomScale: symptomWhatChanged,
```
其他键（severity, tightness, tenderness, spasm, strength, ROM）不动。

**Step 1.5** — 调用处 L2066 加 associatedSymptom 参数:
```
associatedSymptom,  // L1701 已在作用域内
```

**PRNG 安全**: deriveAssessmentFromSOA 是纯函数，不消费 rng。零偏移风险。

**验证**:
- npx vitest run（现有测试不破坏，因为字段可选）
- fixture snapshots 更新
- 新测试: stiffness/numbness 患者的 whatChanged 文本正确

---

## Phase 2: #18 frequency goals 相对计算（最小风险）

### 文件: src/generator/tx-sequence-engine.ts

**Step 2.1** — L1022-1025 替换，并复用 freqStart 到 L1059:
```
// 提取 freqStart（复用到 goalPaths.frequency.start）
const freqStart = options.initialState?.frequency
  ?? frequencyToNum(context.painFrequency || "");
const TX_FREQUENCY_GOAL = {
  st: Math.max(0, freqStart - 1),
  lt: Math.max(0, freqStart - 2),
};
```

**Step 2.2** — L1058-1061 复用 freqStart:
```
frequency: {
  start: freqStart,  // 复用，不再重复计算
  st: TX_FREQUENCY_GOAL.st,
  lt: TX_FREQUENCY_GOAL.lt,
},
```

**PRNG 安全**: 不涉及 rng 调用。零偏移风险。

**验证**:
- fixture snapshots 更新
- 新测试: 起始 Constant(3) → ST=Frequent(2), LT=Occasional(1)
- 新测试: 起始 Occasional(1) → ST=Intermittent(0), LT=Intermittent(0)
- 新测试: 起始 Intermittent(0) → ST=0, LT=0（无变化）

---

## Phase 3: #13 IE ROM 连续评分（中等风险）

### 文件: src/generator/soap-generator.ts

**Step 3.1** — L1023-1025 替换:
```
if (!visitState) {
  return pickTemplateROMDegreesByPain(bp, movementName, effectivePain, rngValue);
}
```
pickTemplateROMDegreesByPain 的 hints 参数可选，不传时:
- progress=0（无进度加成）
- trend=undefined（无趋势加成）
- minDegrees=0（无单调性保护）
对 IE（首次评估）这些默认值都正确。

**PRNG 安全**: rngValue 在调用前已通过 rng() 生成，两个函数都消费同一个值。零偏移风险。

**预期影响范围**: IE ROM 度数在同 severity band 内小幅变化（连续评分 vs 离散档位选取），
不会跨 band 跳变。pain 6→7 边界不再有阶梯。

**验证**:
- fixture snapshots 更新
- 断言: pain 6 和 pain 7 的 ROM 差异 ≤ 5 度（同部位同动作）
- 断言: pain 8-10 的 ROM 仍在 severe 范围

---

## Phase 4: #8 97810 穴位从全部 4 组选取

### 文件: src/generator/soap-generator.ts

用户原话: "取用逻辑跟别的一样" — 即 97810 应该像 full code 一样从全部 4 组选取。

**Step 4.1** — L2603 标签改为通用:
```
- const sectionLabel97810 = (bp === "KNEE" || bp === "ELBOW") ? "Front Points" : "Back Points";
+ const sectionLabel97810 = "Acupuncture Points";
```

**Step 4.2** — L2605-2623 替换 pick97810Points:
```
const pick97810Points = (): string[] => {
  if (!visitNeedle) {
    // IE/无引擎数据: 从模板池取
    if (canRandomizeFallback) {
      const allPool = [...templateFrontPool, ...templateBackPool];
      return shuffleWithSeed(allPool).slice(0, 4);
    }
    // 静态 fallback
    return (bp === "KNEE" || bp === "ELBOW")
      ? defaultFront.slice(0, 4)
      : defaultBack.slice(0, 4);
  }
  // TX: 合并全部 4 组
  const combined = [
    ...(visitNeedle.front1 ?? []),
    ...(visitNeedle.front2 ?? []),
    ...(visitNeedle.back1 ?? []),
    ...(visitNeedle.back2 ?? []),
  ];
  if (combined.length >= 4) return combined.slice(0, 4);
  if (combined.length > 0) {
    const used = new Set(combined);
    const allPool = [...templateFrontPool, ...templateBackPool];
    const extra = allPool.filter(p => !used.has(p));
    return [...combined, ...extra].slice(0, 4);
  }
  // 最终 fallback
  return (bp === "KNEE" || bp === "ELBOW")
    ? defaultFront.slice(0, 4)
    : defaultBack.slice(0, 4);
};
const points97810 = pick97810Points();
```

**PRNG 安全**: pick97810Points 不调用 rng（shuffleWithSeed 只在 canRandomizeFallback=true 即 IE 路径使用，TX 路径走 visitNeedle 分支）。零偏移风险。

**验证**: 新测试验证 97810 路径消费引擎全部 4 组穴位

---

## Phase 5: 全量验证

1. npx vitest run -u（更新 snapshots）
2. npx vitest run（全部通过，基线 ≥ 96/98）
3. 大样本扫描: 5 部位 × 50 seeds 验证 #15 #18 修复效果
4. git commit

## 执行顺序: Phase 1 → 2 → 3 → 4 → 5

## Critic 审查修订记录
- Step 1.1: string → string?（可选，不破坏现有测试）
- Step 1.2: fallback 用 input.associatedSymptom ?? "soreness"
- Step 1.3/1.4: 明确只替换 symptomScaleChanged 分支和 symptomScale 键
- Step 2.2: 新增，freqStart 复用到 goalPaths.frequency.start
- Phase 3: 补充预期影响范围和验证断言
- Phase 4: 补充标签改为通用，明确合并策略，确认 PRNG 安全

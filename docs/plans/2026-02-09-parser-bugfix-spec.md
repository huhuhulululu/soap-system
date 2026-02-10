# Parser Bug Fix Spec

> 2026-02-09 — 4 个已确认的 parser bug

## Bug 1：Tightness grading 复合词被截断

### 现象
- 输入 `Grading Scale: mild to moderate` → 解析为 `mild`
- 输入 `Grading Scale: moderate to severe` → 解析为 `moderate`

### 根因
`parser.ts:589` 正则 alternation 顺序错误：
```regex
(mild|moderate|severe|mild to moderate|moderate to severe)
```
JS 正则 alternation 是左优先的。`mild` 排在 `mild to moderate` 前面，匹配到 `mild` 就停了。

### 影响范围
- `parseTightnessMuscles()` — 直接受影响
- 下游：`extractInitialState()` 中 tightness 值偏低 → 续写 engine 起点错误
- 下游：checker 的 `checkSequence()` 中 `compareSeverity()` 对比的 tightness 值不准

### 修复
`parser.ts:589` — 把长选项放在短选项前面：
```
旧: (mild|moderate|severe|mild to moderate|moderate to severe)
新: (mild to moderate|moderate to severe|mild|moderate|severe)
```

### 影响的测试
需要验证：`mild`、`moderate`、`severe`、`mild to moderate`、`moderate to severe` 五种值都能正确匹配。

---

## Bug 2：Extension `0(normal)` ROM 丢失

### 现象
```
4-/5 Extension(fully straight): 0(normal)
```
这行被 ROM parser 跳过，只解析出 Flexion。

### 根因
`parser.ts:662` ROM 正则要求 `\d+ Degrees?`：
```regex
(\d[+-]?)\/5\s+([A-Za-z\s()]+?):\s*(\d+)\s*[Dd]egrees?\s*\(?(\w+)\)?
```
`0(normal)` 中 `0` 后面直接跟 `(`，没有 `Degrees` 关键字。

### 影响范围
- KNEE 的 Extension 行（`0(normal)` 和 `-5(severe)`）全部丢失
- 下游：续写生成的 TX 只有 Flexion ROM，缺少 Extension
- 下游：checker 的 ROM 相关规则（V05、O1、O2）少了 Extension 数据

### 修复
`parser.ts:662` — 让 `Degrees?` 变为 optional：
```
旧: (\d[+-]?)\/5\s+([A-Za-z\s()]+?):\s*(\d+)\s*[Dd]egrees?\s*\(?(\w+)\)?
新: (\d[+-]?)\/5\s+([A-Za-z\s()]+?):\s*(-?\d+)\s*(?:[Dd]egrees?)?\s*\(?(\w+)\)?
```
注意：同时把 `\d+` 改为 `-?\d+` 以支持 `-5(severe)` 格式。

### 影响的测试
需要验证：
- `90 Degrees(moderate)` — 有 Degrees，正常匹配
- `0(normal)` — 无 Degrees，能匹配
- `-5(severe)` — 负数无 Degrees，能匹配
- `130(normal)` — 无 Degrees，能匹配
- `120 degree(moderate)` — 小写 degree，能匹配（SHOULDER 格式）

---

## Bug 3：IE 的 ADL 格式不匹配（最严重）

### 现象
IE 模板格式：
```
There is moderate to severe difficulty with ADLs like performing household chores, Going up and down stairs
```
parser 的 ADL 正则只匹配 TX 格式：
```
impaired performing ADL's with moderate to severe difficulty ...
```

### 根因
`parser.ts:381` ADL 正则：
```regex
/impaired performing ADL'?s?\s+with\s+(.+?)(?=Pain Scale|$)/is
```
IE 模板不用 `impaired performing ADL's with`，而是用 `There is ... difficulty with ADLs like`。

### 影响范围
- 所有 IE visit 的 `adlImpairment` 为空字符串
- `adlDifficultyLevel` 回退为 `mild`（`parseAdlDifficultyLevel('')` 返回 `mild`）
- 下游：bridge 的 `severityLevel` 为 `mild` → 续写整体 severity 基线严重偏低
- 下游：checker 的 IE01 规则（pain→severity 映射）对比的 actual 值永远是 `mild`

### 修复
`parser.ts:381` — 新增第二个 regex 匹配 IE 格式：
```typescript
// 现有 TX 格式
const adlPattern = /impaired performing ADL'?s?\s+with\s+(.+?)(?=Pain Scale|$)/is
const adlMatch = block.match(adlPattern)

// 新增 IE 格式: "There is X difficulty with ADLs like ..."
if (!adlMatch) {
  const ieAdlPattern = /There is\s+((?:mild|moderate|severe)(?:\s+to\s+(?:mild|moderate|severe))?)\s+difficulty with ADLs? like\s+(.+?)(?=\.\s|\n\n|Pain Scale|$)/is
  const ieAdlMatch = block.match(ieAdlPattern)
  if (ieAdlMatch) {
    adlImpairment = `${ieAdlMatch[1]} difficulty ${ieAdlMatch[2].trim()}`
  }
}
```

### 影响的测试
需要验证：
- TX 格式：`impaired performing ADL's with moderate to severe difficulty Going up and down stairs` → 正常匹配
- IE 格式：`There is moderate to severe difficulty with ADLs like performing household chores, Going up and down stairs` → 能匹配，severity 为 `moderate to severe`

---

## Bug 4：IE 的 systemicPattern 取错

### 现象
IE Assessment：
```
TCM Dx:
Right knee pain due to Cold-Damp + Wind-Cold in local meridian,
but patient also has Kidney Yang Deficiency in the general.
```

parser 结果：
- `tcmDiagnosis.pattern` = `Cold-Damp + Wind-Cold`（这是 local pattern，不是 systemic）
- `systemicPattern` = `tcmDiagnosis.pattern` = `Cold-Damp + Wind-Cold`（错误）
- 正确的 `systemicPattern` 应该是 `Kidney Yang Deficiency`

### 根因
`parser.ts:755` TCM 诊断解析：
```regex
/(.+?)\s+due to\s+(.+?)(?:,\s*but|in local)/is
```
这个 regex 的 group 2 捕获的是 `due to` 和 `in local` 之间的内容，即 local pattern。

然后 `parser.ts:769`：
```typescript
systemicPattern: tcmDiagnosis?.pattern  // ← 这里把 local pattern 当 systemic 了
```

`but patient also has Kidney Yang Deficiency in the general` 这句话从未被解析。

### 影响范围
- IE 的 `systemicPattern` 取到 local pattern 而非 systemic pattern
- 下游：bridge 的 `systemicPattern` 错误 → soap-generator 的 Assessment 段证型描述不准确
- 下游：checker 的 A5 规则（localPattern consistent）可能误报

### 修复
`parser.ts:752-762` — 在 TCM 解析中增加 systemic pattern 提取：
```typescript
if (diagMatch) {
  // 提取 systemic pattern: "but patient also has X in the general"
  const systemicMatch = tcmMatch[1].match(/but patient also has\s+(.+?)\s+in the general/is)

  tcmDiagnosis = {
    diagnosis: diagMatch[1].trim(),
    pattern: diagMatch[2].trim(),           // local pattern (保持不变)
    treatmentPrinciples: principlesMatch?.[1]?.trim() || '',
  }
  // systemicPattern 单独赋值
  systemicFromTcm = systemicMatch?.[1]?.trim()
}
```

然后 `parser.ts:769`：
```typescript
// 旧
systemicPattern: tcmDiagnosis?.pattern
// 新
systemicPattern: systemicFromTcm || undefined
```

### 影响的测试
需要验证：
- IE 有 `but patient also has Kidney Yang Deficiency in the general` → systemicPattern = `Kidney Yang Deficiency`
- IE 没有 `but patient also has` 句式 → systemicPattern = undefined，bridge 走 fallback
- TX 无 TCM Dx → systemicPattern 不受影响

---

## 执行顺序

按依赖关系和严重程度排序：

| 步骤 | Bug | 改动文件 | 改动行数 | 风险 |
|------|-----|---------|---------|------|
| 1 | Bug 3 (IE ADL) | parser.ts:381 附近 | +6 行 | 低：新增 fallback 分支，不改现有 TX 匹配 |
| 2 | Bug 1 (Tightness) | parser.ts:589 | 改 1 行 | 极低：只调换 alternation 顺序 |
| 3 | Bug 4 (Systemic) | parser.ts:752-769 | +4 行，改 1 行 | 低：新增提取逻辑，改 systemicPattern 赋值 |
| 4 | Bug 2 (ROM) | parser.ts:662 | 改 1 行 | 低：让 Degrees 变 optional，不影响有 Degrees 的行 |

总改动量：约 **12 行新增 + 3 行修改**。

## 验证计划

修完后用你提供的 IE+TX 文本重新跑 parser，检查：
1. IE `adlDifficultyLevel` = `moderate to severe`
2. IE `tightnessMuscles.gradingScale` = `moderate to severe`
3. IE `systemicPattern` = `Kidney Yang Deficiency`
4. TX `tightnessMuscles.gradingScale` = `mild to moderate`
5. TX ROM items = 2（Flexion + Extension）
6. 续写功能 `generateContinuation()` 端到端正常输出

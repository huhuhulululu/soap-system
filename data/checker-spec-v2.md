# SOAP Note Checker — 功能规格 v2

## 1. 概述

将现有前端（Vue 3 + Pinia + Tailwind）从 mock 数据升级为真实检查工具。
用户上传 Optum Note PDF 后，系统自动解析、检查、标注错误并生成纠正文本。

全部在浏览器端完成（无后端），用 pdf.js 提取文本后调用 parser + checker。

## 2. 数据流

```
PDF 上传 → pdf.js → 纯文本 → parseOptumNote() → OptumNoteDocument
                                                       │
                                             ┌─────────┴─────────┐
                                             ▼                   ▼
                                     bridgeToContext()     规则检查引擎
                                     (类型转换层)         (不依赖生成器)
                                             │                   │
                                             ▼                   ▼
                                     GenerationContext     CheckError[]
                                             │                   │
                                             ▼                   ▼
                                     exportSOAPAsText()   CorrectionItem[]
                                     (仅在需要纠正时)     (精确修正+整段重生成)
                                                                 │
                                                                 ▼
                                                          CheckReport
                                                          (前端渲染)
```

## 3. 用户工作流

1. 上传 PDF → 看到解析进度
2. 解析完成 → 看到总览（visit 数、总分、grade）
3. 时间线视图 → 每个 visit 标注关键指标变化和趋势箭头
4. 点击某个 visit → 看到该 visit 的详细检查结果
5. 看到错误 → 点击"查看纠正" → 弹出纠正面板
6. 纠正面板 → 左边原文（错误高亮）、右边纠正文本（修改高亮）
7. 点击"复制整段" → 复制到剪贴板

## 4. 阶段 0：Parser 补全（前置依赖）

当前 parser 缺失以下 Checker 必需的字段：

| 缺失字段 | 当前状态 | 补全方案 |
|---|---|---|
| painFrequency 4 级 | 只识别 Frequent/Constant | 扩展正则，加 Occasional/Intermittent |
| chronicityLevel | 完全不解析 | 从 S 段提取 "Chronic/Sub Acute/Acute pain" |
| adlDifficultyLevel | 只有描述文本 | 从 ADL 描述提取 severity（moderate/severe 等） |
| laterality | 嵌在 bodyPart 字符串里 | 拆分 "right knee" → laterality=right, bodyPart=KNEE |
| systemicPattern | IE 的 tcmDiagnosis 有，TX 没有 | TX 从同文档 IE 继承 |
| localPattern | Assessment.currentPattern 格式不同 | 清洗 "Qi & Blood Deficiency in local meridian" → "Qi & Blood Deficiency" |

### 需要改动的文件
- `parsers/optum-note/types.ts` — 扩展 PainFrequency 类型，新增字段
- `parsers/optum-note/parser.ts` — 新增/扩展解析逻辑

## 5. 阶段 1：核心检查引擎

### 5.1 bridge.ts — Parser→Generator 类型桥接

```ts
// Parser 输出 → Generator 输入
function bridgeToContext(doc: OptumNoteDocument, visitIndex: number): GenerationContext

// Parser 的 VisitRecord → Generator 的 SOAPNote（用于 previousIE）
function bridgeVisitToSOAPNote(visit: VisitRecord): SOAPNote

// bodyPart 字符串 → BodyPart 枚举
// "right knee" → { bodyPart: 'KNEE', laterality: 'right' }
function parseBodyPartString(raw: string): { bodyPart: BodyPart; laterality: Laterality }

// Assessment.currentPattern → localPattern（清洗）
// "Qi & Blood Deficiency in local meridian" → "Qi & Blood Deficiency"
function extractLocalPattern(currentPattern: string): string
```

### 5.2 note-checker.ts — 检查引擎

```ts
interface CheckInput {
  document: OptumNoteDocument
}

interface CheckOutput {
  timeline: TimelineEntry[]
  errors: CheckError[]
  corrections: CorrectionItem[]
  score: number
  grade: 'PASS' | 'WARNING' | 'FAIL'
}

// IE 横向检查（单 visit 内 S/O/A/P 一致性）
function checkIE(visit: VisitRecord): CheckError[]

// TX 横向检查（单 visit 内一致性）
function checkTX(visit: VisitRecord, ieVisit: VisitRecord): CheckError[]

// 纵向检查（跨 visit 趋势）
function checkSequence(visits: VisitRecord[]): CheckError[]

// 主入口
function checkDocument(input: CheckInput): CheckOutput
```

### 5.3 IE 和 TX 检查逻辑的区别

IE（初诊）：
- 横向一致性为主（S/O/A/P 内部逻辑）
- 没有"上一次"可以对比
- 检查 Plan 中 short/long term goal 合理性
- 检查 TCM diagnosis 完整性

TX（复诊）：
- 纵向一致性为主（和上一次对比）
- 检查 symptomChange 描述和实际数值变化是否一致
- P 段应该和 IE 的 P 段基本一致
- 不应该有 short/long term goal

## 6. 检查规则完整清单

### 6.1 IE 横向规则（8 条）

| ID | 规则 | 严重度 | 逻辑来源 |
|---|---|---|---|
| IE01 | pain→severity 映射正确 | HIGH | `severityFromPain()` |
| IE02 | pain→tenderness 合理 | MEDIUM | `severityToTender` 映射 |
| IE03 | pain→ROM limitation 合理 | MEDIUM | `getLimitationFactor()` |
| IE04 | 舌脉→证型一致 | MEDIUM | `TONE_MAP` |
| IE05 | short term goal pain target < current pain | HIGH | 逻辑约束 |
| IE06 | long term goal pain target < short term target | MEDIUM | 逻辑约束 |
| IE07 | TCM diagnosis 完整（有 local + systemic pattern） | HIGH | 模板要求 |
| IE08 | P 段 needle protocol 存在 | LOW | 模板要求 |

### 6.2 TX 横向规则（6 条）

| ID | 规则 | 严重度 | 逻辑来源 |
|---|---|---|---|
| TX01 | pain→severity 映射正确 | HIGH | `severityFromPain()` |
| TX02 | pain→tenderness 合理 | MEDIUM | `severityToTender` 映射 |
| TX03 | symptomChange 描述与 pain delta 一致 | CRITICAL | 逻辑矛盾检测 |
| TX04 | generalCondition 合理（不应突然从 fair→poor） | LOW | 纵向稳定性 |
| TX05 | 舌脉→证型一致（应与 IE 相同） | MEDIUM | `TONE_MAP` |
| TX06 | 不应出现 short/long term goal | LOW | 模板规范 |

### 6.3 纵向规则（9 条）

| ID | 规则 | 严重度 | 逻辑来源 |
|---|---|---|---|
| V01 | pain 不回升 | CRITICAL | 纵向引擎单调约束 |
| V02 | tenderness 不回升 | HIGH | 纵向引擎单调约束 |
| V03 | tightness 不恶化 | HIGH | 纵向引擎单调约束 |
| V04 | spasm 不回升 | MEDIUM | 纵向引擎单调约束 |
| V05 | ROM 不下降 | HIGH | 纵向引擎单调约束 |
| V06 | strength 不下降 | MEDIUM | 纵向引擎单调约束 |
| V07 | frequency 不增加 | MEDIUM | 纵向引擎单调约束 |
| V08 | S 说 improvement 但 pain 实际上升 | CRITICAL | 逻辑矛盾 |
| V09 | P 段跨 TX 穴位大变化 | LOW | P 稳定性 |

总计 23 条规则。

## 7. 阶段 2：纠正生成

### 7.1 级联纠正策略

当 TX#3 有错误时，纠正需要知道 TX#1 和 TX#2 的状态。
采用"级联纠正"——从 IE 开始，每个 visit 的纠正基于前一个 visit 的纠正后状态。

```
IE (原始) → 检查 → 纠正后 IE
  ↓
TX#1 (原始) + 纠正后 IE → 检查 → 纠正后 TX#1
  ↓
TX#2 (原始) + 纠正后 TX#1 → 检查 → 纠正后 TX#2
  ↓
...
```

### 7.2 纠正输出

```ts
interface CorrectionItem {
  visitDate: string
  visitIndex: number
  section: 'S' | 'O' | 'A' | 'P'
  errors: CheckError[]           // 该段的错误列表
  fieldFixes: FieldFix[]         // 精确字段修正
  correctedFullText: string      // 整段重生成文本（可直接复制）
}

interface FieldFix {
  field: string       // 如 "painScale"
  original: string    // "8/10"
  corrected: string   // "7/10"
  reason: string      // "上次 pain=7 且标注 improvement，本次不应回升"
}
```

### 7.3 纠正文本生成方式

- 从 parsed visit 数据构建 `GenerationContext`（通过 bridge.ts）
- 调用 `exportSOAPAsText(context, visitState)` 生成正确文本
- visitState 从纠正后的状态链中获取

## 8. 评分算法

### 8.1 权重区分 IE 和 TX

IE 错误权重更高（影响全链），TX 错误按 visit 数量均摊。

```
score = 100
  - IE 横向错误:  CRITICAL×25, HIGH×15, MEDIUM×8, LOW×3
  - TX 横向错误:  (CRITICAL×15 + HIGH×8 + MEDIUM×4 + LOW×1) / txCount
  - 纵向错误:     CRITICAL×20, HIGH×10, MEDIUM×5, LOW×2

grade:
  score >= 80 → PASS
  score >= 60 → WARNING
  score < 60  → FAIL
```

### 8.2 评分明细

```ts
interface ScoreBreakdown {
  ieConsistency: number      // IE 横向一致性得分 (0-100)
  txConsistency: number      // TX 横向一致性得分 (0-100)
  timelineLogic: number      // 纵向逻辑得分 (0-100)
  totalScore: number         // 加权总分
  grade: 'PASS' | 'WARNING' | 'FAIL'
}
```

## 9. 数据结构

### 9.1 CheckReport（最终输出）

```ts
interface CheckReport {
  patient: PatientInfo
  summary: {
    totalVisits: number
    visitDateRange: { first: string; last: string }
    errorCount: { critical: number; high: number; medium: number; low: number; total: number }
    scoring: ScoreBreakdown
  }
  timeline: TimelineEntry[]
  errors: CheckError[]
  corrections: CorrectionItem[]
}
```

### 9.2 CheckError

```ts
interface CheckError {
  id: string
  ruleId: string                // "V01", "IE03", "TX03" 等
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  visitDate: string
  visitIndex: number
  section: 'S' | 'O' | 'A' | 'P'
  field: string
  ruleName: string
  message: string              // "1/5/2025 S 中 Pain Scale 写成 8，但上次是 7 且标注 improvement"
  expected: string
  actual: string
}
```

### 9.3 TimelineEntry（纵向逻辑链可视化）

```ts
interface TimelineEntry {
  visitDate: string
  visitIndex: number
  visitType: 'IE' | 'TX'
  indicators: {
    pain:       { value: number; label: string; trend: '↓'|'→'|'↑'; ok: boolean }
    tenderness: { value: string; trend: '↓'|'→'|'↑'; ok: boolean }
    tightness:  { value: string; trend: '↓'|'→'|'↑'; ok: boolean }
    spasm:      { value: string; trend: '↓'|'→'|'↑'; ok: boolean }
    frequency:  { value: string; trend: '↓'|'→'|'↑'; ok: boolean }
    rom:        { summary: string; trend: '↓'|'→'|'↑'; ok: boolean }
    strength:   { summary: string; trend: '↓'|'→'|'↑'; ok: boolean }
  }
  errors: CheckError[]         // 该 visit 的错误
}
```

## 10. 前端组件

### 10.1 现有组件改动

| 组件 | 改动 |
|---|---|
| `checker.js` | 替换 mock 为 pdf.js + parseOptumNote + checkDocument 管线 |
| `files.js` | report 类型改为 CheckReport |
| `ReportPanel.vue` | 适配真实 CheckReport 数据结构 |
| `StatsOverview.vue` | 适配真实评分数据 |

### 10.2 新增组件

| 组件 | 功能 |
|---|---|
| `TimelineView.vue` | 纵向逻辑链可视化：横轴 visit 日期，纵轴各指标，异常点可点击 |
| `CorrectionPanel.vue` | 错误详情 + 左右对比（原文高亮错误 / 纠正文本高亮修改）+ 复制按钮 |

### 10.3 新增服务

| 文件 | 功能 |
|---|---|
| `pdf-extractor.js` | 浏览器端 pdf.js 文本提取（CDN 加载 worker） |
| `note-checker.ts` | 横向 + 纵向规则检查引擎 |
| `correction-generator.ts` | 级联纠正 + 精确字段修正 + 整段重生成 |
| `bridge.ts` | Parser→Generator 类型桥接 |

## 11. 边界情况处理

| 场景 | 处理方式 |
|---|---|
| Parser 某字段返回 null | 标记为 WARNING "字段缺失"，不参与该字段的规则检查 |
| PDF 只有 IE 没有 TX | 只做 IE 横向检查，跳过纵向检查 |
| PDF 只有 TX 没有 IE | 标记 CRITICAL "缺少初诊记录"，纵向检查以第一个 TX 为基线 |
| 同一 PDF 多个身体部位 | 按身体部位分组检查，每组独立评分 |
| localPattern 无法匹配 TONE_MAP | 尝试模糊匹配，失败则跳过舌脉检查并标记 WARNING |
| 日期格式不一致 | 统一解析为 Date 对象，解析失败标记 WARNING |
| PDF 文本提取乱码 | 在 parser 阶段报错，前端显示"PDF 格式不支持" |

## 12. 实施顺序

| 阶段 | 内容 | 依赖 | 预估改动量 |
|---|---|---|---|
| 0 | Parser 补全（6 个字段） | 无 | ~80 行 |
| 1 | bridge.ts + note-checker.ts | 阶段 0 | ~300 行 |
| 2 | correction-generator.ts | 阶段 1 | ~150 行 |
| 3 | pdf-extractor.js + checker.js 改造 | 阶段 1 | ~60 行 |
| 4 | TimelineView.vue + CorrectionPanel.vue | 阶段 2+3 | ~400 行 |
| 5 | 现有组件适配 | 阶段 4 | ~100 行 |

总计约 1090 行新增/改动代码。

## 13. 时间线可视化示例

```
日期        类型  Pain  Tender  Tight    Spasm  Freq        ROM(Flex)  Str(Flex)
─────────────────────────────────────────────────────────────────────────────────
1/1/2025    IE    8     +3      mod-sev  +3     Constant    65°(mod)   4-/5
                  │     │       │        │      │           │          │
                  ✅↓   ✅↓     ✅↓      ✅→    ✅↓         ✅↑        ✅→
                  │     │       │        │      │           │          │
1/5/2025    TX#1  7     +2      mod      +3     Frequent    70°(mild)  4-/5
                  │     │       │        │      │           │          │
                  ✅↓   ✅↓     ✅↓      ✅↓    ✅↓         ✅↑        ✅↑
                  │     │       │        │      │           │          │
1/9/2025    TX#2  6     +2      mild     +2     Occasional  75°(mild)  4/5
                  │     │       │        │      │           │          │
                  🔴↑   ✅↓     ✅→      ✅→    ✅↓         ✅↑        ✅→
                  │     │       │        │      │           │          │
1/13/2025   TX#3  7     +1      mild     +2     Intermit.   75°(mild)  4/5
                  ↑ 错误！improvement 分支 pain 不应回升
```

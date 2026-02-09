# SOAP 续写功能设计文档

> 生成时间: 2026-02-09 00:41

## 基本原则

1. **不改核心生产脚本** — `soap-generator.ts` 是已验证的生产代码，输出格式精确匹配 Optum 系统模板。续写功能作为调用方使用它，不修改它。ICD/CPT 拼接、header 注入等适配逻辑全部在调用层完成。

2. **实际状态驱动，不靠假设** — engine 续写不用全局 progress 曲线猜测"用户前 N 个 TX 应该是什么状态"，而是直接从用户最后一个 TX 提取实际的 pain/tightness/tenderness/spasm/frequency 作为起点。local progress 曲线只管续写部分的递减节奏。

3. **最小侵入改动** — 只改两个文件的接口：`template-rule-whitelist.ts` 加 `setWhitelist()` 注入口，`tx-sequence-engine.ts` 的 `TXSequenceOptions` 加两个可选参数。其余全是新增代码。现有 47 个测试不受影响。

## 目标

用户粘贴 IE 文本（+ 可选的已有 TX），系统自动续写剩余 TX notes。输出纯文本 S/O/A/P 四段，可直接复制粘贴到 Optum 系统。

## 数据流

```
用户粘贴 IE+TX 文本
  ↓
注入假 header（如果缺失）
  ↓
parseOptumNote() → OptumNoteDocument { visits[] }
  ↓
findIndex(INITIAL EVALUATION) → ieIndex
  ↓
bridgeToContext(doc, ieIndex) → GenerationContext
  + 手动覆盖 noteType = 'TX'
  + 手动设 previousIE = bridgeVisitToSOAPNote(visits[ieIndex])
  + 覆盖 insuranceType（用户下拉选择）
  ↓
从最后一个 TX 提取 initialState（pain/tightness/tenderness/spasm/frequency）
  ↓
generateTXSequenceStates(context, {
  txCount: 11,              // 总数（含已有）
  startVisitIndex: N+1,     // 从第 N+1 个 TX 开始
  initialState              // 用户最后一个 TX 的实际状态
})
  ↓
exportSOAPAsText(context, visitState) per visit → 纯文本
  ↓
拼接 ICD/CPT（ICD 从 IE 复制，CPT 根据 estim+time 计算）
```

## 阻塞点与解决方案

### 1. template-rule-whitelist 依赖 fs（P0 阻塞项）

**问题**: `pickSingle()` → `getTemplateOptionsForField()` → `buildTemplateWhitelist()` → `fs.readFileSync()`。浏览器中 `fs` 被 Vite stub 为空。

**影响范围**: 
- `tx-sequence-engine.ts` 的 `pickSingle`（7次）、`pickMultiple`（1次）、`findTemplateOption`（2次）
- `rule-engine.ts` 的 `getAllRules()` → `getTemplateAlignedRules()`

**不受影响**: `soap-generator.ts` 的 `generateSubjectiveTX/generateObjective/generateAssessmentTX/generatePlanTX` 用的是 `weight-system.ts` 的 `calculateWeights()`，不走 whitelist。

**方案**:
1. `template-rule-whitelist.ts` 加 `setWhitelist(data)` 注入口
2. 预构建脚本 `scripts/build-whitelist.ts` 序列化为 JSON
3. 前端启动时 `import` JSON → `setWhitelist()`

**JSON 格式**: `Record<string, string[]>`（fieldPath → original option values），14KB
- 35 个字段，753 个选项
- `setWhitelist` 内部重建 `allowedFields: Set` + `optionsByField: Map<string, Map<normalized, original>>`

**验证**: 已确认所有 9 个 engine fieldPath 都有选项数据。16 条规则中 14 条通过 template alignment。

### 2. engine 续写起点（P0 核心改造）

**问题**: `generateTXSequenceStates` 当前从 IE 的 pain 开始，所有 prev* 变量硬编码初始值。不支持从中途接续。

**方案**: `TXSequenceOptions` 扩展：

```typescript
interface TXSequenceOptions {
  txCount: number           // 总 TX 数（含已有）
  seed?: number
  startVisitIndex?: number  // 从第几个 TX 开始生成（1-based）
  initialState?: {          // 从用户最后一个 TX 提取
    pain: number
    tightness: number       // severe=4, mod-sev=3.5, mod=3, mild-mod=2, mild=1
    tenderness: number      // +4=4, +3=3, +2=2, +1=1
    spasm: number           // frequencyScale 直接数字
    frequency: number       // constant=3, frequent=2, occasional=1, intermittent=0
  }
}
```

**关键改造**: 用 local progress 曲线替代全局曲线

```
当前: progressLinear = i / txCount          // 全局，i=4/11=0.36
改为: progressLinear = localIndex / remainingTx  // 局部，1/8=0.125
```

**原因**: 全局曲线在 i=4 时 progress=0.65，`addProgressBias` 会进入 `isMid` 阶段选 "moderate"，但如果用户实际 pain 还是 8（没好转），tightness 选 "moderate" 跟 pain=8 矛盾。局部曲线从 0 开始，phase 分布合理。

**已验证**: 
- pain 从 7 平滑降到 5（8 个 TX）
- pain 从 8 平滑降到 5（极端场景）
- phase 分布：EARLY→MID→LATE 合理

### 3. 从 VisitRecord 提取 initialState（P1）

```typescript
function extractInitialState(visit: VisitRecord): TXInitialState {
  pain:       parsePainCurrent(visit)                    // 已有函数
  tightness:  severityToNumber(gradingScale)             // "moderate"→3
  tenderness: scaleDescription.match(/\+(\d)/) → int     // "(+3)..."→3
  spasm:      visit.objective.spasmMuscles.frequencyScale // 直接数字
  frequency:  textToLevel(painFrequency)                  // "Frequent..."→2
}
```

**已验证**: 所有字段在 parsed VisitRecord 中存在且可提取。

### 4. parser 兼容性问题（P1）

#### 4a. visit 顺序 reverse

**问题**: `parseOptumNote` 内部做 `visits.reverse()`，假设 PDF 中最新在前。但用户粘贴的文本可能是 IE 在前（时间正序），reverse 后变成 TX 在前、IE 在后。

**方案**: 续写功能不依赖顺序假设，用 `findIndex(INITIAL EVALUATION)` 找 IE。

#### 4b. 无 header 时 parser 失败

**问题**: `parseHeader` 需要 `PATIENT_NAME (DOB: ...)` 格式，缺失时直接 return `{ success: false }`。

**方案**: 续写功能在调用 parser 前检测，缺失时注入假 header：
```javascript
if (!/PATIENT:|DOB:/.test(text)) {
  text = 'UNKNOWN, PATIENT (DOB: 01/01/2000 ID: 0000000000) Date of Service: 01/01/2025 Printed on: 01/01/2025\n' + text
}
```

#### 4c. 生成器输出 vs parser 期望格式不匹配

**问题**: 生成器输出 `Subjective`（无冒号），parser 期望 `Subjective:`（有冒号）。

**影响**: 不影响续写功能（输入是 PDF 文本，带冒号）。仅影响"生成后自检"功能（P2，暂不处理）。

### 5. bridge 续写适配（P1）

**问题**: `bridgeToContext(doc, ieIndex)` 对 IE visit 设 `noteType = 'IE'`，不会设 `previousIE`。

**方案**: 手动覆盖：
```javascript
const ctx = bridgeToContext(doc, ieIndex)
ctx.noteType = 'TX'
ctx.previousIE = bridgeVisitToSOAPNote(doc.visits[ieIndex])
ctx.insuranceType = userSelectedInsurance
```

### 6. ICD/CPT 附加（P1）

在 `exportSOAPAsText` 输出末尾由调用方拼接（不改 generator）：

- **ICD**: 从 IE 的 `diagnosisCodes` 复制
- **CPT**: 根据 `hasPacemaker`（决定 estim）+ `treatmentTime`（决定 units）计算
  - with estim: 97813（首 15min）+ 97814（每加 15min）
  - without estim: 97810（首 15min）+ 97811（每加 15min）

### 7. shortTermGoal 解析（P2 延后）

**问题**: `parsePlan()` 不解析 goal，`painScaleTarget` 永远 fallback 到 `'5-6'`。

**影响**: 如果用户 IE 的目标就是默认 5-6（绝大多数情况），不影响。仅当用户手动改过目标时会用错误的 targetPain。

**方案**: 后续在 `parsePlan` 中加正则 `/Pain Scale to\s*(\d+(?:-\d+)?)/` 提取。

## 实施顺序

| 步骤 | 改什么 | 文件 | 工作量 |
|------|--------|------|--------|
| 1 | `setWhitelist()` + 预构建脚本 | `template-rule-whitelist.ts`, 新建 `scripts/build-whitelist.ts` | 小 |
| 2 | engine 续写参数 + local progress | `tx-sequence-engine.ts` | 中 |
| 3 | `extractInitialState()` | 新建 `frontend/src/services/generator.js` 或 bridge 中 | 小 |
| 4 | 前端 `generator.js` 完整调用链 | 新建 `frontend/src/services/generator.js` | 中 |
| 5 | `ContinuePanel.vue` + App.vue tab | 新建 + 改 `App.vue` | 中 |
| 6 | ICD/CPT 拼接 | `generator.js` 中 | 小 |

步骤 1 是阻塞项，必须先完成。步骤 2-3 可并行。步骤 4 依赖 1+2+3。步骤 5 依赖 4。

## 关键类型映射

### VisitRecord → initialState

| engine 变量 | VisitRecord 字段 | 转换 |
|---|---|---|
| pain | `subjective.painScale.current` | `parsePainCurrent()` |
| tightness | `objective.tightnessMuscles.gradingScale` | `{severe:4, 'moderate to severe':3.5, moderate:3, 'mild to moderate':2, mild:1}` |
| tenderness | `objective.tendernessMuscles.scale` 或 `.scaleDescription` | `/\+(\d)/` → int |
| spasm | `objective.spasmMuscles.frequencyScale` | 直接数字 |
| frequency | `subjective.painFrequency` | `{constant:3, frequent:2, occasional:1, intermittent:0}` |

### GenerationContext 续写必填字段

| 字段 | 来源 |
|---|---|
| noteType | 强制 `'TX'` |
| insuranceType | 用户下拉选择 |
| primaryBodyPart | bridge 从 IE 提取 |
| laterality | bridge 从 IE 提取 |
| localPattern | bridge 从 IE assessment 提取 |
| systemicPattern | bridge 从 IE assessment 提取 |
| chronicityLevel | bridge 从 IE subjective 提取 |
| severityLevel | bridge 从 IE 提取（初始值，engine 会按 pain 覆盖） |
| hasPacemaker | bridge 从 IE medicalHistory 提取 |
| previousIE | `bridgeVisitToSOAPNote(ieVisit)` |

## 风险矩阵

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| whitelist JSON 数据不完整 | 低 | 高 — engine 选不到选项 | 预构建后跑 smoke test |
| 用户文本格式异常 | 中 | 中 — parser 失败 | 假 header 注入 + lenient 模式 |
| visit 顺序错误 | 中 | 高 — IE/TX 混淆 | findIndex 找 IE，不依赖顺序 |
| progress vs 实际状态不一致 | 已消除 | — | local progress 曲线 |
| shortTermGoal 未解析 | 低 | 低 — fallback 5-6 正确率 >90% | P2 加解析 |

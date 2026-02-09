# 统一 Correction Generator 方案

> 2026-02-09 讨论记录（完整版）

## 目标

将 correction-generator 的常量和辅助函数统一到 soap-generator，消除重复维护。correction 保留自己的"原文字符串替换"能力，不调用 soap-generator 的格式化函数。

## 决策记录

| # | 问题 | 决策 | 理由 |
|---|------|------|------|
| 1 | 用户是否手动编辑生成文本 | 会 | correction 必须保留"只替换出错字段，其余保持原文" |
| 2 | 统一范围 | 统一常量和辅助函数，保留 correction 的字符串替换逻辑 | soap-generator 零逻辑改动，只加 export |
| 3 | override 机制 | 不需要 | correction 不调用 soap-generator 格式化函数，改为在原文上 regex 替换 |
| 4 | overrides 作用域 | N/A | 同上 |
| 5 | bridgeVisitToTXVisitState | 不需要 | correction 不走 soap-generator 格式化，不需要构造 TXVisitState |
| 6 | 纵向级联 | 逐错修正，不做额外级联 | checker 已逐 visit 全量检查，所有错误都会被独立报出 |
| 7 | 修改标记 | 行尾标记 `[CORRECTED: was "xxx"]` | 带原始值方便对比 |
| 8 | TXVisitState 无法映射字段 | N/A | 不再需要构造 TXVisitState |
| 9 | normalizeBodyPart | 改用 bridge.ts 的 `parseBodyPartString()` | 复用已有代码 |
| 10 | 标记格式 | 行尾：`... [CORRECTED: was "xxx"]` | |
| 11 | 标记与粘贴 | 输出两个版本 | `correctedFullText`（干净）+ `correctedAnnotatedText`（带标记） |
| 12 | CorrectionItem 结构 | 新增 `correctedAnnotatedText` 字段 | 前端展示用标记版，复制用干净版 |

## 最终方案

### 核心原则

- **soap-generator.ts 零逻辑改动**，只加 `export` 关键字
- correction-generator 保留字符串替换能力，但常量和辅助函数从公共模块 import
- 消除三处重复（soap-generator、note-checker、correction-generator）

### 架构

```
shared/severity.ts (新建)
  ├── severityFromPain()
  ├── expectedTenderMinScaleByPain()
  └── 其他三处共用的辅助函数

soap-generator.ts (只加 export)
  ├── export BODY_PART_NAMES
  ├── export MUSCLE_MAP
  ├── export ADL_MAP
  └── 其他需要共享的常量

correction-generator.ts (重构)
  ├── import { BODY_PART_NAMES, MUSCLE_MAP, ADL_MAP } from soap-generator
  ├── import { severityFromPain, ... } from shared/severity
  ├── import { parseBodyPartString } from bridge
  ├── computeFixes()          ← 保留
  ├── buildFixMap()           ← 保留
  ├── 字符串替换逻辑 (regex)  ← 保留，不调用 soap-generator 格式化函数
  ├── [CORRECTED] 后处理标记  ← 新增
  └── generateCorrections()   ← 保留

note-checker.ts (重构)
  ├── import { severityFromPain, ... } from shared/severity
  └── 删除自有的重复函数
```

### 调用链

```
checker 流程:
  CheckError[] + VisitRecord
    → computeFixes()                         ← correction-generator
    → buildFixMap()
    → 在原文上 regex 替换出错字段             ← 用 soap-generator 的常量确保值正确
    → 生成 correctedFullText（干净版）
    → 生成 correctedAnnotatedText（带标记版）
    → CorrectionItem

续写流程:
  （完全不变）
```

### CorrectionItem 新结构

```typescript
interface CorrectionItem {
  visitDate: string
  visitIndex: number
  section: 'S' | 'O' | 'A' | 'P'
  errors: CheckError[]
  fieldFixes: FieldFix[]
  correctedFullText: string           // 干净文本，可直接粘贴到 Optum
  correctedAnnotatedText: string      // 带 [CORRECTED: was "xxx"] 标记，前端展示用
}
```

### 标记格式示例

```
原文:
  Patient reports moderate difficulty with Standing for long periods of time

修正后 (correctedFullText):
  Patient reports moderate to severe difficulty with Standing for long periods of time

标记版 (correctedAnnotatedText):
  Patient reports moderate to severe difficulty with Standing for long periods of time [CORRECTED: was "moderate"]
```

## 涉及文件

| 文件 | 改动类型 | 改动内容 |
|------|---------|---------|
| `src/generator/soap-generator.ts` | 最小改动 | 常量加 `export`，零逻辑改动 |
| `src/shared/severity.ts` | 新建 | `severityFromPain()`、`expectedTenderMinScaleByPain()` 等共用函数 |
| `parsers/optum-note/checker/correction-generator.ts` | 重构 | 删除重复常量，改为 import；新增 annotated 输出 |
| `parsers/optum-note/checker/note-checker.ts` | 小改 | 删除重复函数，改为 import shared |
| `parsers/optum-note/checker/types.ts` | 小改 | CorrectionItem 新增 `correctedAnnotatedText` |
| 前端 corrections 展示组件 | 适配 | 展示用 `correctedAnnotatedText`，复制用 `correctedFullText` |

## 级联问题分析

### 结论：不需要级联

1. checker（note-checker.ts）已逐 visit 全量检查——`checkIE()`、`checkTX()`、`checkSequence()` 把每个 visit 的问题都独立报出
2. 如果 TX3 和 TX4 都有同类问题，checker 分别报两条错误，correction 一起修正
3. correction 引入新纵向矛盾的根源是 pain 回升，checker 的 `V01` 规则会单独报
4. 如果修正后产生新问题，用户再跑一轮 check 即可

## 风险评估

| 风险 | 等级 | 缓解 |
|------|------|------|
| soap-generator export 改动引入 bug | 极低 | 只加 export 关键字，不改逻辑 |
| 常量 import 路径错误 | 低 | TypeScript 编译检查 |
| regex 替换匹配不准 | 中 | 现有 correction-generator 已有这套逻辑，保留不变 |
| 前端适配遗漏 | 低 | 新增字段，旧字段不变，向后兼容 |

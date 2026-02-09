# AChecker 开发日志

## 2026-02-09 Session

### 文本验证规则实现

#### 需求分析
用户提出需要检测以下问题：
1. **文本 ↔ 数值矛盾**: 如描述 "improvement" 但疼痛值实际上升
2. **语义表达矛盾**: 如 "increased ROM limitation" (方向词与名词极性矛盾)
3. **进展状态与原因逻辑矛盾**: 如 "improvement" + "skipped treatments"

#### 表述收集
从 4 个模板生成器中提取所有文本表述：
- `subjective-generator.ts` — progressStatus, progressReasons, severityLevel
- `objective-generator.ts` — Tightness/Tenderness/Spasm 分级, 肌力, ROM 标签
- `assessment-generator.ts` — symptomChange, changeLevel, physicalFindings
- `plan-generator.ts` — 目标动词 (Decrease/Increase), 电刺激选项

**输出文档**: `docs/plans/text-validation-expressions.md`

#### 新增 9 条文本验证规则 (T01-T09)

| 规则ID | 描述 | 严重程度 | 位置 |
|--------|------|----------|------|
| T01 | 方向词 + 名词极性矛盾 | HIGH | `checkTextConsistency()` |
| T02 | 改善描述 + 数值恶化 | CRITICAL | `checkTX()` |
| T03 | 恶化描述 + 数值改善 | CRITICAL | `checkTX()` |
| T04 | ROM 描述矛盾 | HIGH | `checkTextConsistency()` |
| T05 | 肌力描述矛盾 | HIGH | `checkTextConsistency()` |
| T06 | 进展状态 + 原因逻辑矛盾 | MEDIUM | `checkTX()` |
| T07 | Pacemaker + 电刺激矛盾 | CRITICAL | `checkTX()` |
| T08 | Severity 单调性 | HIGH | `checkSequence()` |
| T09 | 伴随症状单调性 | MEDIUM | `checkSequence()` |

#### 语义分类

**方向词**:
- 正向: `reduced`, `improvement`, `Decrease`
- 负向: `increased`, `exacerbate`

**名词极性**:
- 负向名词 (↓=改善): `tightness`, `tenderness`, `spasms`, `ROM limitation`, `pain`
- 正向名词 (↑=改善): `strength`, `ROM`, `energy level`

**进展原因**:
- 正向: `maintain regular treatments`, `energy level improved`
- 负向: `skipped treatments`, `discontinuous treatment`, `intense work`

#### 代码变更

**修改文件**: `parsers/optum-note/checker/note-checker.ts`

新增常量:
```typescript
const POSITIVE_PROGRESS_REASONS = [...]
const NEGATIVE_PROGRESS_REASONS = [...]
const NEGATIVE_NOUNS = ['tightness', 'tenderness', 'spasms', 'rom limitation', 'pain']
const POSITIVE_NOUNS = ['strength', 'rom']
```

新增函数:
```typescript
function checkTextConsistency(visits: VisitRecord[]): CheckError[]
function parseProgressStatus(cc: string): 'improvement' | 'exacerbate' | 'similar' | null
function extractProgressReasons(cc: string): { positive: string[], negative: string[] }
```

#### 测试

**新增测试文件**: `parsers/optum-note/checker/__tests__/text-rules.test.ts`
- 34 个测试用例，覆盖所有 9 条新规则

#### 构建状态
- ✅ Frontend Build: 58 modules, 1.26s
- ✅ 前端自动兼容新规则（动态渲染）

---

## 2026-02-08 Session

### 20:49 - 项目检查
- 检查前端架设进度，确认 Vue 3 + Vite + Pinia + Tailwind 基础架构已就位
- 5 个核心组件已完成：HeaderBar, FileUploader, FileList, StatsOverview, ReportPanel
- 服务层：pdf-extractor.js (pdfjs-dist), checker.js (调用后端 parser/checker)
- 空目录：views/, composables/, assets/

### 20:56 - 前端功能补全（并行推进）
- ✅ `ErrorBoundary.vue` — 错误边界组件，onErrorCaptured + 重试
- ✅ `useKeyboardNav.js` — ↑↓ 键切换文件，Esc 取消选择
- ✅ `exporter.js` — CSV 报告导出（BOM 中文兼容）
- ✅ `App.vue` 更新 — 响应式布局 (mobile 单列 / lg+ 4:8) + 进度条 + ErrorBoundary
- ✅ `FileUploader.vue` 更新 — 50MB 文件大小限制
- ✅ `ReportPanel.vue` 更新 — 导出 CSV 按钮

### 21:01 - 启动开发服务器
- `vite --host 0.0.0.0 --port 4001` 局域网可访问
- 修复 `crypto.randomUUID()` 在非 HTTPS 环境不可用 → 改用 Math.random + Date.now

### 21:05 - PDF 解析链路调试
- 问题1: PDF 提取文本断字 (`S ubjective`, `P rocedure` 等)
- 问题2: Header 格式不匹配（PDF 无括号格式的 DOB/ID）
- 问题3: Visit block 分割失败（Subjective 关键词被断开）

### 21:06~21:08 - Parser 全面桥接
- ✅ `normalizePdfText()` — 50+ 临床术语断字修复 + section 关键词前自动换行
- ✅ `parseHeader()` — 新增 Pattern B 适配 PDF 提取格式
- ✅ `splitVisitRecords()` — 放宽过滤条件（长度阈值替代 Procedure Code 硬性要求）
- ✅ `parseVisitRecord()` — 容错模式，O/A/P 缺失时用合理默认值
- ✅ 所有子解析器正则放宽 — Tightness/Tenderness/Spasm/TonguePulse/Plan/Assessment/DiagnosisCode/ProcedureCode
- 47 个现有测试全部通过

### 21:17 - 检测规则梳理
- 输出前端展示项 (13 项) 和后端检测规则 (24 条) 完整表格
- 确认 24 条规则全部通过错误列表展示到前端

### 21:20 - ICD/CPT 检测规则
- ✅ DX01 (HIGH) — ICD→bodyPart 匹配
- ✅ DX02 (MEDIUM) — ICD 跨 visit 一致性
- ✅ DX03 (HIGH) — 每次 visit 必须有 ICD 码
- ✅ DX04 (LOW) — ICD laterality 后缀一致
- ✅ CPT01 (HIGH) — 每次 visit 必须有 CPT 码
- ✅ CPT02 (CRITICAL) — CPT↔电刺激匹配 (97813/14 vs 97810/11)
- ✅ CPT03 (MEDIUM) — 操作时间 vs CPT units
- ✅ CPT04 (MEDIUM) — IE eval 码 vs TX treatment 码

### 21:23 - 生成器关键决策点分析
- 全面研究 soap-generator.ts, tx-sequence-engine.ts, weight-system.ts
- 识别 S/O/A/P 各段 + 跨段共 16 个关键检测点
- 输出置信度评估表

### 21:31 - 16 条新检测规则 + 前端下拉框（并行推进）
- ✅ S2 (MEDIUM) — painTypes vs localPattern 证型匹配
- ✅ S3 (LOW) — ADL 活动 vs bodyPart 合理性
- ✅ S6 (MEDIUM) — Associated symptom 跨 visit 单调递减
- ✅ S7 (LOW) — muscleWeaknessScale vs pain 一致性
- ✅ O1 (MEDIUM) — ROM degrees vs pain 合理区间
- ✅ O2 (HIGH) — ROM limitation label vs degrees 比值
- ✅ O3 (MEDIUM) — Strength vs ROM limitation 方向一致
- ✅ O8 (HIGH) — 肌肉名属于 bodyPart 合法列表
- ✅ O9 (HIGH) — ROM movement 属于 bodyPart
- ✅ A5 (MEDIUM) — localPattern 跨 visit 一致
- ✅ P1 (LOW) — Needle gauge vs bodyPart
- ✅ P2 (LOW) — Acupoints 数量合理 (2-20)
- ✅ X1 (HIGH) — Pain→Severity→Tightness→Tenderness 全链一致
- ✅ X2 (MEDIUM) — Pain→ROM→Strength 链
- ✅ X3 (MEDIUM) — Pattern→Tongue/Pulse→Treatment Principles 链
- ✅ X4 (CRITICAL) — Pacemaker→Electrical Stimulation 禁忌
- ✅ 前端保险下拉框 (OPTUM/HF/WC/VC/ELDERPLAN/NONE)
- ✅ 前端治疗时间下拉框 (15/30/45/60 分钟)
- ✅ CheckInput 接口扩展 insuranceType + treatmentTime
- 47 个测试全部通过

---

## 当前状态

### 检测规则总计: 48 条
| 类别 | 规则 | 数量 |
|------|------|------|
| 文档级 | DOC01 | 1 |
| 初诊 (IE) | IE01-IE08 | 8 |
| 复诊 (TX) | TX01-TX06 | 6 |
| 纵向 (V) | V01-V09 | 9 |
| ICD 编码 | DX01-DX04 | 4 |
| CPT 编码 | CPT01-CPT04 | 4 |
| 生成器链 | S2,S3,S6,S7,O1-O3,O8,O9,A5,P1,P2,X1-X4 | 16 |

### 前端文件清单
```
frontend/src/
├── main.js
├── App.vue                    # 响应式布局 + 进度条 + 保险/时间下拉框
├── style.css
├── components/
│   ├── HeaderBar.vue
│   ├── FileUploader.vue       # 拖放 + 大小限制
│   ├── FileList.vue
│   ├── StatsOverview.vue
│   ├── ReportPanel.vue        # 报告详情 + CSV 导出
│   └── ErrorBoundary.vue
├── stores/
│   └── files.js               # Pinia store + insuranceType/treatmentTime
├── services/
│   ├── checker.js             # 验证服务 (传递保险/时间参数)
│   ├── pdf-extractor.js
│   └── exporter.js            # CSV 导出
└── composables/
    └── useKeyboardNav.js
```

### 待办
- [ ] 前端展示 ICD/CPT 编码信息
- [ ] 暗色模式
- [ ] 国际化 (i18n)
- [ ] 历史记录持久化
- [ ] 多文件对比视图

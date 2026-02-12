# Checker 页面测试方案 & 验收标准

## 架构概览

```
PDF 文件 → extractPdfText (PDF.js)
  → ensureHeader → normalizePdfText → splitVisitRecords → parseVisitRecord
  → checkDocument (60+ 规则: IE/TX/Sequence/Code/Text/Generator)
  → generateCorrections (computeFixes → exportSOAPAsText)
  → normalizeReport → UI 展示
```

全流程纯前端，无后端 API。

---

## 1. 单元测试 (Unit Tests)

### 1.1 PDF 文本预处理

| 测试项 | 输入 | 预期 | 文件 |
|--------|------|------|------|
| normalizePdfText 修复 PDF 断字 | `"S ubjective"` | `"Subjective"` | parser.ts |
| normalizePdfText 保留正常文本 | `"Subjective"` | `"Subjective"` | parser.ts |
| ensureHeader 无 header 注入 | 无 PATIENT/DOB 的文本 | 前置假 header | checker.js |
| ensureHeader 有 header 跳过 | 含 `PATIENT:` 的文本 | 原文不变 | checker.js |

### 1.2 Visit 分割与解析

| 测试项 | 输入 | 预期 |
|--------|------|------|
| splitVisitRecords 单 visit | 1 个 Subjective 块 | 返回 1 条 |
| splitVisitRecords 多 visit | IE + 11 TX 文本 | 返回 12 条 |
| splitVisitRecords 空文本 | `""` | 返回 0 条 |
| parseVisitRecord IE 完整 | 标准 IE 文本块 | visitType=IE, 含 goals/tcmDiagnosis |
| parseVisitRecord TX 完整 | 标准 TX 文本块 | visitType=TX, 无 goals |
| parseSubjective 疼痛量表 | `"Pain Scale: 8/10"` | painScale.current=8 |
| parseSubjective 范围量表 | `"Pain Scale: 7-8/10"` | painScale.range.max=8 |
| parseObjective 舌脉 | `"Tongue: pale... Pulse: thready"` | tonguePulse 正确提取 |
| parseObjective ROM | `"Flexion: 60/90 degrees"` | rom.flexion={current:60,normal:90} |
| parsePlan 穴位 | `"LI4, LI11, GB34, ST36"` | acupoints=["LI4","LI11","GB34","ST36"] |
| parseDiagnosisCodes | `"M54.5"` | icdCodes 含 M54.5 |

### 1.3 Checker 规则 (60+ 规则逐条测试)

#### IE 规则 (IE01-IE08)

| 规则 | 测试用例 | 预期 |
|------|----------|------|
| IE01 | pain=9, severity="mild" | CRITICAL: severity 应为 severe |
| IE01 | pain=9, severity="severe" | 无错误 |
| IE02 | pain=8, tenderness="+1" | MEDIUM: 应 >=+3 |
| IE03 | pain=8, ROM limitation="WNL" | MEDIUM: 应有限制 |
| IE04 | pattern="Blood Stasis", tongue="pale thin" | MEDIUM: 舌脉不匹配 |
| IE05 | pain=8, ST goal=9 | HIGH: ST goal 应 < pain |
| IE06 | ST goal=5, LT goal=6 | HIGH: LT 应 < ST |
| IE07 | 无 tcmDiagnosis | HIGH: 缺失 |
| IE08 | acupoints=[] | HIGH: 缺失 |

#### TX 规则 (TX01-TX06)

| 规则 | 测试用例 | 预期 |
|------|----------|------|
| TX01 | pain=3, severity="severe" | MEDIUM |
| TX02 | pain=9, tenderness="+1" | MEDIUM |
| TX03 | prevPain=8, curPain=7, symptomChange="exacerbate" | MEDIUM |
| TX05 | IE tongue="pale", TX tongue="red" | CRITICAL |
| TX06 | TX 含 goals | CRITICAL |
| T02 | symptomChange="improvement", pain 8→9 | CRITICAL |
| T03 | symptomChange="exacerbate", pain 8→5 | CRITICAL |
| T06 | symptomChange="improvement", reason="skipped treatments" | MEDIUM |
| T07 | hasPacemaker=true, electricalStim=true | CRITICAL |

#### 序列规则 (V01-V09)

| 规则 | 测试用例 | 预期 |
|------|----------|------|
| V01 | pain: 8→7→8 | HIGH: 第3次回升 |
| V02 | tenderness: +3→+2→+3 | HIGH |
| V03 | tightness: severe→moderate→severe | HIGH |
| V04 | spasm: +3→+2→+3 | HIGH |
| V05 | ROM: 60→70→65 | HIGH |
| V06 | strength: 4→4+→4 | MEDIUM |
| V07 | frequency: frequent→occasional→frequent | MEDIUM |
| V09 | 穴位重叠 < 40% | HIGH |
| T08 | severity: moderate→mild→moderate | HIGH |
| T09 | symptom: soreness→stiffness→numbness | MEDIUM |

#### 编码规则 (DX01-04, CPT01-03)

| 规则 | 测试用例 | 预期 |
|------|----------|------|
| DX01 | bodyPart=KNEE, ICD=M54.5(LBP) | CRITICAL |
| DX02 | visit1 ICD≠visit2 ICD | CRITICAL |
| DX03 | 无 ICD 编码 | CRITICAL |
| CPT01 | 无 CPT 编码 | CRITICAL |
| CPT02 | 有电刺激但无 97014 | CRITICAL |
| CPT03 | treatmentTime=15min, units=4 | CRITICAL |

#### 文本一致性 (T01, T04-T05)

| 规则 | 测试用例 | 预期 |
|------|----------|------|
| T01 | "increased" + "tightness reduced" | HIGH |
| T04 | ROM 描述 "improved" 但数值下降 | HIGH |
| T05 | strength 描述 "improved" 但数值下降 | HIGH |

#### 生成器规则 (S/O/A/P/X)

| 规则 | 测试用例 | 预期 |
|------|----------|------|
| S2 | pattern="Blood Stasis", painTypes=["Dull"] | MEDIUM |
| S3 | bodyPart=KNEE, ADL="combing hair" | MEDIUM |
| O1 | pain=3, ROM flexion=30° | HIGH |
| O8 | bodyPart=KNEE, muscle="trapezius" | HIGH |
| O9 | bodyPart=KNEE, ROM="cervical flexion" | CRITICAL |
| A5 | visit1 pattern≠visit2 pattern | CRITICAL |
| P1 | bodyPart=KNEE, needle gauge=0.16mm | CRITICAL |
| P2 | acupoints count=25 | CRITICAL |
| X1 | pain=9, tightness="mild" | CRITICAL |
| X2 | pain=3, ROM severely limited | CRITICAL |
| X3 | pattern="Blood Stasis", tongue="pale" | CRITICAL |
| X4 | pacemaker + electrical stim | CRITICAL |

### 1.4 Correction Generator

| 测试项 | 输入 | 预期 |
|--------|------|------|
| computeFixes IE01 | pain=9, severity="mild" | fix: severity→"severe" |
| computeFixes IE04 | pattern="Qi Stagnation", wrong tongue | fix: tongue→匹配值 |
| computeFixes IE05 | pain=8, ST goal=9 | fix: ST goal→4-5 |
| computeFixes T02 | improvement+pain↑ | fix: symptomChange→"similar" |
| computeFixes T07 | pacemaker+estim | fix: estim→"without" |
| applyFixesToContext | severity fix | context.severityLevel 更新 |
| generateCorrectedSOAP IE | IE + fixes | 完整 SOAP 文本，含修正 |
| generateCorrectedSOAP TX | TX + fixes | 完整 SOAP 文本，含 visitState |
| addCorrectionMarkers | 修正后文本 + fixes | 含 `[CORRECTED: was "xxx"]` 标记 |

### 1.5 评分逻辑

| 测试项 | 输入 | 预期 |
|--------|------|------|
| 无错误 | errors=[] | score=100, grade=PASS |
| 1 MEDIUM | 1×MEDIUM | score=92, grade=PASS |
| 2 HIGH | 2×HIGH | score=70, grade=WARNING |
| 1 CRITICAL | 1×CRITICAL | score=0, grade=FAIL |
| 混合 | 0C + 3H + 2M | score=100-45-16=39, grade=FAIL |

### 1.6 共享模块

| 模块 | 测试项 | 预期 |
|------|--------|------|
| severity.ts | severityFromPain(9) | "severe" |
| severity.ts | severityFromPain(6) | "moderate" |
| severity.ts | expectedTenderMinScaleByPain(9) | 4 |
| tcm-mappings.ts | isTonguePatternConsistent("Qi Stagnation", "pale, thin white coat", "wiry") | true |
| tcm-mappings.ts | isPainTypeConsistentWithPattern("Blood Stasis", ["Sharp"]) | true |
| tcm-mappings.ts | isPainTypeConsistentWithPattern("Blood Stasis", ["Dull"]) | false |
| adl-mappings.ts | isAdlConsistentWithBodyPart("KNEE", "walking") | true |
| adl-mappings.ts | isAdlConsistentWithBodyPart("KNEE", "combing hair") | false |

---

## 2. 集成测试 (Integration Tests)

### 2.1 端到端管道测试

需要构造标准测试文本（模拟 PDF 提取后的纯文本），覆盖以下场景：

| 场景 | 描述 | 预期结果 |
|------|------|----------|
| 完美 IE+TX | 标准 IE + 11 TX，所有数据一致 | score=100, PASS, 0 errors |
| IE 缺失 goals | IE 无 ST/LT goals | IE05+IE06 触发 |
| TX 舌脉不一致 | TX2 舌脉与 IE 不同 | TX05 CRITICAL |
| 疼痛回升 | TX5 pain > TX4 pain | V01 HIGH |
| 全链矛盾 | improvement + pain↑ + negative reason | T02 CRITICAL + T06 MEDIUM |
| Pacemaker 禁忌 | pacemaker + 电刺激 | T07 CRITICAL |
| 编码错误 | ICD 与 bodyPart 不匹配 | DX01 CRITICAL |
| 空文档 | 无 visit 记录 | 解析失败，抛出异常 |
| 仅 IE 无 TX | 只有 1 个 IE visit | 正常解析，无序列错误 |

### 2.2 Correction 管道测试

| 场景 | 输入 | 预期 |
|------|------|------|
| 单错误修正 | IE01 severity 错误 | 修正后 SOAP 含正确 severity |
| 多错误修正 | IE01 + IE04 + IE05 | 所有字段修正，文本重新生成 |
| TX 修正 | T02 + T06 | symptomChange + reason 修正 |
| 修正标记 | 任意修正 | 输出含 `[CORRECTED: was "xxx"]` |

### 2.3 Bridge 一致性测试

| 测试项 | 预期 |
|--------|------|
| bridgeToContext 输出 vs Writer generationContext | 关键字段类型一致 |
| bridgeVisitToSOAPNote 输出 | 可被 exportSOAPAsText 消费 |
| contextToSnapshot 输出 | 可被 validateGeneratedSequence 消费 |

---

## 3. 大规模测试 (Batch / Scale Tests)

### 3.1 测试数据生成器

由于无真实 PDF 库，需要构建 **合成测试数据生成器**：

```typescript
// tests/fixtures/generator.ts
interface TestCaseConfig {
  visitCount: number          // 1-50
  hasIE: boolean
  bodyPart: BodyPart
  insuranceType: string
  injectErrors?: ErrorInjection[]  // 故意注入的错误
  seed?: number
}

interface ErrorInjection {
  ruleId: string              // 要触发的规则
  visitIndex: number          // 在哪个 visit 注入
}

function generateTestText(config: TestCaseConfig): string
function generateTestDocument(config: TestCaseConfig): OptumNoteDocument
```

### 3.2 批量正确性测试

| 测试项 | 规模 | 方法 | 通过标准 |
|--------|------|------|----------|
| 无错误文档批量 | 100 份 | 生成 100 份完美文档，全部 checkDocument | 100% score=100 |
| 单规则注入 | 60×10=600 份 | 每条规则注入 10 份 | 每份恰好触发目标规则 |
| 随机错误注入 | 500 份 | 每份随机注入 1-5 个错误 | 所有注入错误被检出，无漏检 |
| 边界值 | 200 份 | pain=0/1/4/5/6/7/8/9/10 各 20 份 | severity/tenderness 映射全部正确 |
| 多 bodyPart | 4×50=200 份 | LBP/KNEE/SHOULDER/NECK 各 50 份 | 部位相关规则 (O8/O9/P1/S3) 正确 |
| 多 insurance | 6×30=180 份 | OPTUM/HF/WC/VC/ELDERPLAN/NONE | 编码规则按 insurance 正确触发 |

### 3.3 评分一致性测试

| 测试项 | 规模 | 通过标准 |
|--------|------|----------|
| 评分确定性 | 100 份×2 次 | 同一文档两次检查，score 完全一致 |
| 评分单调性 | 100 份 | 错误越多 score 越低（无逆转） |
| CRITICAL 一票否决 | 50 份 | 含任意 CRITICAL → score=0, grade=FAIL |
| 边界评分 | 构造 score=80/79/60/59 | grade 切换正确 (PASS/WARNING/FAIL) |

### 3.4 Correction 覆盖率测试

| 测试项 | 规模 | 通过标准 |
|--------|------|----------|
| 可修正规则覆盖 | 所有可修正规则×10 | computeFixes 为每条规则生成 fix |
| 修正后重检 | 200 份 | 修正后文档重新 checkDocument，目标错误消失 |
| 修正不引入新错误 | 200 份 | 修正后 error count <= 修正前 |

---

## 4. 压力测试 (Stress Tests)

### 4.1 单文件极限

| 测试项 | 参数 | 通过标准 |
|--------|------|----------|
| 超长文档 | 50 visits (IE + 49 TX) | 解析+检查 < 5s，无崩溃 |
| 超长文档 | 100 visits | 解析+检查 < 15s，无崩溃 |
| 超大 PDF | 10MB PDF (含图片/表格) | extractPdfText 不 OOM |
| 空白 PDF | 0 字节 / 空白页 | 优雅报错，不崩溃 |
| 损坏 PDF | 二进制垃圾 | 优雅报错，不崩溃 |
| 非 PDF 文件 | .docx / .jpg / .txt | 优雅报错，不崩溃 |

### 4.2 批量并发

| 测试项 | 参数 | 通过标准 |
|--------|------|----------|
| 10 文件并发 | 10×标准文档 (12 visits) | 全部完成 < 10s |
| 50 文件并发 | 50×标准文档 | 全部完成 < 60s，无内存泄漏 |
| 100 文件并发 | 100×标准文档 | 全部完成 < 120s，浏览器不卡死 |
| 混合大小 | 20 小(3 visits) + 20 中(12) + 10 大(30) | 全部完成，进度条正确 |

### 4.3 内存压力

| 测试项 | 方法 | 通过标准 |
|--------|------|----------|
| 内存基线 | 空页面 heap snapshot | 记录基线 |
| 单文件内存 | 处理 1 份 12-visit 文档 | 增量 < 5MB |
| 批量内存 | 连续处理 50 份文档 | 总增量 < 100MB |
| 内存回收 | 处理 50 份 → clearAll() → GC | 回到基线 ±10MB |
| 反复操作 | 上传→检查→清除 循环 20 次 | 无内存持续增长 |

### 4.4 UI 响应性

| 测试项 | 方法 | 通过标准 |
|--------|------|----------|
| 处理中 UI 不冻结 | 处理 50 份文档时点击切换 | UI 响应 < 200ms |
| 进度条准确 | 批量处理 20 份 | 进度条线性递增，无跳跃 |
| 大报告渲染 | 100 errors + 20 corrections | 报告面板渲染 < 500ms |
| 错误列表滚动 | 500+ errors 列表 | 滚动流畅 (60fps) |

---

## 5. 边界与异常测试

### 5.1 PDF 格式兼容性

| 场景 | 描述 | 通过标准 |
|------|------|----------|
| 标准 Optum 格式 | 标准排版 | 正确解析 |
| 断字 PDF | `"S ubjective"`, `"O bjective"` | normalizePdfText 修复 |
| 无 header PDF | 缺少患者信息头 | ensureHeader 注入 |
| 多列 PDF | 两列排版 | 文本顺序正确 |
| 扫描 PDF (图片) | 纯图片 PDF | 优雅报错 "无法提取文本" |
| 加密 PDF | 密码保护 | 优雅报错 |
| 混合编码 | UTF-8 / Latin-1 混合 | 不乱码 |

### 5.2 数据边界

| 场景 | 输入 | 通过标准 |
|------|------|----------|
| pain=0 | 最低疼痛 | severity="mild", 无异常 |
| pain=10 | 最高疼痛 | severity="severe", 无异常 |
| pain 非整数 | pain=7.5 | 正确处理或四舍五入 |
| 空穴位列表 | acupoints=[] | P2 触发，不崩溃 |
| 超多穴位 | acupoints 25 个 | P2 触发 |
| 空 ICD | icdCodes=[] | DX03 触发 |
| 未知 bodyPart | bodyPart="WRIST" | 降级处理，不崩溃 |
| 未知 pattern | localPattern="Unknown Pattern" | 默认通过，不崩溃 |

---

## 6. 验收标准 (Acceptance Criteria)

### 6.1 功能验收

| # | 验收项 | 标准 | 优先级 |
|---|--------|------|--------|
| F1 | PDF 上传 | 支持拖拽 + 点击上传，支持多文件 | P0 |
| F2 | 解析成功率 | 标准 Optum 格式 PDF 解析成功率 >= 95% | P0 |
| F3 | 规则覆盖 | 60+ 规则全部可触发，无死规则 | P0 |
| F4 | 评分准确 | 评分公式与文档一致，确定性输出 | P0 |
| F5 | 修正生成 | 可修正规则 100% 生成修正建议 | P0 |
| F6 | 修正质量 | 修正后重检，目标错误消失率 >= 90% | P1 |
| F7 | 报告展示 | 患者信息、评分、错误、修正、时间线完整 | P0 |
| F8 | 批量处理 | 支持 >=50 文件批量上传和处理 | P1 |
| F9 | 导出功能 | CSV 导出 + 修正文本复制 | P1 |
| F10 | 历史记录 | 检查结果保存到 localStorage | P2 |

### 6.2 性能验收

| # | 验收项 | 标准 |
|---|--------|------|
| P1 | 单文件处理时间 (12 visits) | < 3 秒 |
| P2 | 单文件处理时间 (50 visits) | < 10 秒 |
| P3 | 批量 50 文件总时间 | < 60 秒 |
| P4 | 内存占用 (单文件) | 增量 < 5MB |
| P5 | 内存占用 (50 文件批量) | 总增量 < 100MB |
| P6 | 报告渲染时间 | < 500ms |
| P7 | UI 响应 (处理中) | 不冻结，交互 < 200ms |

### 6.3 稳定性验收

| # | 验收项 | 标准 |
|---|--------|------|
| S1 | 异常文件不崩溃 | 损坏/空白/非PDF → 优雅报错 |
| S2 | 内存无泄漏 | 反复操作 20 次后内存回到基线 ±10MB |
| S3 | 确定性输出 | 同一文件多次检查结果完全一致 |
| S4 | 错误隔离 | 单文件失败不影响批量中其他文件 |

### 6.4 兼容性验收

| # | 验收项 | 标准 |
|---|--------|------|
| C1 | Chrome 120+ | 全功能正常 |
| C2 | Safari 17+ | 全功能正常 |
| C3 | Firefox 120+ | 全功能正常 |
| C4 | 移动端 Safari/Chrome | 基本功能可用 |

---

## 7. 测试执行计划

### Phase 1: 单元测试 (1-2 天)

```
tests/
  unit/
    parser/
      normalize.test.ts        # 1.1 文本预处理
      split-visits.test.ts     # 1.2 visit 分割
      parse-sections.test.ts   # 1.2 section 解析
    checker/
      ie-rules.test.ts         # 1.3 IE 规则
      tx-rules.test.ts         # 1.3 TX 规则
      sequence-rules.test.ts   # 1.3 序列规则
      code-rules.test.ts       # 1.3 编码规则
      text-rules.test.ts       # 1.3 文本一致性
      generator-rules.test.ts  # 1.3 生成器规则
      scoring.test.ts          # 1.5 评分逻辑
    correction/
      compute-fixes.test.ts    # 1.4 修正计算
      apply-fixes.test.ts      # 1.4 修正应用
      markers.test.ts          # 1.4 标记生成
    shared/
      severity.test.ts         # 1.6 severity 模块
      tcm-mappings.test.ts     # 1.6 TCM 映射
      adl-mappings.test.ts     # 1.6 ADL 映射
```

### Phase 2: 集成测试 (1 天)

```
tests/
  integration/
    pipeline.test.ts           # 2.1 端到端管道
    correction-pipeline.test.ts # 2.2 修正管道
    bridge-consistency.test.ts  # 2.3 Bridge 一致性
```

### Phase 3: 大规模测试 (1-2 天)

```
tests/
  scale/
    fixtures/
      generator.ts             # 合成数据生成器
    batch-correctness.test.ts  # 3.2 批量正确性
    scoring-consistency.test.ts # 3.3 评分一致性
    correction-coverage.test.ts # 3.4 修正覆盖率
```

### Phase 4: 压力测试 (1 天)

```
tests/
  stress/
    single-file-limits.test.ts # 4.1 单文件极限
    batch-concurrent.test.ts   # 4.2 批量并发
    memory-pressure.test.ts    # 4.3 内存压力 (需浏览器环境)
```

### Phase 5: E2E 验收 (1 天)

```
tests/
  e2e/
    checker-flow.spec.ts       # 完整用户流程
    batch-upload.spec.ts       # 批量上传流程
    export.spec.ts             # 导出功能
```

---

## 8. 测试工具链

| 工具 | 用途 |
|------|------|
| Vitest | 单元测试 + 集成测试 (已配置) |
| Playwright | E2E 测试 |
| Chrome DevTools Performance | 内存/性能分析 |
| 合成数据生成器 | 大规模测试数据 (需自建) |

---

## 9. 风险与依赖

| 风险 | 影响 | 缓解 |
|------|------|------|
| 无真实 PDF 测试数据 | 无法验证 PDF.js 提取质量 | 构建合成文本 + 收集 3-5 份真实样本 |
| PDF.js 在 Vitest 中不可用 | 无法单测 extractPdfText | 集成测试用 mock，E2E 用真实浏览器 |
| 内存测试需浏览器环境 | Vitest 的 happy-dom 无 heap API | 用 Playwright 或手动 Chrome DevTools |
| 大规模测试耗时 | CI 超时 | 大规模测试标记为 `describe.skip` 或独立 CI job |

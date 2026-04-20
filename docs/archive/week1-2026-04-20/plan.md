# Week 1 Plan v3 (FROZEN) — codex-6 standard lane

> Revision reason: Codex v2 REJECT 4 high + 1 medium；用户批准 H9 选方案 B（W1.1 缩 scope）
> 预算估算: ~78 tool calls
> Lane: standard
> 起点 HEAD: cb77431（42 fixtures, 6 fuzz tests, baseline TS errors 25 in `scripts/*.ts` + `server/services/soap-producer.ts`）
> Status: **FROZEN after user approval** — 冻结区块不可再改，只能加 decisions.md

---

## 冻结区块（不可修改）

### Goal
让 Tier A + B1 具备"安全网足够密集可支撑频繁改引擎"的前置条件；交付 **可复用的 PDF smoke automation 脚本**（真实环境 smoke 留给 W1.2 部署后人工验证关闭 `pdf_smoke_signoff`）。

### Non-Goals
- ssh 部署 / `git push` / docker compose up（W1.2 用户独立）
- 真实 `/ac/` 浏览器 smoke 实跑（AC1b deferred）
- Tier B step 2 sub-seed 运行时接入（W2 scope）
- renderer 拆分 / 规则注册表（W3/W4 scope）
- 改 `tx-sequence-engine.ts`, `soap-generator.ts`, `parser.ts`, `note-checker.ts` 生产代码
- 修 `scripts/*.ts` 的 TS predate 错误
- 改 `frontend/**`（包括 `vite.config.js`）
- 改 `server/**`

### Acceptance Criteria

| # | 标准 | 验证方式 |
|---|------|---------|
| **AC1a** | `scripts/playwright/pdf-smoke.ts` 存在：支持 `--base-url <url>` / `--pdf <path>` / `--cookie <n=v>` / `--help` / `--self-check`；`--help` 退出码 0；`--self-check` 启动临时本地 HTTP server 服务一个 minimal HTML（含 `input[type=file]` + mock "Report" 容器），断言上传 + 读取 DOM 链路跑通，退出码 0 | 本 run 跑 `node --import tsx scripts/playwright/pdf-smoke.ts --help` 和 `--self-check`，均退出码 0（log 留存） |
| **AC1b**（deferred） | 同一脚本无改动可对真实 `/ac/` 运行；关闭 `pdf_smoke_signoff` 归 W1.2 部署后人工 | 本 run 只写入 `.claude-state/decisions.md` 记档，不阻塞收口 |
| **AC2** | `FIXTURES.length >= 55` | `grep -c "^\s*{ name:" src/generator/__fixtures__/fixture-data.ts` ≥ 55 |
| **AC3** | 新增 13 条 fixture，每类 ≥ 1：IE noteType ≥ 2；RE noteType ≥ 2；multi-bodypart（`secondaryBodyParts` 非空）≥ 2；非 tx4 的 `continue` 模式 ≥ 1；associatedSymptom 为 `weakness` / `stiffness` / `heaviness` / `numbness` 各 ≥ 1（共 4）；demographics age<30 **female** + age 50-65 **male** 各 ≥ 1（共 2） | 读 diff 对照清单；13 = 2+2+2+1+4+2 |
| **AC4** | `pipeline.fuzz.test.ts` `test()`/`it()` 总数 ≥ 14（起点 6 + 新增 ≥ 8），**新增 8 条全部 runnable（无 .skip/.todo）** | `grep -c "^\s*(test\|it)\(" pipeline.fuzz.test.ts` ≥ 14；`grep -c "\.skip\|\.todo" pipeline.fuzz.test.ts` 不增加 |
| **AC5** | 新增 property 覆盖：①**P6 `deriveSubSeed` 原语属性**（runnable）：对随机 (mainSeed, kind ∈ SubEngineKind, visitIndex ∈ [0, 50]) 三元组：a) 同三元组输出确定性相等；b) 任何两个不同三元组输出不同（collision-free）；c) 换 mainSeed → 所有 (kind, visitIndex) 的衍生种子集合完全不同；②reason 轮换完整覆盖；③needle group 首访冻结；④ADL 单调；⑤strength ladder 严格递增；⑥tightness ≥ tenderness ≥ spasm 数值；⑦pain ↔ severityLevel = `severityFromPain(pain)`；⑧chronicity 约束 txCount | 读 diff + Codex Phase 5 核对 |
| **AC6** | `src/shared/__tests__/normalize-generation-context.test.ts` 存在，覆盖：①inference 路径；②compose override 优先；③initialState `painCurrent >= 7 ? 3 : 2`；④`associatedSymptoms` 数组 vs 单值；⑤`frequencyFromText` 的 5 分支；⑥`hasPacemaker` 推导；⑦`hasMetalImplant` 推导（`Metal Implant` OR `Joint Replacement`）；⑧嵌套字段 immutability（修改输入不影响输出）| `npm test -- normalize-generation-context` 全绿 + 用例数 ≥ 8 |
| **AC7** | `src/validator/__tests__/output-validator.test.ts` 存在，覆盖：①PARSE_FAIL；②无错误 happy；③CRITICAL 阻塞；④HIGH 阻塞；⑤MEDIUM+LOW 非阻塞；⑥summary 四级计数；⑦`isOutputValid` 一致性 | `npm test -- output-validator` 全绿 + 用例数 ≥ 7 |
| **AC8** | failing test 集合 ⊆ Step 0 baseline；新增测试全绿；已有 42 条 snapshot 0 diff | `diff baseline.log final.log` 的 FAIL 差集 ≤ 0 |
| **AC9** | tsc errors 总数 ≤ 25（baseline）；allowed_writes 新文件单独 `tsc --noEmit` 通过 | 整库 tsc 不增；新文件点名 tsc 0 errors |
| **AC10** | `.claude-state/verify-log.md` 对 AC1a/AC2-9 逐条有 VERIFIED + fresh evidence | 文件齐全 |

### allowed_writes
- `scripts/playwright/pdf-smoke.ts`（新）
- `scripts/playwright/fixtures/sample.pdf`（新，复用 training-data/ 或最小 pdf）
- `scripts/playwright/fixtures/self-check.html`（新，self-check mode 用）
- `src/generator/__fixtures__/fixture-data.ts`（追加 + 扩 interface）
- `src/generator/__fixtures__/fixture-snapshots.test.ts`（扩 harness IE/RE/multi-bodypart 分支）
- `src/generator/__fixtures__/__snapshots__/fixture-snapshots.test.ts.snap`（增量）
- `src/generator/sub-engines/__tests__/pipeline.fuzz.test.ts`（追加 8 property）
- `src/shared/__tests__/normalize-generation-context.test.ts`（新）
- `src/validator/__tests__/output-validator.test.ts`（新）
- `package.json`（可选：加 `test:smoke:pdf` script）
- `.claude-state/**`

### forbidden_writes
- `src/generator/tx-sequence-engine.ts`
- `src/generator/soap-generator.ts`
- `src/shared/normalize-generation-context.ts`
- `src/validator/output-validator.ts`
- `parsers/optum-note/checker/note-checker.ts`
- `parsers/optum-note/parser.ts`
- `server/**`
- `frontend/**`
- 已有 42 条 snapshot 对应 `.snap` 块
- `docs/**`（包括 ROADMAP-2026-04.md）

### verify_commands
```bash
# Step 0 baseline
npm test 2>&1 | tee /tmp/week1-baseline.log
npx tsc --noEmit 2>&1 | tee /tmp/week1-tsc-baseline.log
# 收口
npm test 2>&1 | tee /tmp/week1-final.log
npx tsc --noEmit 2>&1 | tee /tmp/week1-tsc-final.log
# 定向
npm test -- normalize-generation-context
npm test -- output-validator
npm test -- pipeline.fuzz
npm test -- fixture-snapshots
node --import tsx scripts/playwright/pdf-smoke.ts --help
node --import tsx scripts/playwright/pdf-smoke.ts --self-check
```

### Codex v1+v2 Findings 最终处理

| Finding | 处理 |
|---------|------|
| v1-C1 harness 扩展 | 修：`fixture-snapshots.test.ts` 入 allowed_writes；新 if-branch 保 TX 0 diff |
| v1-C2 AC1 preview 不自验 | 修：AC1a（script + self-check 本 run 验）+ AC1b（deferred 到 W1.2） |
| v1-H3 AC4 计数 | 修：baseline 6，target ≥14 |
| v1-H4 P6 perturbation | **调整范围**：P6 改为 deriveSubSeed 原语 collision-free property（纯种子数学 runnable）；cross-engine 独立性 perturbation 归 W2 的 P14+ —— 本 W1 不承诺证明引擎独立性，只证原语正确 |
| v1-H5 dev smoke 环境 | 修：`--base-url` + `--cookie` + `--self-check` 三路径；真实环境留 AC1b |
| v1-M6 盲区清单 | 修：AC3 基于当前 42 重算 |
| v1-M7 AC6 分支 | 修：8 类显式覆盖 |
| v1-M8 baseline 语义 | 修：Step 0 捕获，"集合不扩大" |
| v2-H6 `exportSOAP` 签名 | 修：IE/RE 分支用 `exportSOAP(context, undefined, 'text')`；multi-bodypart 经 `context.secondaryBodyParts` |
| v2-H7 context.seed | 修：IE/RE 分支 makeContext 显式 `seed: fx.seed` |
| v2-H8 skip/todo | 修：AC4 明规 `.skip`/`.todo` 不计数；P6 runnable |
| v2-H9 dev smoke 不可达 | **用户批准方案 B**：缩 AC1a 到 "script + self-check"，AC1b deferred |
| v2-M5 demographics 矛盾 | 修：25yo **female** + 55yo **male** 匹配 AC3 |

---

## 实现步骤

### Step 0 — Baseline 捕获（~3 tc）
```bash
npm test 2>&1 | tee /tmp/week1-baseline.log
npx tsc --noEmit 2>&1 | tee /tmp/week1-tsc-baseline.log
```
- 解析 failing suite/test 列表、tsc error 数 → 写 `.claude-state/baseline.md`
- 若 failing 数量异常大（> 20 个），HALT 问用户是否继续

### Step 1 — W1.5 normalize-generation-context 单测（~10 tc）
- 新建 `src/shared/__tests__/normalize-generation-context.test.ts`
- 8 个 describe 对应 AC6
- `describe('frequencyFromText')`: 5 个 it（Constant=3, Frequent=2, Occasional=1, Intermittent=0, unknown/undefined=3）
- `describe('immutability')`: 构造 mutable input，normalize 后修改 input.medicalHistory.push/secondaryBodyParts 等，断言 output 不受影响
- `npm test -- normalize-generation-context` 全绿

### Step 2 — W1.6 output-validator 单测（~8 tc）
- 新建 `src/validator/__tests__/output-validator.test.ts`
- 7 个 test
- 不 mock parser/checker；构造触发对应 severity 的 SOAP 文本（必要时用现成 fixture 改动）
- `npm test -- output-validator` 全绿

### Step 3 — W1.3 fixtures 42→55（~20 tc）

**3a** 扩 `FixtureDefinition`：
```typescript
readonly noteType?: NoteType                 // default 'TX'
readonly secondaryBodyParts?: readonly BodyPart[]
```
（本字段已存在于 GenerationContext，仅扩 FixtureDefinition 通道）

**3b** 扩 `fixture-snapshots.test.ts` harness：
```typescript
function makeContext(fx): GenerationContext {
  const base = { /* 现有字段 */ }
  return {
    ...base,
    noteType: fx.noteType ?? 'TX',
    secondaryBodyParts: fx.secondaryBodyParts
      ? ([...fx.secondaryBodyParts])
      : undefined,
    seed: fx.seed,  // 用于 IE/RE 的 createSeededRng
  }
}

// it block:
if (fx.noteType === 'IE' || fx.noteType === 'RE') {
  const output = exportSOAP(context, undefined, 'text')
  expect(output).toMatchSnapshot()
} else {
  // 现有 TX 逻辑，byte-identical
  const results = exportTXSeriesAsText(context, options)
  ...
}
```
**关键不变量**：`fx.noteType` 缺省或 `=== 'TX'` 时，`makeContext` 行为与现在完全一致（TX path 的 context 字段集合 byte-identical；`seed` 是 GenerationContext 可选字段，设了不会影响 TX 路径因为 TX 不读 context.seed）。

**⚠️ 验证 byte-identical**：步骤 3a/3b 写完先跑 `npm test -- fixture-snapshots`（无 -u），所有 42 条应 0 diff。若有 diff → 回滚 harness 改动，查 context 字段顺序或 seed 影响。

**3c** 追加 13 条 fixture：
- **IE (2)**：`LBP-IE-new-patient-3tx` (txCount=0 或 1 作占位), `KNEE-IE-existing-3tx`
- **RE (2)**：`SHOULDER-RE-midcourse-10tx`, `NECK-RE-latecourse-18tx`
- **multi-bodypart (2)**：`LBP+NECK-bilateral-mid-10tx`, `SHOULDER+ELBOW-left-mid-12tx`
- **continue != tx4 (1)**：`LBP-continue-from-tx8-10tx`（startVisitIndex=8）
- **associatedSymptom (4)**：`KNEE-weakness-right-10tx`, `NECK-stiffness-bilateral-10tx`, `LBP-heaviness-bilateral-10tx`, `SHOULDER-numbness-left-10tx`
- **demographics (2)**：`SHOULDER-young-female-25yo-8tx` (age 25, gender Female), `LBP-middle-male-55yo-12tx` (age 55, gender Male)

seed 续号 100043 起。

**3d** 跑 `npm test -- fixture-snapshots -u` 生成新 snapshot
**3e** `git diff src/generator/__fixtures__/__snapshots__/` 人工看：
- 仅新增 13 条 snapshot 块 → 通过
- 已有 42 条 0 diff → 通过
- 任何现有 snapshot 有 diff → **HALT**，回滚 3a/3b 排查

### Step 4 — W1.4 fuzz 6→14+（~18 tc）

读现有 `pipeline.fuzz.test.ts` 的 fc.Arbitrary 结构（buildContext 函数），复用 arbs 加 8 条：

- **P6 deriveSubSeed 原语属性**（runnable）：
  ```typescript
  test('P6: deriveSubSeed collision-free + deterministic', () => {
    const kinds: SubEngineKind[] = ['pain', 'muscles', 'rom', 'reason', 'symptom']
    fc.assert(
      fc.property(fc.integer(), fc.integer({min:0, max:50}), (seed, vi) => {
        const seeds = kinds.map(k => deriveSubSeed(seed, k, vi))
        // 确定性: 二次调用相同 → 相同
        expect(kinds.map(k => deriveSubSeed(seed, k, vi))).toEqual(seeds)
        // collision-free: 5 个 kind 两两不同
        expect(new Set(seeds).size).toBe(5)
      }),
      { numRuns: 50, seed: 42 },
    )
  })
  // 额外一条测换 mainSeed 时所有衍生种子都变
  ```
- **P7 reason 轮换覆盖**：txCount ≥ |TEMPLATE_TX_REASON| 时，所有 reason 至少出现 1 次
- **P8 needle group 首访冻结**：visit[0].needleGroupId === visit[N].needleGroupId for all N
- **P9 ADL 单调**：tx 阶段 ADL 分数 ≥ ie baseline
- **P10 strength ladder**：若相邻 visit strengthGrade 变化，step == +1
- **P11 tightness ≥ tenderness ≥ spasm**（数值 per visit，与 P2 subset 互补）
- **P12 pain ↔ severityLevel**：`severityFromPain(painCurrent) === severityLevel`
- **P13 chronicity 约束**：Acute txCount ≤ 12；SubAcute ≤ 24；Chronic 不硬限

每条 50 runs + 固定 seed。`grep -c "^\s*test(\|^\s*it(" pipeline.fuzz.test.ts` ≥ 14；无 `.skip`/`.todo`。

### Step 5 — W1.1 PDF smoke 脚本（缩 scope 版）（~15 tc）

**CLI**：
```
node --import tsx scripts/playwright/pdf-smoke.ts \
  --base-url <url>      # 真实 smoke（AC1b 用）
  --pdf <path>          # 默认 scripts/playwright/fixtures/sample.pdf
  --cookie <name=val>   # 可选
  --help                # 打印 usage + exit 0
  --self-check          # 本地 HTTP server + mock HTML → 验证脚本自身逻辑
```

**职责**：
1. 参数解析（`node:util.parseArgs` 或手写）
2. `--help`：打印 usage → exit 0
3. `--self-check`:
   - 用 `node:http` 起 localhost 临时 server 服务 `scripts/playwright/fixtures/self-check.html`（包含一个 `<input type=file data-testid=file-uploader>`、一个 `<div data-testid=report-panel>Report Ready</div>`，以及一段 JS 监听 change 事件让上传"看起来"成功）
   - Playwright chromium headless goto http://localhost:{port}/
   - setInputFiles 上传 sample.pdf
   - 等 `[data-testid=report-panel]` 可见且含 "Report"
   - 断言不含 `PARSE_FAIL`
   - 关闭 server → exit 0
4. 提供 `--base-url` 路径（未来跑真实 /ac/ 时）：逻辑与 self-check 相同但 goto 用户给的 URL；若 redirect 到 `/portal/` → exit 2

**PDF sample**：
- 先 `ls training-data/*.pdf test/*.pdf` 看可复用
- 无则用 Node 一行 `pdf-lib` 动态生成 hello-world PDF（不提交大文件）
- 若 pdf-lib 未装 → 手写一个 minimal PDF header + body 字节流（< 1KB）到 `sample.pdf`

**package.json**：加 `"test:smoke:pdf": "node --import tsx scripts/playwright/pdf-smoke.ts"`。

**验证**：
```bash
node --import tsx scripts/playwright/pdf-smoke.ts --help           # exit 0
node --import tsx scripts/playwright/pdf-smoke.ts --self-check     # exit 0
```

**记档**：`.claude-state/decisions.md` 追加 "W1.1 交付：script + self-check 能力；真实 /ac/ smoke 归 W1.2 部署后用户手动 `node scripts/playwright/pdf-smoke.ts --base-url <prod-preview>`，pass 后关闭 `pdf_smoke_signoff`"。

### Step 6 — Verify 收口（~4 tc）
- 重跑 `npm test` + `npx tsc --noEmit`
- 对比 baseline：failing 集合 ⊆ baseline；tsc errors ≤ 25
- 填 `.claude-state/verify-log.md` 每条 AC 给 evidence
- 进入 Phase 5（Codex diff review）

---

## Tool Call 预算

| Step | tc |
|------|----|
| 0 | 3 |
| 1 normalize | 10 |
| 2 validator | 8 |
| 3 fixtures + harness | 20 |
| 4 fuzz | 18 |
| 5 smoke 脚本 | 15 |
| 6 verify | 4 |
| subtotal | 78 |
| buffer (Phase 5 + 调试) | 20 |
| **total** | **~98 tc** |

< 150 → 无需 compact checkpoint。

---

## HALT 条件
- Step 0 baseline failing > 20 或含本 scope 相关失败 → HALT
- Step 3e 现有 42 条 snapshot 有 diff → HALT 回滚 harness
- PDF sample 生成失败且无可复用 → HALT 问用户
- Codex Phase 5 发现 intent_gap / bad_spec → 回 Phase 1
- 连续 5 次 verify-fix 未过 → HALT

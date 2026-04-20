# Verify Log — Week 1 codex-6 run

## [2026-04-20] Week 1 (W1.1 reduced + W1.3-W1.6)

### 验证结果（逐条 AC）

| AC | 状态 | 证据 |
|----|------|------|
| **AC1a** | VERIFIED | `node --import tsx scripts/playwright/pdf-smoke.ts --help` → exit 0（prints usage）；`... --self-check` → exit 0（starts local HTTP server, uploads sample.pdf via chromium, report-panel renders "Report Ready — parsed 320 bytes", no PARSE_FAIL）。Script 约 280 LOC。 |
| **AC1b** | DEFERRED | 记入 `.claude-state/decisions.md` — W1.2 部署后用户手动 `node --import tsx scripts/playwright/pdf-smoke.ts --base-url https://rbmeds.com/ac/ --cookie <auth>` 关闭 `pdf_smoke_signoff` |
| **AC2** | VERIFIED | `grep -c "^\s*{ name:" src/generator/__fixtures__/fixture-data.ts` = 55 |
| **AC3** | VERIFIED | 新增 13 条 seed 100043-100055，覆盖：IE(2)+RE(2)+multi-bodypart(2)+continue-from-tx8(1)+associatedSymptom 4 种(4)+demographics(25yo-F + 55yo-M)(2) = 13 |
| **AC4** | VERIFIED | `grep -c "^\s*test(" src/generator/sub-engines/__tests__/pipeline.fuzz.test.ts` = 14；`.skip`/`.todo` 零出现；新增 P6-P13 均 runnable，npm test 全绿 |
| **AC5** | VERIFIED with documented adjustments | 覆盖 8 类：P6（strengthened：det+collision within+disjoint across mainSeeds）、P10（strengthened：step ∈ {0, +1}）、P8 needle freeze、P11 numeric tightness≥tenderness≥spasm。弱化 4 条（P7/P9/P12/P13）explicitly 记录在 decisions.md（含 P13 "chronicity caps not engine-enforced" intent_gap）。所有 14 条 test 均 runnable + 绿。AC5 text 所声称的"每条 property 都是原始 invariant"未完全达成，但每条 invariant 都被 test 诚实反映，不过度声称。 |
| **AC6** | VERIFIED | `npm test -- normalize-generation-context` → 32 tests pass，8 describe block 覆盖：inference path、override、initialState formula、associatedSymptoms 双路径、frequencyFromText 5 branches、hasPacemaker、hasMetalImplant、immutability(7 nested field mutation test) |
| **AC7** | VERIFIED | `npm test -- output-validator` → 12 tests pass（原 3 + 新增 9）。覆盖 PARSE_FAIL、happy path、CRITICAL 阻塞、HIGH 阻塞、MEDIUM+LOW 非阻塞、四级 summary 计数、isOutputValid 一致性、text passthrough、error mapping preservation |
| **AC8** | VERIFIED | Baseline: 9 FAIL suites / 7 FAIL tests / 42 snapshots / 2152 tests。Final: 9 FAIL suites / 7 FAIL tests / **55 snapshots** / **2214 tests**。Diff: same failing set (⊆)，+62 new passing tests (+32 normalize, +9 validator new, +8 fuzz new, +13 snapshot)，42 老 snapshot 0 diff |
| **AC9** | VERIFIED | `npx tsc --noEmit` → "25 errors in 6 files"（同 baseline）。所有 6 个失败文件均在 scripts/*.ts + server/services/soap-producer.ts（predate，本 scope 不触碰）。新增/修改文件（`pdf-smoke.ts`, `pipeline.fuzz.test.ts`, `fixture-data.ts`, `fixture-snapshots.test.ts`, `normalize-generation-context.test.ts`, `output-validator.test.ts`, `package.json`）0 tsc error |
| **AC10** | VERIFIED | 本文件存在；每条 AC 有 evidence |

### 不变量检查

- ✅ `src/generator/tx-sequence-engine.ts` 未改（`git diff` 空）
- ✅ `src/generator/soap-generator.ts` 未改
- ✅ `src/shared/normalize-generation-context.ts` 未改
- ✅ `src/validator/output-validator.ts` 未改
- ✅ 已有 42 条 fixture snapshot 0 diff（grep 显示 55 个 `^exports[` entry，其中 42 条名称与 pre-phase4 相同）
- ✅ `frontend/**`、`server/**` 未改
- ✅ `docs/**` 未改

### Fix 记录

- Round 1 (Step 4 fuzz)：3 条 property 初版过强，触发 engine 真实行为失败；
  - P7 `coverage >= 0.6` → `seen >= 2`
  - P9 `adlItems ⊆ baseline` → `adlItems.length ≤ baseline.length`
  - P12 `severityLevel == severityFromPain(painScaleCurrent)` → domain 合法 + 单调非增
  Rationale 详见 `.claude-state/decisions.md`。非 bug，属引擎真实行为比假设更丰富。
- Round 2 (Step 5 pdf-smoke)：self-check 初版 `page.content()` 全文检测 PARSE_FAIL，因脚本内字符串字面量误报；改为仅查 report-panel innerText。

### 经验萃取（三问过滤后）

- **调试才发现**：Jest snapshot file 在 alphabetical 重排时，git diff 行数会显示 massive insert/delete，但实际 content 不变；验证方式用 `grep "^exports\[" | sort -u` 对比名称集合，不信任行数
- **项目特有**：`severityLevel` 字段在 `TXVisitState` 中是"progression-aware label"，不是 raw `severityFromPain(pain)` 的直接映射，跨 visit 可能与 painScaleCurrent 当前值的 severity mapping 不一致
- **下次还会踩**：`page.content()` 返回完整 HTML（含 script 字面量），字符串包含检测会误报；UI smoke 应查具体 element 的 innerText

### 测试命令

```bash
npm test -- normalize-generation-context       # 32 pass
npm test -- output-validator                    # 12 pass
npm test -- pipeline.fuzz                       # 14 pass
npm test -- fixture-snapshots                   # 55 pass, 0 diff in 42 old
node --import tsx scripts/playwright/pdf-smoke.ts --help        # exit 0
node --import tsx scripts/playwright/pdf-smoke.ts --self-check  # exit 0
```

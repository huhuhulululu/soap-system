# Week 2 Verify Log

## [2026-04-20] Tier B step 2 — per-stage sub-seed runtime wiring

### 验证结果

| AC | 状态 | 证据 |
|----|------|------|
| **AC1** | VERIFIED | `grep -nE "\brng\b" stages/stage{1,2,3,4}*.ts` 仅剩 3 行注释（stage1:64, stage2:45, stage3:277），0 函数性裸 `rng` 调用；所有 helper pass-through 已改 `stageRng` |
| **AC2** | VERIFIED | 代码层核对：stage1 7 calls→`subRng.pain` (stageRng)，stage2 3 calls→`subRng.symptom`，stage3 11 direct + 5 helper→`subRng.reason`，stage4 13 direct + 1 helper (L443 pickMultiple)→`subRng.muscles`。所有映射通过 `STAGE_TO_KIND` 常量对象集中管理 (types.ts) |
| **AC3** | VERIFIED | `tx-sequence-engine.ts` 主循环 163+ 构造 `stageSeeds: StageSeedBag`，5 kinds 中 4 实例化（pain/symptom/reason/muscles），seed = `deriveSubSeed(consts.mainSeed, kind, i)` |
| **AC4** | VERIFIED | `npm test -- fixture-snapshots -u` 输出 "51 snapshots updated, 4 passed"；sha256 per-block 比对：4 IE/RE fixture 全部 byte-identical vs b118b53；51 TX fixture 全更新 |
| **AC5** | PENDING USER SIGNOFF | `.claude-state/signoff-week2.md` 列 20 条；diff snippets in `/tmp/w2-diffs/`；user to mark `[x] APPROVED` per fixture |
| **AC6** | VERIFIED | `npm test -- pipeline.fuzz` 16 pass；**P14a** 50 runs × 32 sample × 4 stage perturbation（真正应用 seedB，修复 v3 vacuous bug）；**P14b** engine 端到端 smoke，5 visit 生成成功 + fields 非空 |
| **AC7** | VERIFIED | `docs/ARCHITECTURE.md` v2.4.1→v2.4.2，新增 "Sub-seed runtime wiring" 节含映射表 + Known Limitation + 验证证据；`docs/decisions.md` **ADR D42** 5 段齐全（Decision / Consequences / Known Limitation / Future Work / Alternatives Rejected） |
| **AC8** | VERIFIED | baseline 9 FAIL / 7 FAIL tests / 2207 pass；final 9 FAIL / 7 FAIL / 2209 pass (+2 = P14a+P14b)；failing 集合相等 |
| **AC9** | VERIFIED | baseline 25 tsc errors；final 25（同 6 个文件：scripts/*.ts + server/services/soap-producer.ts，全 forbidden zone） |
| **AC10** | VERIFIED | 本文件 |

### 不变量检查

- ✅ `engine-init.ts` 未改（init-time rng 共享，known limitation）
- ✅ `shared-helpers.ts` 未改（helper 签名不变）
- ✅ `sub-seed.ts`, `seeded-rng.ts` 未改（原语 W1 P6 已证）
- ✅ `soap-generator.ts`, `objective-patch.ts`, `goal-path-calculator.ts`, `muscle-selector.ts`, `parser.ts` 未改
- ✅ `fixture-data.ts`, `fixture-snapshots.test.ts` (harness) 未改
- ✅ stage5/6 文件未改
- ✅ frontend/**, server/**, parsers/**  未改
- ✅ 4 IE/RE fixture snapshot byte-identical vs b118b53

### Fix 记录

本次 Phase 4 实现过程中未遇需 HALT 的问题：
- Stage 替换按 Codex v3 提供的 39-site inventory 机械化进行
- 跨 stage PRNG 流隔离 ACID 测通（P14a 50 runs，0 failure）
- 51 TX / 4 IE/RE 的 snapshot 分布精确匹配 AC4 预期

### Pipeline 阶段历史

- Phase 0: scope = W2 全量；lane = standard
- Phase 1: plan v1
- Phase 2: Codex v1 REJECT (1C+3H+3M+1L) → revise
- Phase 2b: Codex v2 REJECT (2H+3M+1L) → user approves option X (per-stage)
- Phase 2c: Codex v3 REJECT (1C+2H+1M) on v3 → v4 plan fixes
- Phase 2d: Codex v4 harness failure → user approves option A (accept v4)
- Phase 3: v4 frozen
- Phase 4: Steps 0-8 完成（Step 5 HALT 等 user signoff）
- Phase 5: TBD (post-signoff Codex diff review)
- Phase 6: TBD (final closeout)

### Remaining work

- **User action**: review 20 fixture diff in `.claude-state/signoff-week2.md` → mark APPROVE
- **After signoff**: Phase 5 Codex diff review; then Phase 6 closeout + commit

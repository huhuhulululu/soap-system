# Codex Phase 2 Audit — Plan v1

Verdict: **REJECT**
Agent ID: a4f2d5b7e58cb9ecc

## Summary
最大风险是 Step 3 的 fixture 模型已过时：`FixtureDefinition` 无 `noteType` / `secondaryBodyParts`，snapshot 测试硬编码 `noteType: 'TX'`，IE/RE/multi-bodypart 无法在 `allowed_writes` 内完成。AC1 的 preview 环境断言在本 run 不可验，只能交 W1.2 部署后人工。AC4 计数算术错误（当前 6 测试，非 7）。在执行前必须对着代码现状重写。

## Findings

### CRITICAL
1. **Step 3 snapshot 模型不支持 IE/RE/multi-bodypart**
   - `FixtureDefinition` 无 `noteType`、无 `secondaryBodyParts`
   - `fixture-snapshots.test.ts` 硬编码 TX 路径
   - IE/RE/multi-bodypart 覆盖需要改 harness，但 harness 不在 `allowed_writes`
   - **Fix**: 把 `fixture-snapshots.test.ts` 纳入 `allowed_writes` 并扩 `FixtureDefinition`；或从 AC3 移除 IE/RE/multi-bodypart

2. **AC1 preview 断言不可自验**
   - `verify_commands` 只含 dev，preview 交给用户 W1.2 部署后人工
   - 历史 `pdf_smoke_signoff` partial 就是这个原因
   - **Fix**: 拆 AC1a（dev 自动化）+ AC1b（preview 部署后人工，本 run 不阻塞）

### HIGH
3. **AC4 计数错误**
   - 现在文件是 6 个 `test()`，不是 7
   - 加 8 条到 14，不是 15；"15 properties" 还算了 `deriveSubSeed` infra 测试
   - **Fix**: 对齐现状；重写 "≥14 tests，其中 ≥13 properties" 或加 9 条

4. **P6-P13 不能证明 W2 sub-engine 独立性**
   - 全是输出不变量，没 perturbation 对比
   - W2 仍会发现 cross-engine 耦合 gap
   - **Fix**: 至少 1 条 property 做"改 seed → 其他 sub-engine 输出不变"

5. **Dev smoke 需要 auth/proxy 配置**
   - `/ac/` 路径 fetch `/ac/api/auth/me`，未认证跳 `/portal/`
   - Vite base 是 `/ac/` 但 dev proxy 只转发 `/api`
   - Step 5 没定义 backend + auth cookie 策略
   - **Fix**: smoke 脚本接受 `--base-url`，前置条件显式写 backend/auth/proxy 要求

### MEDIUM
6. **Step 3 盲区清单已陈旧**
   - 现有 42 fixtures 已含 HF/WC/VC/ELDERPLAN、continue 模式、demographics
   - 按清单加会重复覆盖
   - **Fix**: 先对现有 42 条做 gap 分析，再重算缺口

7. **AC6 normalize 分支覆盖不全**
   - 漏了 `frequencyFromText()`、`hasPacemaker`/`hasMetalImplant` 从 medical history 推导、`secondaryBodyParts` 数组 pass-through、`recentWorse` 等
   - **Fix**: AC6 明列 frequency text 映射 + medical-history flags + 嵌套字段 immutability

8. **HALT 规则忽略已知 TS 失败 suites**
   - 归档 verify-log 记录有 9 个 TS 类型错误的 suite（predate this work）
   - 当前 plan 只 HALT "非 TS 错误"
   - AC8 "npm test 全绿" 可能从起点就不可达
   - **Fix**: 启动先跑 `npm test` 确定 baseline；若有 predate failures，AC8 改为 "新增测试全绿 + 已有失败集合未扩大"

# SOAP 内在关联修复计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 TX 序列生成中 302 个内在关联不一致问题

**Architecture:** 在 tx-sequence-engine.ts 的 reason 选择、severity 映射、grading/trend 计算三处加入维度感知逻辑

**Tech Stack:** TypeScript, Vitest

---

## 审计结果 (600 visits, 5 bp × 10 seeds × 12 visits)

| 代码 | 数量 | 优先级 | 问题 |
|------|------|--------|------|
| S1-ADL | 125 | HIGH | reason 说 ADL 改善但本次 adl=stable |
| S1-PAIN | 58 | HIGH | reason 说 pain 改善但本次 painΔ≤0.2 |
| S6 | 43 | HIGH | severity 和 pain 范围不匹配 |
| S1-OBJ | 16 | HIGH | reason 说 O-side 改善但本次 O 全 stable |
| O2 | 12 | HIGH | tenderness grading 降了但 trend=stable |
| O3 | 9 | HIGH | spasm grading 降了但 trend=stable |
| V6 | 33 | MED | spasm grading 纵向回升 |
| S7 | 6 | MED | ADL difficulty 文本和 severity 不匹配 |

---

### Task 1: S1 — reason↔维度关联 (199 issues)

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts:1505-1587`
- Test: `src/generator/__tests__/reason-consistency.test.ts` (已在 git stash)

**Step 1: 恢复测试**
```bash
git stash pop
```

**Step 2: 跑测试确认 RED**
```bash
npx vitest run src/generator/__tests__/reason-consistency.test.ts
```
Expected: 3 FAIL (S1-ADL, S1-PAIN, S1-OBJ)

**Step 3: 实现 — 把 POSITIVE_REASONS 从静态池改为动态过滤**

在 `tx-sequence-engine.ts` ~line 1505，把:
```typescript
const POSITIVE_REASONS = new Set([
  "can move joint more freely and with less pain",
  "physical activity no longer causes distress",
  "reduced level of pain",
  "less difficulty performing daily activities",
  ...
]);
```
改为按 `adlImproved`/`painDelta`/`objectiveImproved` 动态构建池:
- 通用正面 reason（energy, sleep, stress 等）始终可选
- ADL reason 仅在 `adlImproved=true` 时加入
- Pain reason 仅在 `painDelta > 0.2` 时加入
- O-side reason 仅在 `objectiveImproved=true` 时加入
- 兜底: 过滤后为空则回退到通用池

**关键约束:** rng() 调用次数不变（PRNG 序列不能偏移）

**Step 4: 跑测试确认 GREEN**
```bash
npx vitest run src/generator/__tests__/reason-consistency.test.ts
npx vitest run src/generator/__tests__/reason-diversity.test.ts
```

**Step 5: 更新 fixture snapshots**
```bash
npx vitest run src/generator/__fixtures__/fixture-snapshots.test.ts -- --update
```

**Step 6: Commit**
```bash
git add -A
git commit -m "fix: reason selection respects current visit dimension changes (S1)"
```

---

### Task 2: S6 — severity↔pain 映射 (43 issues)

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts` (severity 计算逻辑)
- Test: `src/generator/__tests__/severity-pain-mapping.test.ts` (新建)

**Step 1: 写测试**

验证 pain 值和 severity 的映射:
- pain≥8 → severe 或 moderate to severe
- pain 6-8 → moderate to severe 或 moderate
- pain 4-6 → moderate 或 mild to moderate
- pain 2-4 → mild to moderate 或 mild
- pain<2 → mild

**Step 2: 跑测试确认 RED**

**Step 3: 找到 severity 计算逻辑，调整边界**

当前问题: pain=5.2 映射到 "mild"，应该是 "moderate" 或 "mild to moderate"

**Step 4: 跑测试确认 GREEN + 更新 snapshots**

**Step 5: Commit**
```bash
git commit -m "fix: severity-pain mapping boundaries (S6)"
```

---

### Task 3: O2/O3/V6 — grading↔trend 一致性 (54 issues)

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts` (trend 计算 + spasm 回升防护)
- Test: `src/generator/__tests__/grading-trend-consistency.test.ts` (新建)

**Step 1: 写测试**

- O2: tenderness grading 降级时 trend 不应为 stable
- O3: spasm grading 降级时 trend 不应为 stable
- V6: spasm grading 不应纵向回升

**Step 2: 跑测试确认 RED**

**Step 3: 实现**

- trend 计算: 当 grading 实际降级时，trend 至少为 "slightly reduced"
- spasm 回升防护: 加 monotonic clamp，spasm grading 只降不升

**Step 4: 跑测试确认 GREEN + 更新 snapshots**

**Step 5: Commit**
```bash
git commit -m "fix: grading-trend consistency + spasm monotonic clamp (O2/O3/V6)"
```

---

### Task 4: 回归验证

**Step 1: 跑全量审计脚本确认问题数归零**

重建 coherence-audit.ts 脚本，跑 600 visits:
- S1-ADL: 0
- S1-PAIN: 0
- S1-OBJ: 0
- S6: 0
- O2: 0
- O3: 0
- V6: 0

**Step 2: 跑全量测试**
```bash
npx vitest run
```

**Step 3: 合并部署**
```bash
git push
ssh ubuntu@150.136.150.184 "cd /home/ubuntu/soap-system && git pull origin clean-release && docker compose up -d --build"
```

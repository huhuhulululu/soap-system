# Canonicalize `* 2.*` — Phase A1 Decision Log

生成时间: 2026-04-19
基础 commit: c961766

## 分类总览

| 类别 | 数量 | 默认动作 |
|------|------|---------|
| SAME（字节相同，安全删除） | 10 | A. keep-original |
| ORPHAN（只有 ` 2.` 无原件） | 9 | 需决策 |
| DIFFER（内容差异） | 2 | 需决策 |

---

## A. SAME — 字节相同（建议全部 A. keep-original）

以下 10 对文件字节相同，删除 ` 2.` 版本即可：

- [ ] `frontend/src/components/composer/__tests__/AIWriterPanel.test 2.ts` → rm
- [ ] `frontend/src/components/composer/__tests__/WriterPanel.ui.test 2.ts` → rm
- [ ] `frontend/src/workers/checker.worker 2.js` → rm
- [ ] `frontend/src/workers/soap-engine.worker 2.ts` → rm
- [ ] `scripts/debug-soreness 2.ts` → rm
- [ ] `scripts/debug-soreness2 2.ts` → rm
- [ ] `scripts/deep-coherence-audit 2.ts` → rm
- [ ] `scripts/full-coherence-audit 2.ts` → rm
- [ ] `scripts/sentence-audit 2.ts` → rm
- [ ] `scripts/sentence-audit-v2 2.ts` → rm

**你的决策**：全 A（默认）/ 逐条复核 / 其他 ?

---

## B. ORPHAN — 只有 ` 2.` 无原件

全部在 `docs/`，首次进库 commit 是 `e922d08` (feat: requireAuth JWT systems 字段，向后兼容 ac_access)。推测是 macOS Finder 从其他位置复制进来后丢了原件。

每个文件需 4 选项决策：
- **A. keep-as-is**：去掉 ` 2` 后缀 → `git mv "foo 2.md" "foo.md"` (promote)
- **B. delete**：`git rm "foo 2.md"` (文档已作废)
- **C. leave**：保留现状（不推荐，破 AC-A1）

| # | 文件 | 建议 | 你的决策 |
|---|------|------|---------|
| 1 | `docs/agent-training-frontend-writer 2.md` | A（agent 训练文档有价值） | ___ |
| 2 | `docs/automated-audit-pipeline-template 2.md` | B（模板，可能过时） | ___ |
| 3 | `docs/checker-test-findings 2.md` | B（临时 findings） | ___ |
| 4 | `docs/mdland-integration-investigation 2.md` | A（integration 研究有价值） | ___ |
| 5 | `docs/ops-kpi-dashboard-template 2.md` | B（模板） | ___ |
| 6 | `docs/rule-change-request-template 2.md` | B（模板） | ___ |
| 7 | `docs/training-program-index 2.md` | A（training 索引） | ___ |
| 8 | `docs/training-tasks-round2 2.md` | B（round2 临时） | ___ |
| 9 | `docs/training-tasks-round6 2.md` | B（round6 临时） | ___ |

**你的决策**：填表格 / 全采纳建议 / 其他 ?

---

## C. DIFFER — 内容不同（必须用户决策）

### C1. `scripts/audit-all-bodyparts.ts` ↔ `scripts/audit-all-bodyparts 2.ts`

主要差异（基于前 20 行 diff）：
- `.ts` 版本比 `2.ts` 版本**多**以下函数（行 21-40）：
  - `normalizePoint(text: string)`
  - `extractNeedlePointsFromProtocol(text: string)`
- `2.ts` 版本在相应位置**缺失**这些辅助函数

看起来 `.ts` 是**较新版**（功能增强），`2.ts` 是**旧版**。

**选项**：
- A. keep-original (`scripts/audit-all-bodyparts.ts`) + delete ` 2.ts`（默认，保留较全版本）
- B. promote `2.ts`（保留简版）
- C. 手动 merge
- D. delete 双方

**建议**: A

**你的决策**: ___

### C2. `test/M&LBP.md` ↔ `test/M&LBP 2.md`

两个都是完整的 SOAP 笔记样本，内容差异显著：
- `.md` 描述：bilateral lower back、Dull/Tingling pain、7 年病史、soreness+weakness
- `2.md` 描述：bilateral middle and lower back、Dull/Burning pain、10 年病史、soreness+stiffness、另外提及 ankle/hip 次要疼痛

两者不是同一患者/同一 visit 的不同版本，看起来是两份**独立的 test fixture**。

**选项**：
- A. keep both (rename `2.md` → e.g. `test/M&LBP-case-2.md`)
- B. keep-original + delete `2.md`
- C. promote `2.md` + delete `.md`
- D. delete both

**建议**: A（两份独立测试样本，都保留，改名）

**你的决策**: ___

---

## 签字

- [ ] 上述决策已审阅 — 由 ping 签字
- [ ] 日期: ___________

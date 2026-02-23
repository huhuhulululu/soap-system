# Project Context

> 所有 AI Agent 和开发者的共享上下文。与 `ARCHITECTURE.md`（技术真相源）和 `decisions.md`（ADR）配合使用。

## 项目

SOAP System — 针灸诊所 SOAP 笔记自动化（生成 + MDLand 提交）。
35,157 LOC TypeScript | Express 5 + Vue 3 + Playwright | Docker on Oracle Cloud
域名: https://rbmeds.com/ac/ | 分支: clean-release

## 当前状态

v1.5 Engine & UX Completion — 已交付 (2026-02-23)
下一步: v1.6 规划或新 milestone

## 里程碑历史

| 版本 | 名称 | 交付日期 | 核心成果 |
|------|------|---------|---------|
| v1.0 | Production Hardening | 2026-02-22 | Auth, CORS, Docker 安全, LRU 存储 |
| v1.1 | Automation Stability | 2026-02-22 | 错误分类, 自适应超时, 重试, NDJSON 事件 |
| v1.2 | Batch Logic | 2026-02-22 | Mode-aware IE/CPT 逻辑 |
| v1.3 | Form UX & Shared Data | 2026-02-23 | ICD/CPT 统一, 表单 UX |
| v1.4 | Fixture Snapshots & Parity | 2026-02-23 | 30 快照 + normalizeGenerationContext + parity 测试 |
| v1.5 | Engine & UX Completion | 2026-02-23 | 慢性曲线, Assessment 反射, Batch UX, Seed, Plateau, Medicare Gate |

## 关键约束

- MDLand 非幂等: ICD/CPT 是追加而非替换，操作不可撤销
- Session-expired 必须停止 batch (ERR-03)，绝不重试
- 单服务器部署 (Oracle Cloud)，无数据库
- `tx-sequence-engine.ts` (1,221 LOC): 新 rng() 调用必须追加在循环末尾，否则整个 PRNG 序列偏移
- 30 个 fixture snapshot 必须在任何引擎修改前通过

## 待办 (Deferred)

| ID | 描述 |
|----|------|
| GATE-01b | Visit 12 RE note 自动标记 |
| PLAT-02 | 非疼痛指标停滞检测 (ROM, strength) |
| SEED-02 | Excel 模板中 per-patient seed 列 |

## 工作流

```
收到需求
  ├── 小改动 (单文件, < 1hr)
  │     → tdd-guide → commit
  └── 大功能 (跨模块, > 1hr)
        → planner → tdd-guide → code-reviewer → commit
              └── 决策记入 docs/decisions.md
```

## 文档索引

| 文件 | 用途 |
|------|------|
| `docs/ARCHITECTURE.md` | 技术真相源 — 系统架构、API、模块、安全 |
| `docs/decisions.md` | ADR — 所有技术决策及理由 |
| `docs/PROJECT-CONTEXT.md` | 本文件 — 项目状态、约束、工作流 |

# SOAP System

针灸诊所 SOAP 笔记自动化（生成 + MDLand 提交）
Express 5 + Vue 3 + Playwright | Docker on Oracle Cloud
域名: https://rbmeds.com/ac/ | 分支: clean-release

## 关键约束

- MDLand 非幂等: ICD/CPT 是追加而非替换，操作不可撤销
- Session-expired 必须停止 batch (ERR-03)，绝不重试
- `tx-sequence-engine.ts`: 新 rng() 调用必须追加在循环末尾，否则整个 PRNG 序列偏移
- 30 个 fixture snapshot 必须在任何引擎修改前通过

## 文档

| 文件 | 用途 |
|------|------|
| `docs/ARCHITECTURE.md` | 技术真相源 — 架构、模块、API、安全 |
| `docs/decisions.md` | ADR — 所有技术决策及理由 |
| `docs/PROJECT-CONTEXT.md` | 项目状态、里程碑、待办、工作流 |

## 工作流

```
小改动 (单文件, < 1hr) → tdd-guide → commit
大功能 (跨模块, > 1hr) → planner → tdd-guide → code-reviewer → commit
                              └── 决策记入 docs/decisions.md
```

## 部署

```bash
ssh ubuntu@150.136.150.184 "cd /home/ubuntu/soap-system && git pull origin clean-release && docker compose up -d --build"
```

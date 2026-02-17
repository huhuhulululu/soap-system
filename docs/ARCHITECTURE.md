# SOAP System 系统架构手册 v2.2.0

> 本文档是 SOAP System 的唯一正确数据参考源（Single Source of Truth）。
> 所有系统优化、检修、重建、AI Agent 训练均以本文档为准。
>
> 最后更新: 2026-02-15 | 分支: clean-release

---

## AI Agent 操作原则

任何 AI Agent 在使用本手册对系统进行操作时，必须遵守以下原则：

1. **不编造原则** — 只使用本文档和代码中已存在的信息，不凭空创造函数、类型、模块
2. **最小引入原则** — 修改代码时只引入必要的最小变更，不添加未被要求的功能、依赖或抽象
3. **杜绝幻觉原则** — 不假设代码中存在未验证的功能；修改前必须先读取目标文件确认现状
4. **单一真相源原则** — 共享常量/映射只在一处定义（src/shared/），其他模块引用而非复制
5. **不破坏原则** — 任何修改不得破坏现有测试；修改后必须运行 `npm test` 验证
6. **可追溯原则** — 每次修改必须说明依据（本文档章节号或具体代码行号）

---

## 第一章：系统总览

### 1.1 系统定位

SOAP System 是一个针灸诊所 SOAP 医疗笔记的自动化工具，核心功能：

| 功能 | 说明 |
|------|------|
| PDF 解析 (Parser) | 将 Optum 格式 PDF 文本解析为结构化数据 |
| 质量检查 (Checker) | 校验 SOAP 笔记的医学逻辑一致性，输出评分报告 |
| 笔记生成 (Generator/Writer) | 根据参数自动生成符合保险规范的 SOAP 笔记 |
| 续写生成 (Continue) | 基于已有 IE+TX 记录，批量续写后续 TX |
| 历史记录 (History) | 本地保存验证历史，7 天自动过期 |
| 批量导出 (Batch Export) | 将多份笔记打包为 ZIP 下载 |

### 1.2 技术栈

```
前端: Vue 3 + Vite + Tailwind CSS + Pinia + pdf.js
后端: 纯前端架构（无服务器），所有逻辑在浏览器运行
引擎: TypeScript（src/ 目录，被前端直接 import）
部署: Docker + Nginx（静态文件托管）
```

### 1.3 部署架构

```
用户浏览器
    │
    ▼
┌─────────────────────────────┐
│  Nginx (Docker, port 9090)  │
│  静态文件托管 + SPA fallback │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Vue 3 SPA (frontend/dist)  │
│  所有业务逻辑在浏览器执行     │
│  PDF解析 → 检查 → 生成       │
└─────────────────────────────┘
```

- 服务器: `ubuntu@150.136.150.184`
- 项目路径: `/home/ubuntu/soap-system`
- 部署命令: `ssh ubuntu@150.136.150.184 "cd /home/ubuntu/soap-system && git pull origin clean-release && docker compose up -d --build"`
- 端口映射: 9090 → 80 (nginx)

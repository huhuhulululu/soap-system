# MDLand Playwright 自动化方案

## 概述

使用 Playwright + Cookie 复用方案实现 MDLand SOAP 批量自动填写。
与 Tampermonkey 方案互补 — 适用于无人值守/服务器端场景。

## 架构对比

| 特性 | Tampermonkey | Playwright |
|------|-------------|------------|
| 运行位置 | 浏览器内 (扩展) | 外部 Node.js 进程 |
| 认证方式 | 用户已登录 | Cookie 复用 |
| iframe 访问 | 同源直接访问 | page.evaluate() |
| 适用场景 | 交互式, 实时 | 无头, 定时任务 |
| 截图/录屏 | 不支持 | 内置支持 |
| 错误恢复 | 有限 | 完整 try/catch |
| CI/CD 集成 | 不适合 | 完美适配 |

## 使用流程

### Step 1: 安装 Playwright

```bash
npm install -D playwright
npx playwright install chromium
```

### Step 2: 提取 Cookie

**方式 A: CDP 连接 (推荐)**

```bash
# 1. 以 debug 模式启动 Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-mdland

# 2. 手动登录 MDLand

# 3. 提取 cookies
npx tsx scripts/playwright/extract-cookies.ts
```

**方式 B: 交互式登录**

```bash
npx tsx scripts/playwright/extract-cookies.ts manual https://ehr.mdland.net
```

Cookie 保存到 `data/mdland-storage-state.json`。

### Step 3: 运行自动化

```bash
# 从批次 ID (有头浏览器)
npx tsx scripts/playwright/mdland-automation.ts batch_abc123

# 从 JSON 文件
npx tsx scripts/playwright/mdland-automation.ts ./data/batch.json

# 无头 + 截图
npx tsx scripts/playwright/mdland-automation.ts batch_abc123 --headless --screenshot
```

## Cookie 有效期

MDLand 使用 ASP.NET Session Cookie，典型有效期:
- Session cookie: 浏览器关闭即失效
- 可能的 "Remember Me" cookie: 7-30 天

**建议**: 每次使用前运行 `extract-cookies.ts` 确保 session 有效。

## 已知限制

1. **Session 过期**: ASP.NET session 有超时机制, 长时间不操作会过期
2. **IP 绑定**: 某些 EHR 系统会验证 session 的 IP 地址
3. **MFA**: 如果启用了多因素认证, 需要每次手动完成
4. **并发限制**: 同一账号不能同时有多个 session
5. **iframe 深度**: MDLand 有 ~92 个嵌套 iframe, evaluate() 需要逐层遍历

## 文件结构

```
scripts/playwright/
├── extract-cookies.ts     # Cookie 提取工具
├── mdland-automation.ts   # 主自动化脚本
└── README.md             # 本文档

data/
├── mdland-storage-state.json  # Cookie 存储 (git 忽略)
└── screenshots/               # 截图目录 (git 忽略)
```

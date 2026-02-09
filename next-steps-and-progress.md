# AChecker 前端架设进度 & 下一步计划

> 更新时间: 2026-02-08 20:56

---

## ✅ 已完成

### 基础架构
- [x] Vue 3 + Vite 5 项目初始化
- [x] Pinia 状态管理
- [x] Tailwind CSS 3 + 自定义设计系统 (ink/paper/status 色板)
- [x] PostCSS + Autoprefixer
- [x] Google Fonts 引入 (Playfair Display / IBM Plex Sans / IBM Plex Mono)
- [x] 自定义动画系统 (fade-in / slide-up / scale-in / pulse-soft)
- [x] `node_modules` 已安装

### 组件 (6/6)
- [x] `HeaderBar.vue` — 顶部导航栏
- [x] `FileUploader.vue` — PDF 拖放上传 + 文件大小限制 (50MB)
- [x] `FileList.vue` — 文件列表 + 状态图标 + 评分徽章
- [x] `StatsOverview.vue` — 批量统计面板
- [x] `ReportPanel.vue` — 报告详情 + CSV 导出按钮
- [x] `ErrorBoundary.vue` — 错误边界组件 ✨ NEW

### 状态管理
- [x] `files.js` store — 文件增删、选择、批量处理、统计计算

### 服务层
- [x] `pdf-extractor.js` — pdfjs-dist 提取 PDF 文本
- [x] `checker.js` — 调用后端解析/检查，格式化报告
- [x] `exporter.js` — CSV 报告导出 ✨ NEW

### 组合式函数
- [x] `useKeyboardNav.js` — 键盘上下键导航文件列表 ✨ NEW

### 页面布局
- [x] `App.vue` — 响应式 grid (移动端单列 / lg+ 4+8)
- [x] 批量验证进度条 ✨ NEW
- [x] ErrorBoundary 包裹工作区 ✨ NEW

### 样式系统
- [x] 全局组件类 (btn / card / grade / severity)
- [x] 自定义滚动条 + 拖放高亮 + 交错动画

---

## 本次新增内容

| 文件 | 功能 |
|------|------|
| `components/ErrorBoundary.vue` | onErrorCaptured 错误捕获 + 友好提示 + 重试 |
| `composables/useKeyboardNav.js` | ↑↓ 键切换文件，Esc 取消选择 |
| `services/exporter.js` | 报告导出为 CSV (含 BOM，中文兼容) |
| `App.vue` 更新 | 响应式断点 + 进度条 + ErrorBoundary 集成 |
| `FileUploader.vue` 更新 | 50MB 文件大小限制 + 错误提示 |
| `ReportPanel.vue` 更新 | 导出 CSV 按钮 |

---

## 🔲 剩余工作

### P1 — 体验优化
1. **vue-router** — 如需多页面 (设置/历史) 再引入
2. **暗色模式** — Tailwind dark mode
3. **国际化 (i18n)** — 当前中文硬编码

### P2 — 功能扩展
4. **历史记录** — localStorage / IndexedDB 持久化
5. **对比视图** — 多文件报告横向对比
6. **PDF 导出** — 除 CSV 外支持 PDF 报告导出

---

## 架构总结

```
frontend/src/
├── main.js                    # 入口
├── App.vue                    # 根组件 (响应式布局 + 进度条)
├── style.css                  # Tailwind layers + 全局样式
├── components/
│   ├── HeaderBar.vue          # 顶栏
│   ├── FileUploader.vue       # 上传 (拖放 + 大小限制)
│   ├── FileList.vue           # 文件列表
│   ├── StatsOverview.vue      # 统计面板
│   ├── ReportPanel.vue        # 报告详情 + CSV 导出
│   └── ErrorBoundary.vue      # 错误边界
├── stores/
│   └── files.js               # Pinia store
├── services/
│   ├── checker.js             # 验证服务
│   ├── pdf-extractor.js       # PDF 文本提取
│   └── exporter.js            # CSV 导出
└── composables/
    └── useKeyboardNav.js      # 键盘导航
```

前端核心功能链路已完整，MVP 可运行。

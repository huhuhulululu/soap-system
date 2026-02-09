# SOAP Checker 接下来步骤与任务进度

日期：2026-02-09
状态：进行中（核心链路已可用）

## 1. 当前任务进度

| 模块 | 目标 | 当前状态 | 进度 |
|---|---|---|---|
| Parser 补全 | 解析 checker 必需字段（频率4级、chronicity、laterality 等） | 已完成并通过现有测试 | 100% |
| Checker 核心 | IE/TX/纵向规则检查 + 评分输出 | 已完成并可产出报告 | 100% |
| Correction 生成 | 按错误生成修正项与重生成文本 | Node 侧可用，浏览器侧已隔离 | 90% |
| 前端真实链路 | PDF -> 提取文本 -> parse -> check -> 报告显示 | 已接通，替换 mock 完成 | 100% |
| 前端打包稳定性 | 清理 fs/path externalized 警告 | 已完成（构建无该警告） | 100% |
| 文档与日志 | 过程沉淀与可追溯记录 | 持续更新中 | 80% |

## 2. 已完成关键里程碑

1. 前端 `checker.js` 已从 mock 切换为真实流程。  
2. 新增 `pdf-extractor.js`，已接入 `pdfjs-dist`。  
3. `note-checker.ts` 已做浏览器/Node 分流，浏览器不拉入服务端纠正链。  
4. 前端构建通过，根测试通过（9 suites / 47 tests）。  
5. 过程日志已更新到 `comprehensive-check-latest.md`。  

## 3. 接下来步骤（执行顺序）

### Step A：前端报告面板升级为“完整逻辑链视图”
- 目标：不仅显示 pain 趋势，还显示 tenderness / tightness / spasm / ROM / strength / frequency。
- 改动点：
  - `/Users/ping/Desktop/Code/2_8/templete/soap-system/frontend/src/components/ReportPanel.vue`
  - `/Users/ping/Desktop/Code/2_8/templete/soap-system/frontend/src/services/checker.js`（若需增加字段映射）
- 验收：
  - 可逐 visit 查看指标趋势箭头（↓/→/↑）与是否异常。
  - 错误定位可关联到对应 visit 与字段。

### Step B：纠正结果前端可视化（仅在可用环境启用）
- 目标：展示 `corrections`（若运行在 Node/API 场景），浏览器纯前端场景保持降级。
- 改动点：
  - 新增/扩展 `CorrectionPanel`（若你同意我继续加 UI）。
- 验收：
  - 有 corrections 时可展开查看字段修正与整段文本。
  - 无 corrections 时不报错，显示降级提示。

### Step C：专项回归（多部位 + IE/TX链）
- 目标：抽样生成并检查常见部位（NECK/LBP/KNEE/SHOULDER/ELBOW）在 IE + 5TX 下链路稳定。
- 验收：
  - 不脱离模板字段边界。
  - S-O-A 变化一致，P 保持稳定规则不被破坏。
  - 无明显反逻辑（例如 improvement 但 pain 上升）。

### Step D：最终交付文档
- 目标：输出可交付的运行说明与限制说明（浏览器模式 vs Node 模式能力差异）。
- 验收：
  - 一份简明 README/MD，明确如何运行、如何看报告、当前限制。

## 4. 当前风险与注意事项

1. 纯浏览器模式下，`corrections` 目前默认空（为了避免引入服务端模板文件系统依赖）。  
2. 若要浏览器端也生成 corrections，需要把模板白名单读取改造为“可前端加载的数据源”（例如构建时产物 JSON）。  
3. 报告 UI 目前仍偏总览型，尚未完整展开每个指标链。  

## 5. 下一次提交建议范围

建议一次只做 Step A（报告面板逻辑链升级），完成后立即做一轮 build + 样例检查，避免 UI 与规则一起改导致定位困难。


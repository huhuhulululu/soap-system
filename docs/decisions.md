# Architecture Decision Records

> 按时间追加，永不删除。每条记录一个技术决策及其理由。

---

## v1.0 Production Hardening (2026-02-22)

| # | 决策 | 理由 |
|---|------|------|
| D01 | Express 5 + Vue 3 + Playwright 技术栈 | 前后端统一 TS，Playwright 满足 MDLand 自动化需求 |
| D02 | 文件存储 + LRU 缓存，不用数据库 | 当前规模不需要 PostgreSQL/Redis |
| D03 | Docker Compose 部署 Oracle Cloud | 单服务器足够，成本最低 |
| D04 | 不为 API-key 客户端豁免 CSRF | 简化安全模型 |
| D05 | Magic bytes 校验放在路由 handler 而非 fileFilter | multer fileFilter 阶段 buffer 不可用 |
| D06 | validateEnv 仅在 require.main 执行 | 测试不受环境变量影响 |

## v1.1 Automation Stability (2026-02-22)

| # | 决策 | 理由 |
|---|------|------|
| D07 | 错误分类先于重试逻辑 | `isPermanentError` 门控 `withRetry`，避免无意义重试 |
| D08 | 重试在子进程而非父进程 | 浏览器上下文在子进程中 |
| D09 | NDJSON 复用 stdout 管道 | `startsWith` 守卫处理混合输出 |
| D10 | TIMEOUTS 模块加载时预乘 | 避免每次调用都乘 TIMEOUT_MULTIPLIER |
| D11 | unknown errorKind 视为可重试 | 重试比跳过更安全 |

## v1.2 Batch Logic (2026-02-22)

| # | 决策 | 理由 |
|---|------|------|
| D12 | parseIncludeIE: continue=false, 其余=true | soap-only 需要 IE 做 ICD 校验 |
| D13 | IE CPT 按模式分流: full 加 99203, soap-only 跳过 | soap-only 的 IE 是结构性的，不计费 |

## v1.3 Form UX & Shared Data (2026-02-23)

| # | 决策 | 理由 |
|---|------|------|
| D14 | ICDCatalogEntry 适配器 code→icd10, name→desc | 后端字段不变 |
| D15 | CPT helpers 委托 getDefaultTXCPT/getDefaultIECPT | 不复制数据 |
| D16 | 新患者不设默认 gender/laterality | 强制显式选择 |
| D17 | clearFieldError 接入 updateField | 输入时自动清除错误 |

## v1.4 Fixture Snapshots & Parity (2026-02-23)

| # | 决策 | 理由 |
|---|------|------|
| D18 | HIP 替换为 SHOULDER-bilateral | HIP 不在 SUPPORTED_TX_BODY_PARTS |
| D19 | 标准 tightness 公式: painCurrent >= 7 ? 3 : 2 | 匹配 batch 基线 |
| D20 | normalizeGenerationContext() 作为唯一上下文入口 | 从构造层面消除 batch/compose 分歧 |
| D21 | Parity seeds 200001-200009 与 fixture seeds 100001-100030 分离 | 避免碰撞 |

## v1.5 Engine & UX Completion (2026-02-23)

| # | 决策 | 理由 |
|---|------|------|
| D22 | CHRONIC_END_RATIO = 0.55 | 慢性疼痛 LT 目标 30-50% 改善，非 75% |
| D23 | 慢性阻尼阈值: txCount >= 16, factor 0.82 | 循环前乘法阻尼 |
| D24 | ASS-01 whatChanged 证据优先级: frequency > ADL > objective > pain fallback | 选择最有说服力的改善证据 |
| D25 | ASS-02 present/patientChange 门控: cumulativePainDrop >= 3.0 + progress >= 0.5, 或 visit painDelta >= 0.7 | 避免过早使用强评估语言 |
| D26 | ASS-03 ADL 轮换选项限定 TX_WHAT_CHANGED_OPTIONS | 不生成模板外语句 |
| D27 | UX-01 ICD 下拉: bodyPart 为空时显示全部; selectIcd 自动填充 bodyPart + laterality | 减少手动操作 |
| D28 | UX-02 Pain score select 宽度 w-[60px] | 匹配实际字符宽度 |
| D29 | UX-03 ICD chips 在搜索框右侧 inline 显示 (flex row) | 节省垂直空间 |
| D30 | SEED-01 Batch API 接受可选 per-patient seed | 确定性重放 |
| D31 | PLAT-01 连续 3+ visit 相同 pain label 时注入 0.3-0.5 微改善 | 打破停滞 |
| D32 | GATE-01 Medicare visit 12 标注 NCD 30.3.3 累积改善证据 | 合规要求，仅标注不改曲线 |

## v2.0 Goal-Driven TX Sequence Engine (2026-02-24)

| # | 决策 | 理由 |
|---|------|------|
| D33 | 从 progress-threshold 架构迁移到 goal-driven 架构 | 当前阈值不感知 txCount，导致 txCount=20 时 5/19 SAME visits，txCount=16 时 5/15 SAME；变化集中在少数 visit（一次变 3-4 个维度），其他 visit 完全不变 |
| D34 | 各维度变化路径以 ST/LT Goal 为终点，按 txCount 均匀分配降级时机 | 不同 txCount 自适应：8 visits 变化密集，20 visits 变化均匀；各维度总降幅不同，降级时机天然错开 |
| D35 | 后期 floor 附近允许微波动（±1 级） | 维度到 floor 后完全停滞不合临床现实；恢复非线性，有好有坏是正常的 |
| D36 | plateau 条件从 painSame 改为 progress stagnant | painSame 过于激进（13/19 visits 被压制），progress 停滞才是真正的平台期 |
| D37 | ROM/Strength 保持 pain-based 计算 + romAdj/bumpStrength，不改为 goal-driven | ROM 度数和 Strength 档位受 pain 和 difficulty 影响，goal-driven 只控制 romTrend/strengthTrend 的释放时机 |
| D38 | rng() 新增调用追加在循环末尾，接受 30 fixture snapshot 全量重生成 | PRNG 序列稳定性约束；offset 和 bounce 各需要少量 rng 调用 |
| D39 | Strength 选项去掉 5/5，最高 4+/5 | MDLand 模板实际无 5/5 选项 |

### 待确认问题（实现前必须回答）

1. ST/LT 分界点：txCount=20 时前 12 是 ST 后 8 是 LT？还是按 60/40 比例？
2. Frequency 的 ST/LT Goal 值（当前 computePatchedGoals 未定义 freq goal）
3. 微波动是否允许暂时回升（如 tender +1→+2→+1）？还是只在 floor 和 floor+1 交替？
4. Chronic vs Non-Chronic：差异完全由 goals 体现，还是保留 chronicDampener？
5. Bilateral 左右不对称：goal 路径是否也分左右？

## 排除决策

| 特性 | 排除理由 |
|------|---------|
| Fuse.js 模糊 ICD 搜索 | 80 条目不值得引入 |
| LLM 生成 Assessment 文本 | 不确定性，破坏可重现性，合规风险 |
| json-rules-engine 做 phase gate | 45KB 处理 3 个阈值检查，过重 |
| 多阶段恢复曲线 (acute/corrective/maintenance) | v1.5 复杂度不合理 |
| D3/Chart.js 曲线可视化 | 不在范围内 |

---

## Tier A + Tier B step 1 Refactor (2026-04-19)

架构诊断 + 重构。详见 `docs/archive/tier-b-step-1-refactor-2026-04-19/`。

| # | 决策 | 理由 |
|---|------|------|
| D30 | `generateTXSequenceStates` 按 6 阶段拆为 sub-engines/stages/*.ts | 1010 LOC 单函数维护困难；切分后主体 105 LOC |
| D31 | Stage 4 内部再分 4a (numeric) + 4b (grading text)，绕过 Stage 3 narrative | 原代码 Stage 3 narrative 插入在 Stage 4 中间；必须保留这个交错顺序以维持 PRNG 序列字节等价 |
| D32 | 透传主 rng 而非 sub-seed 替换（Tier B step 1） | 切换 sub-seed 会彻底改变 PRNG 流 → 必须 rebaseline 30 snapshot。选择保守路径：结构先拆，PRNG 流切分留给 step 2 |
| D33 | 所有 helpers 移到 `sub-engines/shared-helpers.ts` | 避免 tx-sequence-engine ↔ stages 循环导入；helpers 是纯函数，单独模块更清晰 |
| D34 | `objectiveMuscleSeed` 迁至 `src/shared/muscle-seed.ts` | 断开 tx-sequence-engine ↔ soap-generator 双向循环 |
| D35 | BODY_PART_NAMES / SUPPORTED_IE/TX_BODY_PARTS / BODY_PART_AREA_NAMES 移至 `src/shared/body-part-constants.ts` | 单一真相源；soap-generator re-export 保对外兼容 |
| D36 | auditor/layer1 顶层 fs.readFileSync → 懒加载 + `path.join(__dirname, ..)` | cwd-relative 路径导致 Docker / worker thread / 任意 cwd 启动崩溃 |
| D37 | pdfjs worker 用 Vite `import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'` | Vite 打包资产自动同步 version，无版本漂移；base `/ac/` 路径自动处理 |
| D38 | CSP 移除 `https://cdn.jsdelivr.net` 完全 | 医疗工具供应链风险不可接受；self-host 覆盖所有场景 |
| D39 | A1 canonicalize macOS `* 2.*` 用 4-option 决策（A keep-original / B promote-duplicate / C merge / D delete-both） | 9 个孤立 `* 2.*` 无对应原件；2 对内容差异；粗暴 rm 会丢失 tracked 内容 |
| D40 | fast-check property tests 入选 Tier B step 1 | 为 sub-engine refactor 提供行为不变量安全网；250+ randomised runs |
| D41 | `.claude-state/` 加入 gitignore | 本地任务状态不入库；本次重构产物归档到 `docs/archive/` |

### 未采纳

| 方案 | 拒绝理由 |
|------|---------|
| sub-seed 运行时替换（AC-B3 激进解读） | 会改变 PRNG 流 → 30 snapshot 必须 rebaseline + 16 样本 human review；选择 step 2 再做以降低单次 PR 的 review 负担 |
| 主函数小幅修改保守切分 | 收益不足：难以达到 AC-B1 ≤300 LOC 目标 |
| 用 CCG（Claude + Codex + Gemini）做 state flow mapping | 1340 行代码深度阅读，Opus architect 一次通过足够；多模型只在有分歧时启动 |

# 前端功能全面测试计划

## 前端功能架构

```
前端 (Vue 3)
├── 视图 (Views)
│   ├── CheckerView - PDF 上传检查
│   ├── ContinueView - 续写生成
│   └── HistoryView - 历史记录
├── 服务 (Services)
│   ├── generator.js - 续写生成核心
│   ├── checker.js - 文档检查
│   ├── normalizer.js - 数据标准化
│   ├── exporter.js - 导出功能
│   └── pdf-extractor.js - PDF 提取
├── 组件 (Components)
│   ├── FileUploader - 文件上传
│   ├── ReportPanel - 报告展示
│   ├── TrendChart - 趋势图表
│   └── CorrectionCard - 修正卡片
└── 状态 (Stores)
    └── files.js - 文件状态管理
```

## 测试矩阵

### 1. 续写功能 (ContinueView + generator.js) - 40 用例

#### 1.1 输入解析 (10 用例)
| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| GEN-01 | 标准 IE 带冒号 | `Subjective: IE...` | 成功解析 |
| GEN-02 | IE 无冒号 | `Subjective\nIE...` | 成功解析 |
| GEN-03 | IE + 3 TX | 完整文档 | 识别 3 个已有 TX |
| GEN-04 | 空输入 | `""` | 错误提示 |
| GEN-05 | 无 IE | 只有 TX | 错误: 未找到初诊 |
| GEN-06 | 无 header | 缺少患者信息 | 自动注入假 header |
| GEN-07 | 大小写混合 | `SUBJECTIVE` | 成功解析 |
| GEN-08 | PDF 噪音 | 断词文本 | 成功解析 |
| GEN-09 | 11 个 TX | 已满 | 错误: 已达上限 |
| GEN-10 | 部分缺失 | 无 Assessment | 警告但继续 |

#### 1.2 部位识别 (6 用例)
| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| GEN-11 | KNEE | `right Knee` | bodyPart=KNEE |
| GEN-12 | SHOULDER | `left Shoulder` | bodyPart=SHOULDER |
| GEN-13 | ELBOW | `right Elbow` | bodyPart=ELBOW |
| GEN-14 | NECK | `cervical` | bodyPart=NECK |
| GEN-15 | LBP | `lumbar` | bodyPart=LBP |
| GEN-16 | 不支持部位 | `Hip` | 错误提示 |

#### 1.3 保险类型 (6 用例)
| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| GEN-17 | OPTUM | insuranceType=OPTUM | CPT 97810/97811 |
| GEN-18 | HF | insuranceType=HF | CPT 97810/97811 |
| GEN-19 | WC | insuranceType=WC | CPT 97813/97814 |
| GEN-20 | VC | insuranceType=VC | CPT 97813/97814 |
| GEN-21 | ELDERPLAN | insuranceType=ELDERPLAN | CPT 97813/97814 |
| GEN-22 | Pacemaker | hasPacemaker=true | 强制 97810 |

#### 1.4 治疗时间 (4 用例)
| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| GEN-23 | 15 分钟 | treatmentTime=15 | 1 个 CPT |
| GEN-24 | 30 分钟 | treatmentTime=30 | 2 个 CPT |
| GEN-25 | 45 分钟 | treatmentTime=45 | 3 个 CPT |
| GEN-26 | 60 分钟 | treatmentTime=60 | 4 个 CPT |

#### 1.5 生成数量 (6 用例)
| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| GEN-27 | 生成 1 个 | generateCount=1 | 1 个 TX |
| GEN-28 | 生成 5 个 | generateCount=5 | 5 个 TX |
| GEN-29 | 生成 11 个 | generateCount=11 | 11 个 TX |
| GEN-30 | 已有 5 个生成 6 | existing=5, gen=6 | 6 个 TX |
| GEN-31 | 已有 10 个生成 5 | existing=10, gen=5 | 1 个 TX (上限) |
| GEN-32 | 只解析不生成 | generateCount=0 | 0 个 TX, 有 summary |

#### 1.6 纵向逻辑 (8 用例)
| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| GEN-33 | Pain 下降 | IE pain=8 | TX1 pain ≤ 8 |
| GEN-34 | Pain 序列 | 生成 5 TX | pain 单调不增 |
| GEN-35 | Tightness 改善 | IE severe | TX 逐渐 moderate→mild |
| GEN-36 | Tenderness 改善 | IE +3 | TX 逐渐 +2→+1 |
| GEN-37 | Condition 改善 | IE poor | TX 逐渐 fair→good |
| GEN-38 | 短期目标 | 12 TX | 达到短期目标 |
| GEN-39 | 长期目标 | 20 TX | 达到长期目标 |
| GEN-40 | 从已有 TX 继续 | 已有 TX pain=6 | 新 TX pain ≤ 6 |

### 2. 检查功能 (CheckerView + checker.js) - 20 用例

#### 2.1 文件上传 (5 用例)
| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| CHK-01 | 单个 PDF | 1 个文件 | 成功处理 |
| CHK-02 | 多个 PDF | 5 个文件 | 批量处理 |
| CHK-03 | 非 PDF | .txt 文件 | 错误提示 |
| CHK-04 | 空 PDF | 0 字节 | 错误提示 |
| CHK-05 | 大 PDF | >10MB | 处理或提示 |

#### 2.2 报告生成 (8 用例)
| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| CHK-06 | 完美文档 | 无错误 | 100 分 |
| CHK-07 | 有错误 | 3 个错误 | 扣分 |
| CHK-08 | 严重错误 | critical | 大幅扣分 |
| CHK-09 | 时间线 | 5 个 visit | 正确时间线 |
| CHK-10 | 趋势分析 | pain 下降 | improving |
| CHK-11 | 趋势分析 | pain 上升 | worsening |
| CHK-12 | 修正建议 | 有错误 | 提供修正 |
| CHK-13 | 患者信息 | 完整 header | 正确显示 |

#### 2.3 错误检测 (7 用例)
| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| CHK-14 | Pain 反弹 | TX2 > TX1 | 检测到 |
| CHK-15 | 格式错误 | 缺少字段 | 检测到 |
| CHK-16 | 逻辑矛盾 | improvement + pain↑ | 检测到 |
| CHK-17 | Pacemaker + estim | 禁忌组合 | 检测到 |
| CHK-18 | 超出范围 | pain=11 | 检测到 |
| CHK-19 | 日期错误 | TX 早于 IE | 检测到 |
| CHK-20 | 重复 visit | 相同日期 | 检测到 |

### 3. 导出功能 (exporter.js) - 8 用例

| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| EXP-01 | 复制单个 TX | 点击复制 | 剪贴板有内容 |
| EXP-02 | 复制全部 | 点击全部复制 | 所有 TX |
| EXP-03 | 导出 JSON | 导出按钮 | 有效 JSON |
| EXP-04 | 导出 CSV | 导出按钮 | 有效 CSV |
| EXP-05 | 批量导出 | 多文件 | ZIP 包 |
| EXP-06 | 文件名 | 导出 | 包含患者名 |
| EXP-07 | 编码 | 中文内容 | UTF-8 正确 |
| EXP-08 | 空结果 | 无数据 | 提示无内容 |

### 4. UI 交互 (Components) - 12 用例

| ID | 场景 | 操作 | 期望 |
|----|------|------|------|
| UI-01 | 文件拖放 | 拖入 PDF | 添加到列表 |
| UI-02 | 文件选择 | 点击选择 | 打开对话框 |
| UI-03 | 删除文件 | 点击删除 | 从列表移除 |
| UI-04 | 清空全部 | 点击清空 | 列表为空 |
| UI-05 | 键盘导航 | ↑↓ 键 | 切换文件 |
| UI-06 | 加载状态 | 处理中 | 显示 spinner |
| UI-07 | 错误提示 | 解析失败 | 显示错误 |
| UI-08 | 成功提示 | 复制成功 | 显示提示 |
| UI-09 | 参数切换 | 改保险类型 | 重新解析 |
| UI-10 | 响应式 | 窄屏 | 正确布局 |
| UI-11 | 趋势图表 | 有数据 | 正确渲染 |
| UI-12 | 空状态 | 无文件 | 显示上传提示 |

### 5. 状态管理 (stores/files.js) - 5 用例

| ID | 场景 | 操作 | 期望 |
|----|------|------|------|
| STO-01 | 添加文件 | addFiles | 状态更新 |
| STO-02 | 选择文件 | selectFile | selectedFile 更新 |
| STO-03 | 处理文件 | processAllFiles | 结果存储 |
| STO-04 | 统计计算 | 多文件 | stats 正确 |
| STO-05 | 持久化 | 刷新页面 | 状态保持 |

### 6. 边界和异常 (5 用例)

| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| ERR-01 | 网络断开 | 离线 | 本地功能正常 |
| ERR-02 | 内存不足 | 大量文件 | 优雅降级 |
| ERR-03 | 并发处理 | 快速操作 | 无竞态 |
| ERR-04 | 特殊字符 | 文件名含特殊字符 | 正确处理 |
| ERR-05 | 长文本 | 超长笔记 | 正确处理 |

## 总计

| 模块 | 用例数 |
|------|--------|
| 续写功能 | 40 |
| 检查功能 | 20 |
| 导出功能 | 8 |
| UI 交互 | 12 |
| 状态管理 | 5 |
| 边界异常 | 5 |
| **总计** | **90** |

## 实施优先级

### P0 - 核心功能 (必须)
- GEN-01~10: 输入解析
- GEN-33~40: 纵向逻辑
- CHK-06~13: 报告生成

### P1 - 重要功能 (应该)
- GEN-11~16: 部位识别
- GEN-17~26: 保险/时间
- CHK-14~20: 错误检测

### P2 - 辅助功能 (可以)
- EXP-01~08: 导出功能
- UI-01~12: UI 交互
- STO-01~05: 状态管理
- ERR-01~05: 边界异常

## 测试文件结构

```
tests/
├── unit/
│   └── frontend/
│       ├── generator.spec.ts      # GEN-01~40
│       ├── checker.spec.ts        # CHK-01~20
│       └── exporter.spec.ts       # EXP-01~08
├── integration/
│   ├── continuation-flow.test.ts  # 已有 8 用例
│   └── checker-flow.test.ts       # CHK 集成
└── e2e/
    └── ui-interaction.test.ts     # UI-01~12 (Playwright)
```

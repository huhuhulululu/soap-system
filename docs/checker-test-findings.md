# Checker 测试发现的问题清单

> 测试日期: 2026-02-12
> 测试范围: 270 tests across 10 files (Phase 1-4)
> 最终结果: 全部通过

## CRITICAL — Generator 产出"完美"文档实际 110 个错误

### 1. ICD 编码不感知侧性 (DX04)
- **现象**: generator 写死 `M54.5`，bilateral 患者 checker 期望后缀 `3`/`93`
- **影响**: 12 个 visit 全部触发 CRITICAL
- **修复**: 改用 `base + LAT_SUFFIX[laterality]` 动态拼接 ICD 编码

### 2. 肌肉名称不匹配 (O8)
- **现象**: generator 用 `Erector Spinae`，checker 关键词是 `iliocostalis`/`multifidus` 等
- **影响**: 36 个 CRITICAL 错误（每 visit 3 块肌肉 × 12 visits）
- **修复**: BODY_PART_MUSCLES 全部替换为 checker 关键词匹配的名称

### 3. ROM 度数公式错误 (O1)
- **现象**: generator 用简单百分比，checker 用分段 limitFactor
- **公式**: `pain≥8→0.77, ≥6→0.85, ≥3→0.95, else→1.0`
- **影响**: 24 个错误
- **修复**: 重写 `romDegrees()` 使用 checker 的 limitFactor 公式

### 4. 针具号数无效 (P1)
- **现象**: LBP 用了 36# 针，checker 只允许 `[30, 34]`
- **影响**: 12 个 CRITICAL
- **修复**: BODY_PART_NEEDLE 按 checker 的 validGauges 更新

### 5. ADL 文本缺少部位关键词 (S3)
- **现象**: 通用文本没有 `bending forward`/`walking` 等 checker 期望的关键词
- **影响**: 12 个错误
- **修复**: 新增 ADL_BY_BODY_PART 按部位生成含关键词的文本

## HIGH — 注入机制指向错误字段

### 6. IE01/TX01 注入改 `adlDifficultyLevel` 而非文本
- **现象**: checker 通过 `parseAdlSeverity()` 从 `adlImpairment` 文本提取严重度，不读枚举字段
- **影响**: 注入无效，测试无法触发目标规则
- **修复**: 注入改为修改 `adlImpairment` 文本内容

### 7. TX03 注入逻辑完全反转
- **现象**: 注入设 `symptomChange='exacerbate'`，但 checker 检查的是 `improvement` + 疼痛上升 (delta > 0)
- **影响**: 注入无效
- **修复**: 改为设 `symptomChange='improvement'` 并增加当前疼痛值

### 8. T06 注入改 assessment 字段
- **现象**: checker 从 `chiefComplaint` 读取（通过 `parseProgressStatus` + `extractProgressReasons`）
- **影响**: 注入无效
- **修复**: 注入改为修改 `chiefComplaint` 文本

### 9. T08 注入改 `adlDifficultyLevel`
- **现象**: 同 IE01，checker 读文本不读枚举
- **影响**: 注入无效
- **修复**: 注入改为修改前后两个 visit 的 `adlImpairment` 文本

### 10. DX01 注入用了 LBP 自身的 ICD 编码
- **现象**: 注入 `M54.5` 给 LBP 文档，但 M54.5 本身就是 LBP 的合法编码
- **修复**: 改用 `M17.0`（KNEE 编码）制造不匹配

### 11. S2 注入用了兼容的疼痛类型
- **现象**: 注入 `['Dull']` 给 Qi Stagnation，但 Dull 本身就是 Qi Stagnation 的合法类型
- **修复**: 改用 `['Pricking']`（Blood Stasis 类型）

### 12. O9 注入改了 `rom.bodyPart` 而非 movement
- **现象**: checker 用 `bodyPartNormalized` + movement 名称校验，不读 `rom.bodyPart`
- **修复**: 改为添加 `Abduction` movement（LBP 不合法）

### 13. P1 注入用了合法针具号数
- **现象**: 注入 `30#` 给 LBP，但 30 是 LBP 的合法号数
- **修复**: 改用 `36#`（LBP/KNEE 不合法）

### 14. X3 注入在非 IE visit
- **现象**: X3 是 IE-only 检查（`if (isIE && ...)`），默认注入 visit 2 永远不触发
- **修复**: 强制注入到 visit 0（IE visit）

## MEDIUM — 边界值和目标约束

### 15. painStart=2 触发 IE05
- **现象**: 短期目标 `max(2-3, 2)=2` 等于当前疼痛，checker 要求严格小于
- **修复**: 短期目标改为 `max(pain-3, 1)`，长期目标改为 `max(st-2, 0)`

### 16. painStart=3 触发 IE06
- **现象**: 短期和长期目标都 clamp 到 1，checker 要求长期严格小于短期
- **修复**: 长期目标从短期目标推导，确保 lt < st < pain

### 17. KNEE Extension(0) 触发 O3
- **现象**: normal=0 的 ROM 项导致 severity 计算异常
- **修复**: 移除 KNEE Extension（normal=0 无意义）

## 核心结论

**checker 的数据读取路径和 generator 的数据写入路径严重不一致。**

checker 大量使用文本解析函数从自由文本字段提取信息：
- `parseAdlSeverity()` → 读 `adlImpairment` 文本
- `parseProgressStatus()` → 读 `chiefComplaint` 文本
- `extractProgressReasons()` → 读 `chiefComplaint` 文本

而 generator 最初按 TypeScript 类型定义写数据到结构化枚举字段，没有考虑 checker 的实际解析逻辑。这说明 checker 的设计是面向真实临床文档（文本为主），类型定义中的枚举字段更多是 UI 层使用的。

**建议**: 后续如果修改 checker 规则或新增字段，应同步更新 generator 和测试，确保数据流路径一致。

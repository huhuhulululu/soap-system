# SOAP System 测试套件

## 测试结构

```
tests/
├── unit/                          # 单元测试
│   ├── weight-system.spec.ts      # 权重系统测试
│   ├── rule-engine.spec.ts        # 规则引擎测试
│   ├── soap-generator.spec.ts     # SOAP 生成器测试
│   ├── tx-sequence-engine.spec.ts # TX 序列引擎测试
│   ├── soap-validator.spec.ts     # SOAP 验证器测试
│   ├── optum-parser.spec.ts       # Optum Note 解析器测试
│   └── document-checker.spec.ts   # 文档校验器测试
├── e2e/                           # 端到端测试
│   ├── full-system.spec.ts        # 全系统集成测试
│   └── helpers/
│       └── pdf-mock.ts            # PDF 提取辅助
```

## 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行端到端测试
npm run test:e2e

# 运行所有测试（包括 __tests__ 目录）
npm run test:all

# 监视模式
npm run test:watch

# 覆盖率报告
npm run test:coverage
```

## 测试覆盖模块

### 1. Optum Note Parser (`parsers/optum-note/`)
- PDF 文本解析
- Header 解析（患者信息、日期）
- Subjective 解析（主诉、疼痛、ADL）
- Objective 解析（肌肉测试、ROM、舌脉）
- Assessment 解析（TCM 诊断、证型）
- Plan 解析（针灸方案、穴位、目标）
- 诊断/手术代码解析

### 2. Document Checker (`parsers/optum-note/checker/`)
- 一致性规则检查
  - IE01: 疼痛-ADL 一致性
  - TX01: 疼痛趋势一致性
  - T02: 舌象-证型一致性
  - T03: 脉象-证型一致性
- 时间线构建
- 评分系统
- 纠错生成

### 3. Weight System (`src/parser/weight-system.ts`)
- 疼痛类型权重
- 严重程度权重
- 治疗原则权重
- 穴位权重
- 肌肉权重
- ADL 权重
- 电刺激权重
- 操作时间权重

### 4. Rule Engine (`src/parser/rule-engine.ts`)
- 规则应用
- 权重聚合
- 选项选择
- 报告生成

### 5. SOAP Generator (`src/generator/`)
- IE 病历生成
- TX 病历生成
- Subjective 生成
- Objective 生成
- Assessment 生成
- Plan 生成
- 针灸方案生成
- 文本导出

### 6. TX Sequence Engine (`src/generator/tx-sequence-engine.ts`)
- TX 序列状态生成
- 疼痛趋势模拟
- 症状改善追踪
- 目标达成模拟

### 7. SOAP Validator (`src/validator/soap-validator.ts`)
- 必填字段验证
- 疼痛量表验证
- 目标验证
- 跨部分一致性验证
- 保险特定验证

## 测试素材

E2E 测试使用真实 Optum Note PDF 文件：
- 路径: `/Users/ping/Desktop/Processing/Optum note/`
- 包含多种身体部位（膝、肩、腰、颈等）
- 包含 IE 和 TX 访问记录
- 包含多种 TCM 证型

## 测试策略

1. **单元测试**: 测试各模块独立功能
2. **集成测试**: 测试模块间交互
3. **端到端测试**: 测试完整流程
4. **边界测试**: 测试极端情况（严重疼痛、起搏器等）
5. **回归测试**: 确保修改不破坏现有功能

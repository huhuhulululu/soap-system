# MDLand Batch Integration Plan v2

> soap-system 后端 API + Tampermonkey 批量自动化方案 (修订版)

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        soap-system (服务端)                          │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────────┐ │
│  │  Vue 前端     │    │  Express 后端     │    │  生成引擎 (已有)    │ │
│  │              │    │                  │    │                    │ │
│  │  WriterView  │    │  POST /api/batch │───►│  soap-generator.ts │ │
│  │  CheckerView │    │  GET  /api/batch │    │  tx-sequence-engine│ │
│  │  BatchView ★ │───►│  PUT  /api/visit │    │  weight-system     │ │
│  │              │    │  GET  /api/templ │◄───│  tcm-patterns      │ │
│  └──────────────┘    └────────┬─────────┘    └────────────────────┘ │
│                               │                                     │
└───────────────────────────────┼─────────────────────────────────────┘
                                │ fetch (CORS)
                                │
┌───────────────────────────────┼─────────────────────────────────────┐
│  MDLand (浏览器 - Tampermonkey)│                                     │
│                               ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  mdland-batch-soap.js (Tampermonkey 脚本)                    │    │
│  │                                                             │    │
│  │  复用: MDLand Core Modules (Config/Utils/State/UI/Excel)     │    │
│  │  复用: pt-auto-bill-v5 模式 (Navigator/processPatientGroup) │    │
│  │                                                             │    │
│  │  1. fetch /api/batch/{id} → 获取已确认批次 (SOAP+ICD+CPT)    │    │
│  │  2. processPatientGroup → executeVisitTask (逐visit执行)     │    │
│  │     a. 搜索患者 (DOB)                                        │    │
│  │     b. 打开 visit (按时间正序第N个)                           │    │
│  │     c. ICD/CPT → addSelectionD + letsGo(2) 保存             │    │
│  │     d. PT Note → TinyMCE setContent + reallySubmit() 保存   │    │
│  │     e. Checkout → Generate Billing                          │    │
│  │     f. 失败 → 标记 → 继续下一个 (不停止)                      │    │
│  │  3. UI 悬浮面板: 进度 + 日志 + 暂停/继续/重试                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.1 设计原则

1. **复用优先**: 最大化利用已有代码 (soap-generator, Core Modules, pt-auto-bill-v5 模式)
2. **韧性执行**: 仿 pt-auto-bill-v5 — 失败标记→继续→事后重试 (不是立刻停止)
3. **用户控制 ICD/CPT**: 用户在 Excel 中提供 ICD/CPT，确保准确性
4. **预览确认**: 自动生成 SOAP 后，用户在 BatchView 预览确认，再下发到 MDLand
5. **Text→HTML 转换**: 生成引擎输出纯文本，需转为 HTML 适配 TinyMCE

---

## 2. 用户操作流程

```
步骤 1: 下载 Excel 模板 (soap-system 提供)
步骤 2: 填入患者信息 (6列必填 + 4列选填)
步骤 3: 上传到 soap-system BatchView 页面
步骤 4: 系统自动生成全部 SOAP → 预览列表 (按患者分组)
步骤 5: 检查 SOAP 内容，可逐条编辑或重新生成 (ICD/CPT 原样展示)
步骤 6: 确认批次 → 系统保存 → 生成 batchId
步骤 7: 打开 MDLand → Tampermonkey 面板输入 batchId 或粘贴数据
步骤 8: 点击"开始" → 自动执行，看进度条
步骤 9: 完成 → 查看结果统计 → 可重试失败项
```

---

## 3. Excel 模板设计

### 3.1 模板列定义

| 列 | 字段名 | 必填 | 说明 | 示例 |
|----|--------|------|------|------|
| A | DOS | 是 | 同患者内 visit 顺序号 | 1, 2, 3, 4 |
| B | Patient | 是 | 姓名(DOB) | CHEN,AIJIN(09/27/1956) |
| C | Gender | 是 | 性别 | M / F |
| D | Insurance | 是 | 保险类型 | HF / OPTUM / WC / VC / ELDERPLAN / NONE |
| E | BodyPart | 是 | 主要身体部位 | LBP / NECK / SHOULDER / KNEE / ... |
| F | Laterality | 是 | 侧向 | B / L / R (bilateral/left/right) |
| G | NoteType | 是 | 笔记类型 | IE / TX / RE |
| H | ICD | 首行必填 | ICD-10 码 | M54.50,M54.41 (逗号分隔) |
| I | CPT | 可选 | CPT 码+单位，空则按保险自动推断 | 97810,97811x3,97140x2 (x后为units) |
| J | SecondaryParts | 否 | 次要部位 | NECK,SHOULDER (逗号分隔) |
| K | History | 否 | 病史 | HTN,DM,Pacemaker (逗号分隔) |

> **保险缩写对照**: HF=HealthFirst, OPTUM=Optum, WC=Wellcare, VC=Village Care Max, ELDERPLAN=Elderplan

### 3.2 示例数据

```
DOS | Patient                  | Gender | Ins   | Body  | Side | Type | ICD            | CPT                       | Secondary | History
1   | CHEN,AIJIN(09/27/1956)   | F      | HF    | LBP   | B    | IE   | M54.50,M54.41  | 97810,97811x3,97140       |           | HTN,DM
2   | CHEN,AIJIN(09/27/1956)   | F      | HF    | LBP   | B    | TX   |                |                           |           |
3   | CHEN,AIJIN(09/27/1956)   | F      | HF    | LBP   | B    | TX   |                |                           |           |
4   | CHEN,AIJIN(09/27/1956)   | F      | HF    | LBP   | B    | TX   |                |                           |           |
1   | WANG,MEI(03/15/1960)     | F      | OPTUM | SHLDR | L    | IE   | M75.12,M25.512 | 97810,97811x3,97161       | NECK      |
1   | LI,HUA(05/12/1948)       | M      | WC    | KNEE  | R    | TX   | M17.11         |                           |           | HTN
2   | LI,HUA(05/12/1948)       | M      | WC    | KNEE  | R    | TX   |                |                           |           |
```

> **CPT 自动推断**: LI,HUA 的 WC (Wellcare) TX 行 CPT 为空 → 自动填充 `97813x1,97814x2,97811x1`

### 3.3 ICD/CPT 继承规则

```
1. 同患者 (Name+DOB 相同) 的 visits，ICD 空则继承上一行的值
2. CPT 解析优先级:
   a. 用户填写了 CPT → 使用用户填写的值
   b. CPT 为空 + NoteType=TX → 按保险类型自动推断默认 CPT (见 3.4 保险→CPT 映射)
   c. CPT 为空 + NoteType=IE/RE → 提示用户填写 (IE/RE 可能包含 97161 等评估码)
   → 在 BatchView 预览时，用户可通过下拉框修改 CPT
3. 每个患者的第一行必须填写 ICD，否则报错
4. DOS 列为同患者内的 visit 顺序号 (1,2,3,4...)，不是真实日期
5. 脚本在 MDLand 执行时，按 Waiting Room 里该患者的 visits 时间正序匹配

示例:
  CHEN,AIJIN (HF):
    #1 IE   → ICD: M54.50,M54.41  CPT: 97810,97811x3,97140 (用户手工填写)
    #2 TX#1 → ICD: M54.50,M54.41  CPT: 97810 (自动推断: HF → 97810x1)
    #3 TX#2 → ICD: M54.50,M54.41  CPT: 97810 (自动推断)
    #4 TX#3 → ICD: M54.50,M54.41  CPT: 97810 (自动推断)

  LI,HUA (WC/Wellcare):
    #1 TX#1 → ICD: M17.11  CPT: 97813x1,97814x2,97811x1 (自动推断: WC → full code)
    #2 TX#2 → ICD: M17.11  CPT: 97813x1,97814x2,97811x1 (自动推断)
```

### 3.4 保险 → CPT 默认映射

```
TX (治疗) 的默认 CPT (按保险自动推断):

| 保险              | 缩写 | 默认 CPT                           | 电刺激 | 总时间 |
|-------------------|------|------------------------------------|--------|--------|
| HealthFirst       | HF   | 97810 ×1                           | 无     | 15 min |
| Optum             | OPTUM| 97810 ×1                           | 无     | 15 min |
| Wellcare          | WC   | 97813 ×1 + 97814 ×2 + 97811 ×1    | 有     | 60 min |
| Village Care Max  | VC   | 97813 ×1 + 97814 ×1 + 97811 ×2    | 有     | 60 min |
| Elderplan         | ELDERPLAN | 97810 ×1                           | 无     | 15 min |
| 无保险            | NONE | 97810 ×1                           | 无     | 15 min |

CPT 代码说明:
  97810 — 针灸无电刺激，首个 15 min
  97811 — 针灸无电刺激，每加 15 min
  97813 — 针灸有电刺激，首个 15 min
  97814 — 针灸有电刺激，每加 15 min

IE/RE 需用户手工填写 (可能包含 97161/97162/97163 评估码等)
BatchView 预览时支持下拉框修改 CPT 组合
```

### 3.5 TX 序号自动推算规则

```
1. 按 Patient (Name+DOB) 分组
2. 同患者的 visits 按 DOS 顺序号排列
3. IE/RE 不占 TX 编号
4. TX 按出现顺序自动编号: TX#1, TX#2, TX#3...
5. 生成引擎根据 TX# 调用 generateTXSequenceStates() 一次性生成:
   - TX#1: 症状较重, ROM 受限大, 疼痛 7-8/10
   - TX#2-3: 逐步改善
   - TX#4+: 明显好转, ROM 接近正常
6. IE 使用 exportSOAPAsText(context, {}) 单独生成
7. RE (Re-evaluation) 使用 exportSOAPAsText(reContext, {}) 生成
   - RE 与 IE 类似，但侧重复评进展 (progress since initial eval)
   - RE 的 GenerationContext.noteType = 'RE'
   - RE 的 CPT 由用户手工填写 (可能包含 97161-97163 评估码)

示例:
  CHEN,AIJIN (4 visits):
    #1 IE   → exportSOAPAsText(ieContext)
    #2 TX#1 → generateTXSequenceStates(txContext, {txCount:3})[0]
    #3 TX#2 → generateTXSequenceStates(txContext, {txCount:3})[1]
    #4 TX#3 → generateTXSequenceStates(txContext, {txCount:3})[2]
```

### 3.6 性别处理

```
Excel 模板 Gender 列: M (Male) / F (Female)，必填
后端根据 Gender 设置 GenerationContext.gender = 'Male' | 'Female'
影响: SOAP 内容中的代词 (he/she, his/her)，以及部分中医证型描述
```

---

## 4. 后端 API 设计

### 4.1 技术选型

- Runtime: Node.js + Express
- 语言: TypeScript (直接 import 现有 src/ 生成引擎代码)
- 数据存储: 内存 + JSON 文件 (轻量，不需要数据库)
- 端口: 3001 (前端 dev 5173, 生产 nginx 9090 统一代理)
- 依赖: `xlsx` (Excel 解析), `multer` (文件上传), `cors`

### 4.2 API 端点

#### `GET /api/template`

下载 Excel 模板文件 (.xlsx)。

#### `POST /api/batch`

上传 Excel → 解析 → 生成全部 SOAP → 返回批次数据。

```json
Request: multipart/form-data (Excel file)

Response:
{
  "batchId": "batch_20260217_143022",
  "createdAt": "2026-02-17T14:30:22Z",
  "patients": [
    {
      "name": "CHEN, AIJIN",
      "dob": "09/27/1956",
      "age": 69,
      "gender": "Female",
      "insurance": "HF",
      "visits": [
        {
          "index": 0,
          "dos": 1,
          "noteType": "IE",
          "txNumber": null,
          "bodyPart": "LBP",
          "laterality": "bilateral",
          "secondaryParts": [],
          "history": ["HTN", "DM"],
          "icdCodes": [
            { "code": "M54.50", "name": "Low back pain, unspecified" }
          ],
          "cptCodes": [
            { "code": "97810", "name": "ACUP 1/> WO ESTIM 1ST 15 MIN", "units": 1 },
            { "code": "97811", "name": "ACUP 1/> W/O ESTIM EA ADD 15", "units": 3 },
            { "code": "97140", "name": "MANUAL THERAPY 1/> REGIONS", "units": 1 }
          ],
          "generated": {
            "soap": {
              "subjective": "<p>Patient presents for initial evaluation...</p>",
              "objective": "<p>ROM: Lumbar flexion 60&deg;/90&deg;...</p>",
              "assessment": "<p>TCM Diagnosis: Qi Stagnation...</p>",
              "plan": "<p>Acupuncture 2x/week for 4 weeks...</p>"
            },
            "fullText": "Subjective\nPatient presents for...",
            "seed": 42
          },
          "status": "pending"
        }
      ]
    }
  ],
  "summary": {
    "totalPatients": 4,
    "totalVisits": 12,
    "byType": { "IE": 2, "TX": 10 }
  }
}
```

#### `PUT /api/batch/:batchId/visit/:patientIndex/:visitIndex`

更新单个 visit (编辑 SOAP 或重新生成)。

```json
Request:
{
  "action": "regenerate",    // 或 "update"
  "soap": { ... },           // action=update 时提供修改后的 SOAP HTML
  "seed": 123                // action=regenerate 时可指定 seed
}

Response: 更新后的 visit 对象
```

#### `POST /api/batch/:batchId/confirm`

确认批次，标记为可执行。Tampermonkey 脚本只能拉取已确认的批次。

#### `GET /api/batch/:batchId`

获取已确认批次的完整数据 (Tampermonkey 脚本调用)。

### 4.3 Text→HTML 转换层

生成引擎 `exportSOAPAsText()` 输出纯文本 (以 `\n` 分行)，但 TinyMCE 需要 HTML。

```typescript
function textToHTML(text: string): string {
  // 1. 将文本按 section 拆分 (Subjective/Objective/Assessment/Plan)
  // 2. 每个段落用 <p> 包裹
  // 3. 列表项 (- xxx) 转为 <br> 分隔的内联列表或保持为段落
  // 4. 数字/度数保持原样
  // 5. 不加多余格式 (bold/italic)，保持简洁

  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => `<p>${escapeHTML(line)}</p>`)
    .join('')
}

function splitSOAPText(fullText: string): { S: string; O: string; A: string; P: string } {
  // 复用前端 useSOAPGeneration.ts 中的 splitSOAP 逻辑
  // 按 "Subjective\n", "Objective\n", "Assessment\n", "Plan\n" 分割
}
```

### 4.4 ICD Code→Name 映射

用户在 Excel 中只提供 ICD code (如 M54.50)。
MDLand 的 `addSelectionD(name, code)` 需要 name 参数。

```
方案 1 (推荐): 维护 ICD-10 常用码映射表
  - soap-system 已有 ICD_BODY_MAP，可扩展
  - 覆盖针灸科常用的 ~200 个 ICD 码
  - 未匹配的码使用 code 本身作为 name (MDLand 也能接受)

方案 2: 调用 MDLand 的搜索 API
  - addSelectionD 可以直接接受 code 作为 name
  - MDLand 内部会解析
  - 风险: 如果 MDLand 要求精确 name 则可能失败

方案 3: 后端维护完整 ICD-10 数据库
  - 过于重量级，不推荐
```

### 4.5 项目结构变更

```
soap-system/
├── src/                        # 现有: 生成引擎、解析器、验证器
│   ├── generator/
│   │   ├── soap-generator.ts   # exportSOAPAsText, exportTXSeriesAsText
│   │   └── tx-sequence-engine.ts
│   ├── parser/
│   ├── shared/
│   │   ├── body-part-constants.ts  # ICD_BODY_MAP (可扩展)
│   │   └── icd-catalog.ts          # ★ 新增: ICD code→name 映射表
│   └── types/
├── server/                     # ★ 新增: 后端服务
│   ├── index.ts                # Express 入口
│   ├── routes/
│   │   └── batch.ts            # /api/batch, /api/template 路由
│   ├── services/
│   │   ├── batch-generator.ts  # 批量生成逻辑 (调用 soap-generator)
│   │   ├── excel-parser.ts     # Excel 解析 + 患者分组 + TX 编号
│   │   └── text-to-html.ts     # Text→HTML 转换
│   └── store/
│       └── batch-store.ts      # 批次数据存储 (内存 + JSON 文件)
├── frontend/                   # 现有: Vue 前端
│   └── src/views/
│       ├── WriterView.vue      # 现有
│       ├── CheckerView.vue     # 现有
│       └── BatchView.vue       # ★ 新增: 批量操作界面
├── scripts/                    # ★ 新增: Tampermonkey 脚本
│   └── mdland-batch-soap.js    # MDLand SOAP 批量填入脚本
├── templates/                  # ★ 新增
│   └── batch-template.xlsx     # Excel 模板
└── docker-compose.yml          # 更新: 加入后端服务
```

---

## 5. Tampermonkey 脚本设计

### 5.1 整体架构 (复用 pt-auto-bill-v5 模式)

```javascript
// @require  mdland-core-config.js
// @require  mdland-core-utils.js
// @require  mdland-core-state.js
// @require  mdland-core-ui.js

// 脚本结构 (仿 pt-auto-bill-v5):
//
// 1. Navigator   — 页面导航 (复用 + 扩展)
//    ├── clickWaitingRoom()      ← 复用
//    ├── clickOnePatient()       ← 复用
//    ├── searchPatient(dob)      ← 复用
//    ├── selectPatient(name,dob) ← 复用
//    ├── openVisitByIndex(n)     ← ★ 新增: 按时间顺序第N个visit
//    ├── navigateToICD()         ← ★ 新增: 点击 ICD/CPT 菜单
//    ├── navigateToPTNote()      ← ★ 新增: 点击 PT Note 菜单
//    └── navigateToCheckout()    ← ★ 新增: 点击 Checkout 菜单
//
// 2. ICDFiller   — ICD 填充 ★ 新增
//    ├── addICDCodes([{code, name}])  // 优先从备选列表选取，否则 addSelectionD
//    └── saveICD()
//
// 3. CPTFiller   — CPT 填充 ★ 新增
//    ├── addCPTCodes([{code, units, name}])  // 优先从备选列表选取，否则 addSelectionD_cpt
//    ├── setUnits(cptIndex, units)    // 始终显式设置，不依赖默认值
//    └── saveCPT()
//
// 4. SOAPFiller  — SOAP 填充 ★ 新增
//    ├── fillSOAP({S, O, A, P})    // TinyMCE setContent
//    └── saveSOAP()                // reallySubmit() → AJAX POST, 无重载
//
// 5. Biller      — Billing ★ 新增
//    └── generateBilling()         // checkOutOV(2) → doCheckOut → letsGo(2)
//
// 6. Closer      — 关闭 Visit ★ 新增
//    └── closeVisit()              // closeMe(true) → 跳过confirm
//
// 7. 主流程 (仿 pt-auto-bill-v5):
//    runTasks()
//      → processPatientGroup(group, isFirst)
//        → executeVisitTask(task)
//           → Navigator.openVisitByIndex(n)
//           → Navigator.navigateToICD()
//           → ICDFiller.addICDCodes(...)
//           → CPTFiller.addCPTCodes(...)
//           → [save ICD/CPT]
//           → Navigator.navigateToPTNote()
//           → SOAPFiller.fillSOAP(...)
//           → SOAPFiller.saveSOAP()
//           → Navigator.navigateToCheckout()
//           → Biller.generateBilling()
//           → [close visit]
```

### 5.2 执行流程 (per visit)

```
┌─────────────────────────────────────────────────────────┐
│                executeVisitTask(task)                    │
│                                                         │
│  1. openVisitByIndex(task.dos)                          │
│     └─ Waiting Room 里按时间正序匹配第 N 个 visit        │
│                                                         │
│  2. navigateToICD()                                     │
│     └─ a_EMR_icdcpt.click() → parent.select_page(5,0)   │
│                                                         │
│  3. addICDCodes(task.icdCodes)                          │
│     └─ 优先从备选列表 select[name="list"] 选取           │
│     └─ 未匹配则 addSelectionD(name, code) × N            │
│                                                         │
│  4. addCPTCodes(task.cptCodes)                          │
│     └─ 优先从备选列表 select[name="list_cpt"] 选取       │
│     └─ 未匹配则 addSelectionD_cpt(text, text, code) × N  │
│     └─ 始终显式设置 Units (不依赖默认值)                  │
│     └─ 设置 LinkICD (关联ICD序号)                        │
│                                                         │
│  5. saveICDCPT()                                        │
│     └─ letsGo(2) → 等待页面重载                          │
│                                                         │
│  6. navigateToPTNote()                                  │
│     └─ a_EMR_ptnote.click() → parent.select_page(4,7)   │
│                                                         │
│  7. fillSOAP(task.soap)                                 │
│     └─ tinyMCE.getInstanceById("SOAPtext0").setContent() │
│     └─ tinyMCE.getInstanceById("SOAPtext1").setContent() │
│     └─ tinyMCE.getInstanceById("SOAPtext2").setContent() │
│     └─ tinyMCE.getInstanceById("SOAPtext3").setContent() │
│     └─ modified = 1                                     │
│                                                         │
│  8. saveSOAP()                                          │
│     └─ reallySubmit() → AJAX POST → 无页面重载            │
│                                                         │
│  9. navigateToCheckout()                                │
│     └─ a_EMR_checkout.click() → parent.select_page(9,0) │
│                                                         │
│  10. generateBilling()                                  │
│      └─ checkoutWin.checkOutOV(2) → doCheckOut → letsGo │
│      └─ waitFor: spanPassToBill 显示 "(Billing is created)" │
│                                                         │
│  11. closeVisit()                                       │
│      └─ wa0Win.closeMe(true) → 跳过confirm → emptyarea  │
│                                                         │
│  任何步骤失败:                                            │
│    → task.status = 'failed'                             │
│    → task.result = '✗ 原因'                              │
│    → 尝试 closeVisit()                                   │
│    → 继续下一个 visit (不停止!)                           │
└─────────────────────────────────────────────────────────┘
```

### 5.3 错误处理策略 (仿 pt-auto-bill-v5)

```
核心原则: 失败 → 标记 → 继续 → 事后处理

1. executeVisitTask 级别:
   try { 执行全流程 } catch (err) {
     task.status = 'failed'
     task.result = err.message
     await closeVisit().catch(() => {})  // 尽力关闭
     return false  // 不抛出，不停止
   }

2. processPatientGroup 级别:
   - 搜索患者失败 → 该患者所有 visits 标记失败 → 继续下一个患者
   - 单个 visit 失败 → 同患者其他 visits 继续执行

3. runTasks 级别:
   - 全部患者处理完 → 显示统计 (成功N / 失败N)
   - 用户可点击"重试失败" → resetFailedTasks() → 重新执行

4. 每步操作使用 withRetry():
   - waitFor(条件, { timeout: 10000, desc: '描述' })
   - 最多重试 3 次
   - 超时 → 标记该步骤失败

5. 可恢复错误 (自动重试):
   - iframe 未加载完 → waitFor 重试
   - TinyMCE 未初始化 → 等待后重试
   - AJAX 保存超时 → 重试

6. 不可恢复错误 (跳过):
   - 患者搜索无结果
   - Visit 已被 billing 锁定 (parent.isPassToBill != 0)
   - 无写权限 (editAble == 0)
   - Session 过期 → 提醒用户重新登录

7. 崩溃恢复 (MDLandState localStorage):
   - 页面刷新 → 自动恢复任务进度
   - 已完成的不重复执行
   - 从上次失败点继续
```

### 5.4 Visit 匹配策略

```
问题: Excel 中 DOS=1,2,3,4 是顺序号，MDLand 中是真实日期

匹配方案:
1. 搜索患者 (DOB) → 进入 Waiting Room
2. 该患者的所有 visits 按 DOS 日期正序排列
3. Excel DOS=1 → 第1个 visit (时间最早)
4. Excel DOS=2 → 第2个 visit (时间第二早)
5. ...以此类推

实现:
  const allVisits = getPatientVisits()  // 从 Waiting Room 获取
    .sort((a, b) => parseDate(a.dos) - parseDate(b.dos))
  const targetVisit = allVisits[task.dos - 1]  // 0-indexed
  openVisit(targetVisit)
```

### 5.5 悬浮面板 UI (复用 MDLandUI.createPanel)

```
┌──────────────────────────────────────┐
│  SOAP Batch Fill           ─ □ ✕    │
├──────────────────────────────────────┤
│ Batch: batch_20260217_143022         │
│ ████████████░░░░░░░░  12/30  40%    │
│                                      │
│ Stats                                │
│ Done: 10   Failed: 1   Skipped: 1   │
│                                      │
│ Current                              │
│ Patient: CHEN, AIJIN (3/8)           │
│ Visit: #2 TX#1 (2/4)                │
│ Step: Filling SOAP...                │
│                                      │
│ Log                                  │
│ 14:32:01 Done  LI,HUA TX#1          │
│ 14:31:45 Fail  WANG,MEI IE: locked   │
│ 14:31:20 Done  CHEN,AIJIN TX#1      │
│                                      │
│ [Start] [Pause] [Retry Failed]       │
│ [Export Results]                      │
└──────────────────────────────────────┘
```

---

## 6. 现有资源利用清单

### 6.1 直接复用 (无需修改)

| 模块 | 来源 | 用途 |
|------|------|------|
| MDLandConfig | core/mdland-core-config.js | 超时、等待时间、存储Key |
| MDLandUtils | core/mdland-core-utils.js | wait, waitFor, withRetry, humanClick, getAllDocs, interceptDialogs |
| MDLandState | core/mdland-core-state.js | createStateManager (任务队列、进度、持久化、崩溃恢复) |
| MDLandUI | core/mdland-core-ui.js | createPanel (悬浮面板、进度条、任务列表) |
| Navigator.clickWaitingRoom | pt-auto-bill-v5.js | Waiting Room 导航 |
| Navigator.clickOnePatient | pt-auto-bill-v5.js | One Patient 模式 |
| Navigator.searchPatient | pt-auto-bill-v5.js | DOB 搜索 |
| Navigator.selectPatient | pt-auto-bill-v5.js | 选择患者 |
| ScreenWakeLock | pt-auto-bill-v5.js | 防止屏幕休眠 |
| processPatientGroup 模式 | pt-auto-bill-v5.js | 按患者分组执行 |
| soap-generator.ts | src/generator/ | SOAP 内容生成 |
| tx-sequence-engine.ts | src/generator/ | TX 序列生成 (渐进改善趋势) |
| weight-system.ts | src/parser/ | 权重计算 |
| body-part-constants.ts | src/shared/ | 身体部位数据、ICD 映射 |

### 6.2 需要新建

| 模块 | 位置 | 功能 |
|------|------|------|
| Navigator.openVisitByIndex | 脚本内 | 按时间顺序打开第N个visit |
| Navigator.navigateToICD | 脚本内 | 切到 ICD/CPT 页面 |
| Navigator.navigateToPTNote | 脚本内 | 切到 PT Note 页面 |
| Navigator.navigateToCheckout | 脚本内 | 切到 Checkout 页面 |
| ICDFiller | 脚本内 | 优先备选列表 → addSelectionD 批量添加 ICD |
| CPTFiller | 脚本内 | 优先备选列表 → addSelectionD_cpt + 显式设置 Units + LinkICD |
| SOAPFiller | 脚本内 | TinyMCE setContent + reallySubmit |
| Biller | 脚本内 | Generate Billing |
| text-to-html.ts | server/services/ | 纯文本 → HTML 转换 |
| excel-parser.ts | server/services/ | Excel 解析 + 分组 + TX 编号 |
| batch-generator.ts | server/services/ | 批量调用 soap-generator |
| batch-store.ts | server/store/ | 内存 + JSON 存储 |
| batch.ts | server/routes/ | API 路由 |
| BatchView.vue | frontend/src/views/ | 批量操作前端页面 |
| icd-catalog.ts | src/shared/ | ICD code→name 映射表 |

---

## 7. 关键技术挑战

### 7.1 ICD/CPT 保存时序

```
问题: ICD/CPT 保存是 Form POST (整页提交+重载)，不是 AJAX
影响: 保存后页面重载，需要重新获取 DOM 引用

方案:
  1. 添加所有 ICD + CPT
  2. 设置每个 CPT 的 Units 和 LinkICD
  3. 调用 letsGo(2) 触发保存
  4. waitFor 页面重载完成 (新的 diagnose iframe 加载完)
  5. 再切换到 PT Note
```

### 7.2 TinyMCE 3.5.8 操作

```
问题: TinyMCE 3.5.8 API 较老
注意:
  - 使用 tinyMCE.getInstanceById() 而非 tinymce.get()
  - 必须等待 TinyMCE 完全初始化 (iframe 加载完毕)
  - setContent 后设置 modified = 1 (非必须但推荐)
  - 保存使用 reallySubmit() (AJAX, 无重载) 而非 letsGo(2) (form submit, 有重载)
  - reallySubmit() 内部自动从 TinyMCE getBody().innerHTML 提取内容

验证:
  const ptFrame = workarea.contentDocument.getElementById('ptnote')
  const pdoc = ptFrame.contentDocument
  const tinyMCE = pdoc.defaultView.tinyMCE
  // 检查 tinyMCE 是否可用
  if (!tinyMCE || !tinyMCE.getInstanceById('SOAPtext0')) {
    throw new Error('TinyMCE 未初始化')
  }
```

### 7.3 AutoSaveIframe 干扰

```
问题: 切换 section (ICD→PTNote) 时，AutoSaveIframe 可能自动触发保存
影响: 如果 ICD/CPT 还没保存就被自动保存，可能丢失数据；或者自动保存阻塞操作

方案:
  1. ICD/CPT: 主动调用 letsGo(2) 保存，等待完成后再切换
  2. 切换时适当延迟: await wait(2000)
  3. 切换前检查 modified 状态
```

### 7.4 CPT Units 和 LinkICD 设置

```
问题: addSelectionD_cpt 只添加 CPT code，Units 由 __CPTCodeUnitMap__ 决定默认值
      97814 默认 Units=2 (MDLand 内置), 其他 CPT 默认 Units=1
影响: 如果不显式设置 Units:
      - HF/OPTUM: 97810×1 → 默认1 ✅ 无需改
      - WC: 97813×1(1✅), 97814×2(2✅), 97811×1(1✅) → 全部匹配默认值
      - VC: 97813×1(1✅), 97814×1(默认2❌), 97811×2(默认1❌) → 需要覆盖!

策略: 始终显式设置每个 CPT 的 Units 值，不依赖默认值
      即使当前默认值恰好正确，也主动设置，防止 MDLand 修改默认映射

方案:
  添加 CPT 后，遍历已选 CPT 列表:
  for each CPT row:
    if task.cptCodes includes this code:
      set Units input value = task.units    // 始终显式设置
      set LinkICD input value = "1,2,3..." (关联所有已选 ICD)
```

---

## 8. 实施计划

### Phase 1: 后端 API + 生成管线 (3-4天)

- [ ] 搭建 Express 服务 (`server/index.ts`)
- [ ] 实现 Excel 解析 + 患者分组 + TX 自动编号 (`server/services/excel-parser.ts`)
- [ ] 实现 Text→HTML 转换层 (`server/services/text-to-html.ts`)
- [ ] 创建 ICD code→name 映射表 (`src/shared/icd-catalog.ts`)
- [ ] 实现批量生成服务 (`server/services/batch-generator.ts`)
  - 调用 `exportSOAPAsText()` 生成 IE
  - 调用 `generateTXSequenceStates()` + `exportSOAPAsText()` 生成 TX 系列
  - 拆分 SOAP sections + 转 HTML
- [ ] 实现批次存储 (`server/store/batch-store.ts`)
- [ ] 实现 API 路由 (`server/routes/batch.ts`)
- [ ] 创建 Excel 模板文件 (`templates/batch-template.xlsx`)
- [ ] 更新 `docker-compose.yml` (加入后端服务)

### Phase 2: 前端 BatchView (2-3天)

- [ ] 新增 BatchView.vue 页面 + 路由
- [ ] Excel 上传 + 调用 API + 加载预览
- [ ] 批量生成结果展示 (按患者分组, SOAP 折叠展开)
- [ ] ICD/CPT 展示 (只读，来自 Excel)
- [ ] 单条 SOAP 编辑 / 重新生成
- [ ] 确认批次 + 生成 batchId

### Phase 3: Tampermonkey 脚本 (3-4天)

- [ ] 创建 `scripts/mdland-batch-soap.js` 骨架
- [ ] 复用 Core Modules + Navigator 基础函数
- [ ] 实现 Navigator 扩展 (openVisitByIndex, navigateToICD/PTNote/Checkout)
- [ ] 实现 ICDFiller (addICDCodes, saveICD)
- [ ] 实现 CPTFiller (addCPTCodes + Units + LinkICD, saveCPT)
- [ ] 实现 SOAPFiller (fillSOAP via TinyMCE, saveSOAP via reallySubmit)
- [ ] 实现 Biller (generateBilling)
- [ ] 实现 executeVisitTask + processPatientGroup + runTasks
- [ ] 悬浮面板 UI (MDLandUI.createPanel)
- [ ] 失败重试 + 崩溃恢复 (MDLandState)
- [ ] 结果导出

### Phase 4: 集成测试 + 优化 (2天)

- [ ] 单患者单 visit 端到端测试
- [ ] 单患者多 visit (10+ visits) 测试
- [ ] 多患者批量测试
- [ ] 错误场景测试 (已锁定、无权限、Session 超时)
- [ ] 性能优化 (减少不必要的等待)
- [ ] 稳定性验证 (连续处理 50+ visits)

---

## 9. 关键注意事项

1. **SOAP 内容格式**: `exportSOAPAsText()` → 纯文本 → `textToHTML()` → HTML → TinyMCE
2. **性别**: Excel Gender 列必填 (M/F)，用于 SOAP 代词和证型描述
3. **ICD/CPT 关联**: `LinkICD` 字段需设置 ICD 序号对应关系 (如 "1,2")
4. **Billing 前置条件**: 每个 visit 完成后都需 Generate Billing；只有未 bill 的 visit 才能操作 (`parent.isPassToBill == 0`)
5. **并发安全**: MDLand 有冲突检测 (`checkOVItemConflict`)，同一时间只能一个脚本操作
6. **Session 超时**: MDLand ASP.NET Session 可能超时，脚本需检测并提醒重新登录
7. **AutoSaveIframe**: 切换 section 时可能自动保存，需主动保存后再切换
8. **Visit 顺序**: Excel DOS 顺序号 → MDLand Waiting Room 按日期正序匹配
9. **ICD 上限**: 最多 12 个 ICD 关联 CPT
10. **韧性执行**: 任何单点失败不应影响整体流程，标记失败 → 继续 → 事后重试

---

## 10. 深度分析 — 已识别的 Gaps 与对策

### 10.1 Needle Protocol 在 SOAP 拆分中的位置

```
现状: exportSOAPAsText() 输出 → Subjective/Objective/Assessment/Plan/NeedleProtocol/Precautions
     splitSOAP() 按 "Subjective\n", "Objective\n", "Assessment\n", "Plan\n" 分割
     Plan 是最后一个 marker，所以它的 contentEnd = text.length

结论: Needle Protocol 和 Precautions 自动成为 Plan section 的一部分
     无需特殊处理，splitSOAP 已正确处理
```

### 10.2 GenerationContext 默认值策略

```
大部分 GenerationContext 字段在 Excel 中不提供 (减少用户输入负担)
后端使用与 useSOAPGeneration.ts 相同的默认值:

  localPattern: 'Qi Stagnation'
  systemicPattern: 'Kidney Yang Deficiency'
  chronicityLevel: 'Chronic'
  severityLevel: 'moderate'
  painCurrent: 7
  painWorst: 9, painBest: 4
  painTypes: ['Dull', 'Aching']
  symptomScale: '70%-80%'
  painFrequency: 'Constant (...)'
  symptomDuration: { value: '3', unit: 'year(s)' }
  painRadiation: 'without radiation'
  recentWorse: { value: '2', unit: 'week(s)' }
  causativeFactors: ['age related/degenerative changes']
  relievingFactors: ['Changing positions', 'Resting', 'Massage']
  associatedSymptom: 'soreness'
  gender: Excel Gender 列 → 'Male' | 'Female'

注意: 引擎根据 TX# 自动调整 pain/ROM/symptoms，所以这些默认值只是起点
未来可通过 Excel 增加可选列覆盖特定默认值
```

### 10.3 CORS — Tampermonkey 跨域请求

```
问题: Tampermonkey @grant none 模式下，fetch 遵守同源策略
     MDLand: https://web153.b.mdland.net
     soap-system: http://150.136.150.184:9090

方案 (推荐): 后端 Express 加 CORS
  app.use(cors({ origin: /\.mdland\.net$/ }))

备用: 不用 fetch，用户在 BatchView "复制 JSON" → Tampermonkey 面板 "粘贴"
两种方式同时支持，主用 fetch + CORS
```

### 10.4 Session 超时检测

```javascript
// 在每个主要操作前检查 MDLand session
function checkSession() {
  const hasWorkarea = !!top.document.querySelector('iframe[name="workarea0"]')
  const hasSession = !!top.g_sessionID
  if (!hasWorkarea || !hasSession) {
    throw new Error('SESSION_EXPIRED: 请重新登录 MDLand 后重试')
  }
}
```

### 10.5 ICD/CPT 保存时序优化

```
原方案: 手动 letsGo(2) 保存 ICD/CPT → 等待页面重载 → 切到 PT Note
问题: form submit 导致 diagnose iframe 整页重载，时序复杂

优化方案: 利用 AutoSaveIframe 机制
  1. 添加所有 ICD + CPT + Units + LinkICD
  2. 设置 modified = 1
  3. 直接切换到 PT Note (a_EMR_ptnote.click() → parent.select_page(4,7))
  4. AutoSaveIframe 自动触发 ICD/CPT 保存
  5. 在 PT Note 中填入 SOAP
  6. 手动 reallySubmit() 保存 SOAP (AJAX, 无重载)

需验证: AutoSaveIframe 是否总能正确触发并完成保存
回退方案: 如果 AutoSave 不可靠，改为手动 letsGo(2) + waitFor 重载完成
```

### 10.6 同日多 Visit 排序

```
问题: 如果同一天有多个 visits，DOS 日期相同如何排序？
方案: 按 Waiting Room 行 ID 排序 (trt{rowId}，rowId 更大 = 更晚创建)
     这与 MDLand 的默认显示顺序一致

注意: 如果有非针灸科的 visit 混入，需要按 subject 字段过滤
     只处理 subject 包含 "PT" 的 visits
```

### 10.7 Visit 关闭后的状态恢复

```
关闭 visit → closeMe(true) 跳过 confirm → top.closeArea(0) → emptyarea.html
注意: 关闭后不是回到 Waiting Room，而是 workarea0 变成空白页

代码:
  await wa0Win.closeMe(true)    // 直接关闭，无 confirm
  await wait(2000)              // 等待 emptyarea 加载

同患者多 Visit 流程:
  患者有 4 个 visits (DOS=1,2,3,4):
    1. 搜索患者 → 进入 Waiting Room → 看到 4 个 visits
    2. 打开 visit #1 → 填 ICD/CPT/SOAP → Checkout → closeMe(true)
       → workarea0 = emptyarea.html
    3. 需要重新搜索同一患者 → 进入 Waiting Room → 打开 visit #2
       (不能直接从 emptyarea 打开下一个 visit，必须重新搜索)
    4. 重复步骤 3 直到所有 visits 完成
    5. 搜索下一个患者

  优化: processPatientGroup(group) 中缓存患者 DOB，
        closeVisit 后直接 searchPatient(dob) 重新搜索
```

---

## 11. 待用户确认事项 (全部已确认 ✅)

1. **IE/RE 特殊 CPT code** ✅: IE/RE 的 CPT 由用户手工填写，系统不自动追加
2. **性别处理** ✅: Excel 加 Gender 列 (M/F)，必填
3. **Checkout/Billing** ✅: 每个 visit 都需要 Generate Billing
4. **ICD code→name** ✅: 实测确认可直接用 code 作 name，建议维护常用码表
5. **visit 过滤** ✅: 按 Subject 包含 "PT" 过滤

---

## 12. MDLand 实测验证结果 (2026-02-17)

> 在 MDLand 生产环境 (web153.b.mdland.net, CID:3997) 实测验证，患者 CHEN, AIJIN

### 12.1 Visit 打开流程 ✅

```
测试步骤:
  1. Waiting Room → One Patient → 搜索 DOB 09/27/1956
  2. 点击 CHEN, AIJIN → 加载 9 个 visits (Total: 9)
  3. 点击 visit #37 (moveInMe(1)) → 成功打开 Office Visit 页面

关键发现:
  - 打开 visit: javascript:moveInMe(N)，N=行号(1-based)
  - 打开后显示: OV CHEN, AIJIN 标签页，URL: ov_doctor_spec.aspx
  - 页面包含 92 个 iframe (其中 diagnose, ptnote 为关键)
  - ov_doctor_spec.aspx 是主容器，包含 select_page() 和 Relocal() 导航函数
```

### 12.2 ICD/CPT 页面导航 ✅

```
导航方式 (两种都可):
  方式1: OfficeVisit iframe → a_EMR_icdcpt → onclick="parent.select_page(5,0)"
  方式2: workarea0 → Relocal('diagnose', true)  ← 需要正确参数

实测使用方式1:
  wa0.contentDocument.getElementById('OfficeVisit')
    .contentDocument.getElementById('a_EMR_icdcpt').click()
  → 成功加载 ov_icdcpt.aspx 到 diagnose iframe

关键导航函数映射:
  a_EMR_icdcpt   → parent.select_page(5,0)  → ICD/CPT 编辑
  a_EMR_ptnote   → parent.select_page(4,7)  → PT Note 编辑
  a_EMR_assessmentplan → EditAssessmentPlan(visitID)

  以上均在 OfficeVisit iframe (officevisit_Spec.aspx) 内
```

### 12.3 addSelectionD (ICD 添加) ✅

```
函数签名: addSelectionD(newText, newCode)
  - newText: 显示名称 (如 "Low back pain")
  - newCode: ICD-10 代码 (如 "M54.5")

实测:
  diagWin.addSelectionD('Low back pain', 'M54.5')
  → 成功添加: (2/B)(M54.5) Low back pain

结论:
  - code 可以作为 name 使用 ✅ (MDLand 接受任意 name)
  - 自动编号: (N/LETTER) 格式 ✅
  - 重复检测: 不会添加已有的 code ✅
  - CPT LinkICD 自动更新: 添加 ICD 后 CPT 的 ICD 链接自动扩展 ✅

Guard 条件:
  if (!IsOBICD && (WinTypeControl || WinType != "E") && parent.ovpage == 1 && parent.isPassToBill != 0) return;
  → 已 billing 的 visit 会被阻止 (isPassToBill=1)
  → 新 visit (isPassToBill=0) 不受影响 ✅
```

### 12.4 addSelectionD_cpt (CPT 添加) ✅

```
函数签名: addSelectionD_cpt(fullText, newText, newCode)
  - fullText: 完整显示名称
  - newText: 简短名称
  - newCode: CPT 代码

实测:
  diagWin.addSelectionD_cpt('ACUP 1/> W/ESTIM 1ST 15 MIN', 'ACUP 1/> W/ESTIM 1ST 15 MIN', '97813')
  → 成功添加: (97813) ACUP 1/> W/ESTIM 1ST 15 MIN

默认值:
  - Units: 1 (需要手动设置)
  - ICD: 自动链接所有已有 ICD (如 "1,2")
  - Ma/Mb/Mc/Md: 空 (修饰符)
```

### 12.5 CPT Units 和 LinkICD 设置 ✅

```
CPT 每行的 DOM 结构:
  input[name="cpt_code_h"]  (hidden)  → CPT 代码
  input[name="cpt_text"]    (hidden)  → CPT 名称
  input[name="Units"]       (text)    → 单位数
  input[name="LinkICD"]     (text)    → ICD 关联 (如 "1,2")
  input[name="Ma/Mb/Mc/Md"] (text)   → 修饰符
  input[name="link_select_modified"] (hidden) → 修改标记

设置方法:
  const unitFields = diagDoc.querySelectorAll('input[name="Units"]');
  unitFields[cptIndex].value = '3';  // 设置第N个 CPT 的 units

  const linkFields = diagDoc.querySelectorAll('input[name="LinkICD"]');
  linkFields[cptIndex].value = '1,2'; // 设置关联的 ICD 序号

实测:
  设置 97813 的 Units=3, LinkICD="1" → UI 立即反映变更 ✅
```

### 12.6 TinyMCE SOAP 编辑 ✅

```
PT Note 页面: ov_ptnote2018.aspx (在 ptnote iframe 内)

TinyMCE 实例:
  SOAPtext0 → Subjective
  SOAPtext1 → Objective
  SOAPtext2 → Assessment
  SOAPtext3 → Plan
  SOAPtext4 → (空，未使用)
  description → 笔记描述

API 验证:
  const ptWin = ptFrame.contentWindow;
  const ed = ptWin.tinyMCE.getInstanceById('SOAPtext0');

  ed.getContent()   → 返回 HTML 字符串 ✅
  ed.setContent(html) → 成功设置 HTML 内容 ✅

  setContent 后需设置: modified = 1 (触发保存检测)

保存函数:
  reallySubmit() → AJAX POST 保存 (推荐，无页面重载)
  letsGo(2) → form submit 保存 (有冲突检测, 有页面重载)
  letsGo(1) → 重载 (不保存)

  注意: letsGo(2) 检查 modified==0 会跳过保存!
        reallySubmit() 不检查 modified，更适合脚本使用
```

### 12.7 AutoSaveIframe 机制 ✅

```
位置: ov_doctor_spec.aspx (workarea0 主容器)
函数: AutoSaveIframe(lastIndex)

工作原理:
  当用户从一个 section 切到另一个 section 时:
  1. 检查 lastIndex 对应的 section 是否被修改 (MenuIsModified)
  2. 如果修改了 → 自动触发该 section 的保存
  3. 保存完成后 → 加载新 section

利用方式:
  方案A (AutoSave): 填完 ICD/CPT → 直接切到 PT Note → AutoSave 自动保存 ICD/CPT
  方案B (Manual):   填完 ICD/CPT → letsGo(2) 手动保存 → 等待重载 → 再切 PT Note

  推荐: 方案B (Manual)，更可控，避免 AutoSave 时序不确定性
```

### 12.8 关键 iframe 层级 (实测确认)

```
top (clinic_main.aspx)
 ├── waittinglistframe → waittinglist.aspx → waittinglistshow.aspx
 ├── workarea0 → ov_doctor_spec.aspx (主容器)
 │    ├── OfficeVisit → officevisit_Spec.aspx (导航菜单)
 │    ├── diagnose → ov_icdcpt.aspx (ICD/CPT 编辑)
 │    ├── ptnote → ov_ptnote2018.aspx (PT Note / TinyMCE)
 │    └── ... (其余 89+ 空 iframe)
 ├── workarea1-15 → emptyarea.html (未使用)
 ├── calendarframe → CatCalendar.aspx
 └── ... (30+ 辅助 iframe)

脚本入口路径:
  document.getElementById('workarea0')
    .contentDocument.getElementById('diagnose')     // ICD/CPT
    .contentDocument.getElementById('ptnote')        // PT Note

  document.getElementById('workarea0')
    .contentDocument.getElementById('OfficeVisit')  // 导航菜单
    .contentDocument.getElementById('a_EMR_icdcpt') // ICD/CPT Edit 按钮
    .contentDocument.getElementById('a_EMR_ptnote') // PT Note Edit 按钮
```

### 12.9 待确认事项更新

```
原始问题4 — "ICD code→name: 是否可以直接用 code 作为 name?"
  → 实测答案: ✅ 可以！addSelectionD('Low back pain', 'M54.5') 正常工作
  → 甚至可以用 addSelectionD('M54.5', 'M54.5')，MDLand 不验证 name
  → 但建议尽量提供可读名称，方便人工审核

原始问题5 — "visit 过滤: MDLand 是否有非针灸科 visit?"
  → 实测: CHEN, AIJIN 所有 9 个 visits 的 Subject 都是 "PT TREATMENT" 或 "IE-PT TREATMENT"
  → 最后一个 visit (#12) Subject="IE-PT TREATMENT", From="CX" (不同医生)
  → 过滤建议: 按 Subject 包含 "PT" 过滤 ✅
```

### 12.10 Checkout / Generate Billing 流程 ✅

```
导航: a_EMR_checkout → parent.select_page(9,0) → checkout iframe (checkout2006_spec.aspx)

按钮: btn_checkout (DIV)
  onclick="if(checkEMRFeatureStatus()) checkOutOV(2)"

调用链:
  checkEMRFeatureStatus()          — 检查 EMR 功能是否启用
  → checkOutOV(2)                  — 检查 MU (Meaningful Use) 完成状态
    → continueCheckOut(2)          — 检查 TeleHealth modifier、consultation
      → doCheckOut(2)              — 设置 passbill=0
        → letsGo(2)               — 保存 cookie + form submit

关键代码:
  function doCheckOut(mode) {
    document.getElementById('passbill').value = 0;
    letsGo(mode);
  }

Guard 条件:
  - checkEMRFeatureStatus(): EMRFeatureStatus 必须为 "1"
  - parent.editMode == 0 → "You are in browse mode" 阻止 checkout
  - parent.VisitStatus == 'CA' → "已删除的 visit 无法 checkout"

已 Billing 的 visit:
  - spanPassToBill 显示 "(Billing is created)"
  - BillAsPCP radio = "S" (Skip Billing)

脚本使用方式:
  // 方式1: 完整流程 (推荐)
  checkoutWin.checkOutOV(2)

  // 方式2: 跳过检查直接提交
  checkoutWin.doCheckOut(2)
```

### 12.11 closeVisit 关闭流程 ✅

```
按钮: link "Close" → javascript:closeMe()
位置: ov_doctor_spec.aspx 顶部导航栏

函数签名: closeMe(now)

流程:
  if (!now) {
    // 检查是否有未保存修改
    if (finished==1) {
      errstr = checkComplete()
      if (errstr.length > 0)
        → confirm("...Are you sure you want to close without saving?")
      else if (OfficeVisit.modified == 1)
        → confirm("Some values have been changed...")
      else
        → confirm("Are you sure you want to close OFFICE VISIT?")
    }
  }
  // 关闭操作:
  if (locked by current doctor) → form submit to ov_unlock.aspx
  else → top.closeArea(0) + redirect to emptyarea.html

关键发现:
  ✅ closeMe(true) — 跳过所有 confirm 弹窗，直接关闭！
  ✅ 关闭后执行: top.closeArea(0), g_visitID[0]=-1, 清空 ICDSB/CPTSB
  ✅ 回到 emptyarea.html (空白页), 不是回到 Waiting Room

脚本使用方式:
  // 直接关闭，无 confirm
  wa0Win.closeMe(true)
  // 然后等待 emptyarea 加载完，再搜索下一个患者
```

### 12.12 PT Note 保存函数 ✅

```
PT Note (ov_ptnote2018.aspx) 有两种保存方式:

方式1: reallySubmit(action) — AJAX 保存 (推荐用于脚本)
  ✅ 不检查 modified 状态
  ✅ 不检查冲突 (跳过 checkOVItemConflict)
  ✅ 无页面重载
  ✅ 从 TinyMCE 提取 innerHTML → form fields → $.ajax POST
  ✅ 成功后: modified=0, parent.ptnoteF=1, reloadOfficeVisit()

  代码:
    function reallySubmit(action) {
      document.ecform.isAjaxSave.value = "1";
      document.ecform.SOAPtext0.value = tinyMCE.getInstanceById("SOAPtext0").getBody().innerHTML;
      document.ecform.SOAPtext1.value = tinyMCE.getInstanceById("SOAPtext1").getBody().innerHTML;
      document.ecform.SOAPtext2.value = tinyMCE.getInstanceById("SOAPtext2").getBody().innerHTML;
      document.ecform.SOAPtext3.value = tinyMCE.getInstanceById("SOAPtext3").getBody().innerHTML;
      document.ecform.SOAPtext4.value = tinyMCE.getInstanceById("SOAPtext4").getBody().innerHTML;
      $.ajax({ url: '/eClinic/ov_ptnote2018.aspx', type: 'post', ... });
    }

方式2: letsGo(2) — Form Submit 保存 (有冲突检测)
  ⚠ 检查 modified==0 时直接 return (不保存!)
  ⚠ 调用 checkOVItemConflict() → 回调 letsGoCallback → form submit
  ⚠ 会导致整页重载

结论:
  脚本应使用 reallySubmit() — 更简单、更可靠、无重载
  但仍建议设置 modified=1 (防止 closeMe() 的 confirm 逻辑误判)
```

### 12.13 modified 标记必要性 ✅

```
分析:
  - reallySubmit(): 不检查 modified → 即使 modified=0 也能保存 ✅
  - letsGo(2): 检查 modified==0 → 如果未修改则跳过保存 ⚠
  - closeMe(): 检查 OfficeVisit.modified==1 → 弹 confirm ⚠

结论:
  使用 reallySubmit() 时 modified=1 不是必须的
  但建议在 setContent() 后设置:
    ptWin.modified = 1    // PT Note level
  这样如果脚本中途失败，closeMe() 能正确提示未保存
```

### 12.14 CPT Code → Name 映射表 ✅

```
通过 MDLand AJAX 搜索 API (/eClinic/ov_search_code_name_tmp.aspx) 实测获取:

| CPT Code | MDLand 标准名称                    | 用途           |
|----------|-----------------------------------|----------------|
| 97810    | ACUP 1/> WO ESTIM 1ST 15 MIN     | 针灸无电刺激首15min |
| 97811    | ACUP 1/> W/O ESTIM EA ADD 15     | 针灸无电刺激加15min |
| 97813    | ACUP 1/> W/ESTIM 1ST 15 MIN      | 针灸有电刺激首15min |
| 97814    | ACUP 1/> W/ESTIM EA ADDL 15      | 针灸有电刺激加15min |
| 97140    | MANUAL THERAPY 1/> REGIONS       | 手法治疗         |
| 97161    | PT EVAL LOW COMPLEX 20 MIN       | PT评估-低复杂度   |
| 97162    | PT EVAL MOD COMPLEX 30 MIN       | PT评估-中复杂度   |
| 97163    | PT EVAL HIGH COMPLEX 45 MIN      | PT评估-高复杂度   |

默认 Units (__CPTCodeUnitMap__):
  97814 → 默认 Units=2 (MDLand 内置)
  其他 → 默认 Units=1
  脚本需要手动设置实际 Units 值覆盖默认值
```

### 12.15 ICD/CPT 备选列表机制 ✅

```
重大发现: ICD/CPT 页面左侧有预设的备选列表 (select 下拉框)
         已包含该医生常用的 ICD 和 CPT codes，双击即可添加到右侧已选列表

CPT 备选列表 (select[name="list_cpt"], 7个选项):
  index=1: value="97813"    text="(97813) ACUP 1/> W/ESTIM 1ST 15 MIN"
  index=2: value="97814"    text="(97814) ACUP 1/> W/ESTIM EA ADDL 15"
  index=3: value="97811"    text="(97811) ACUP 1/> W/O ESTIM EA ADD 15"
  index=4: value="97810"    text="(97810) ACUP 1/> WO ESTIM 1ST 15 MIN"
  index=5: value="9921325"  text="(9921325) OFFICE O/P EST LOW 20 MIN"   ← 99213+Modifier25
  index=6: value="9921225"  text="(9921225) OFFICE O/P EST SF 10 MIN"    ← 99212+Modifier25
  index=7: value="9920325"  text="(9920325) OFFICE O/P NEW LOW 30 MIN"   ← 99203+Modifier25

ICD 备选列表 (select[name="list"], 24个选项):
  M25.511 Pain in right shoulder     | M25.512 Pain in left shoulder
  M25.521 Pain in right elbow        | M25.522 Pain in left elbow
  M25.531 Pain in right wrist        | M25.532 Pain in left wrist
  M25.541 Pain in joints of right hand | M25.542 Pain in joints of left hand
  M25.551 Pain in right hip          | M25.552 Pain in left hip
  M25.561 Pain in right knee         | M25.562 Pain in left knee
  M25.571 Pain in right ankle/foot   | M25.572 Pain in left ankle/foot
  M54.16 Radiculopathy, lumbar       | M54.2 Cervicalgia
  M54.41 Lumbago with sciatica, R    | M54.42 Lumbago with sciatica, L
  M54.50 Low back pain, unspecified  | M54.51 Vertebrogenic low back pain
  M54.59 Other low back pain         | M54.6 Pain in thoracic spine
  M62.830 Muscle spasm of back       | S39.012A Strain of muscle/fascia lower back

Modifier 编码规则:
  CPT code 字段 = 5位CPT + 2位Ma + 2位Mb + 2位Mc + 2位Md
  示例: "9920325" → CPT=99203, Ma=25 (Modifier 25 自动添加)
  addSelectionD_cpt 内部: Ma_ = newCode.substr(5,2) → 自动提取

添加方式 (两种):

  方式1 — 从备选列表选择 (优先，如果 code 在列表中):
    listCPT.selectedIndex = targetIndex;
    listCPT.ondblclick()  // 触发 selectList_cpt + addSelection_cpt
    // → 内部调用 addSelectionD_cpt(fullText, newText, newCode)

  方式2 — 直接调用 addSelectionD_cpt (备选列表中没有的 code):
    addSelectionD_cpt('ACUP 1/> W/ESTIM 1ST 15 MIN', '(97813) ACUP 1/> W/ESTIM 1ST 15 MIN', '97813')

  方式3 — AJAX 搜索添加 (任意 code):
    搜索框输入 code → search_by_ajax(2, code, "1", tag)
    → 结果填入 list_cpt → 选择 → 添加

脚本策略:
  1. 先检查备选列表是否包含目标 CPT code
  2. 如果有 → 使用方式1 (模拟双击选择)
  3. 如果没有 → 使用方式2 (直接 addSelectionD_cpt)
  4. 同理处理 ICD codes
```

---

*创建日期: 2026-02-17*
*修订日期: 2026-02-17*
*状态: 方案设计完成 + 深度分析完成 + MDLand 实测全部验证完成，可以开始实施*

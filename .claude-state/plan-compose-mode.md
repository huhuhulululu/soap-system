# 计划 v4: SOAP 生产 API + Batch 存储 API（方案 A — 精确复刻编写模式）

## 目标

为外部系统提供后端 API：
1. SOAP 生产（精确复刻编写模式 soap-engine.worker.ts 逻辑）
2. 已生成 SOAP 存入 batch（跳过后端重新生成）
3. 复用现有 confirm + automate 提交流程

## 验证结论

- romFloors 不需要：引擎 `generateTXSequenceStates` 的 `romDeficit` 已保证 ROM 单调递增
- GATE-01 不需要：编写模式没有，外部系统不需要 Medicare 注解
- 编写模式逻辑已验证：同 seed LBP 12TX，ROM Flexion 30→30→30→40→50→50→65→65→65→70→70→70，零回退

## API 设计

### 新增 3 个 API

#### 1. POST /api/soap/generate — 单患者 SOAP 生产

Request:
```typescript
{
  input: {
    // 必填 6 个
    noteType: "IE" | "TX",
    insuranceType: "HF" | "AETNA" | "CIGNA" | "UHC" | "BCBS" | "ELDERPLAN" | "OPTUM",
    primaryBodyPart: "SHOULDER" | "KNEE" | "ELBOW" | "NECK" | "LBP" | "MIDDLE_BACK" | "MID_LOW_BACK",
    laterality: "left" | "right" | "bilateral",
    painCurrent: number,        // 1-10
    severityLevel: "mild" | "moderate" | "severe",
    // 可选（有默认值）
    painWorst?: number,
    painBest?: number,
    painTypes?: string[],
    associatedSymptom?: string,
    associatedSymptoms?: string[],
    symptomDuration?: { value: string, unit: string },
    painRadiation?: string,
    symptomScale?: string,
    painFrequency?: string,
    causativeFactors?: string[],
    relievingFactors?: string[],
    recentWorse?: { value: string, unit: string },
    chronicityLevel?: "Acute" | "Sub Acute" | "Chronic",
    age?: number,
    gender?: "Male" | "Female",
    secondaryBodyParts?: string[],
    medicalHistory?: string[],
    localPattern?: string,
    systemicPattern?: string,
    disableChronicCaps?: boolean,
  },
  txCount: number,              // TX 数量
  seed?: number,                // 可选 seed（复现用）
  realisticPatch?: boolean,     // 是否 patch ROM/Strength（默认 false）
  startVisitIndex?: number,     // TX 起始 index（续写用，默认 1）
  ieTxCount?: number,           // IE 模式下 TX 数量（默认 11）
}
```

Response:
```typescript
{
  success: true,
  data: {
    seed: number,
    notes: Array<{
      visitIndex: number,
      type: "IE" | "TX",
      text: string,
      soap: { subjective: string, objective: string, assessment: string, plan: string },
      html: { subjective: string, objective: string, assessment: string, plan: string },
    }>
  }
}
```

生产逻辑（精确复刻 soap-engine.worker.ts）:
```
normalizeGenerationContext(input)
  → txCtx = { ...context, noteType: "TX" }
  → generateTXSequenceStates(txCtx, { txCount, seed, startVisitIndex, initialState })
  → if noteType === "IE":
      ieText = exportSOAPAsText(ctx, {})
      if realisticPatch: ieText = patchSOAPText(ieText, ctx)
      ieHtml = convertSOAPToHTML(ieText)   // IE 用纯 <p> 标签
  → for each state:
      text = exportSOAPAsText(txCtx, state)
      if realisticPatch: text = patchSOAPText(text, txCtx, state)
      html = exportSOAP(txCtx, state, "html")  // TX 用 ppnSelectCombo spans
  → splitSOAPText() 拆分 text 和 html
```

HTML 模式说明:
- IE: `convertSOAPToHTML(text)` — 纯 `<p>` 标签（IE 没有 ppnSelectCombo 下拉）
- TX: `exportSOAP(ctx, state, "html")` — 带 `ppnSelectCombo` spans（MDLand TinyMCE 兼容）

#### 2. POST /api/soap/generate-batch — 多患者批量生产

Request:
```typescript
{
  patients: Array<{
    input: NormalizeInput,       // 同上
    txCount: number,
    seed?: number,
    realisticPatch?: boolean,
    startVisitIndex?: number,
    ieTxCount?: number,
  }>
}
```

Response:
```typescript
{
  success: true,
  data: {
    patients: Array<{
      seed: number,
      notes: Array<{ visitIndex, type, text, soap, html }>
    }>
  }
}
```

#### 3. POST /api/batch/prebuilt — 存储已生成的 SOAP

Request: 直接接受完整 BatchPatient[] 类型
```typescript
{
  mode: "full" | "soap-only",
  patients: BatchPatient[],     // 完整类型，含 generated
}
```

BatchPatient 必须包含:
- name, dob, age, gender, insurance, clinical
- visits[]: 每个 visit 必须有 index, dos, noteType, txNumber, bodyPart, laterality, secondaryParts, history, icdCodes, cptCodes, generated (含 soap + html + fullText + seed), status="done"

Response:
```typescript
{
  success: true,
  data: { batchId: string, totalPatients: number, totalVisits: number }
}
```

内部: 构造 BatchData → saveBatch()，不调用 generateBatchAsync。

## 实现文件

### 新增文件

1. `server/services/soap-producer.ts` — 编写模式生产逻辑后端版
   - `produceSinglePatient(request)` → { seed, notes[] }
   - 精确复刻 soap-engine.worker.ts

2. `server/routes/soap.ts` — SOAP 生产 API 路由
   - `POST /` → 单患者
   - `POST /generate-batch` → 多患者

3. `server/__tests__/soap-producer.test.ts` — 生产逻辑测试
4. `server/__tests__/soap-routes.test.ts` — API 路由测试

### 修改文件

5. `server/routes/batch.ts` — 新增 `POST /prebuilt` 路由
6. `server/index.ts` — 挂载 `/api/soap` 路由 + requireAuth

### 不改动

- `server/services/batch-generator.ts` — 现有 batch 生产逻辑保留
- `server/store/batch-store.ts` — 原样使用
- `server/routes/automate.ts` — 原样使用
- `src/generator/` — 不动
- `frontend/` — 不动

## 输入验证

zod schema 验证:
- NormalizeInput 6 个必填字段: noteType, insuranceType, primaryBodyPart, laterality, painCurrent (1-10), severityLevel
- txCount > 0
- prebuilt: BatchPatient[] 结构完整性（name, dob, visits[].generated 非空）

## 认证

```typescript
// server/index.ts
app.use("/api/soap", requireAuth, createSoapRouter());
```

外部系统用 `x-api-key` header 或 JWT cookie 认证。

## 外部系统调用流程

```
# 1. 生产 SOAP（可选 — 如果外部系统自己生产则跳过）
POST /api/soap/generate-batch
  body: { patients: [{ input: {...}, txCount: 12 }, ...] }
  → 返回每个患者的 notes[] (text + soap + html)

# 2. 存入 batch（补充 patient identity + billing codes + generated SOAP）
POST /api/batch/prebuilt
  body: { mode: "full", patients: BatchPatient[] }
  → 返回 { batchId }

# 3. 确认
POST /api/batch/{batchId}/confirm

# 4. 提交到 MDLand
POST /api/automate/{batchId}
GET /api/automate/{batchId}  ← 轮询状态
```

## 风险评估

- LOW: 纯新增 API + 新增 service，不改现有代码
- 生产逻辑精确复刻 soap-engine.worker.ts，已验证 ROM 单调递增
- prebuilt 直接 saveBatch，confirm + automate 走现有流程
- zod 验证防止 undefined 崩溃（BUG-02 类问题）

## 预估时间: 45-60 min

# MDLand Integration Investigation Results

> Agent 调查完成：MDLand EHR 系统 Note 页面结构信息，用于设计 soap-system 自动集成方案。

## 背景

soap-system 已有完善的 SOAP 笔记生成能力（IE / TX），需要将生成的内容自动填入 MDLand EHR 系统对应字段并保存。之前使用 Tampermonkey JS 脚本直接操作 DOM，非常脆弱。本次调查目标是收集足够信息来设计更健壮的集成方案。

---

## 1. 页面导航路径

- [x] 登录 URL: `https://web153.b.mdland.net/eClinic/clinic_main.aspx`
- [x] ClinicID: 3997, Ver 12.3.1801
- [x] 主界面 → Note 编辑的每一步操作

```
步骤 1: 登录后首页 → URL: https://web153.b.mdland.net/eClinic/clinic_main.aspx
步骤 2: 左侧 Waiting Room (switchWLW(1)) → iframe: waittinglist.aspx (含嵌套 waittinglistshow.aspx)
步骤 3: 搜索患者 (One Patient, 输入DOB如 09/27/1956)
步骤 4: 点击患者visit链接 (moveInMe(n)) → workarea0 加载 ov_doctor_spec.aspx
步骤 5: 左侧 MenuFrame 显示所有菜单项，点击 "PT Note" 或 "ICD/CPT"
```

---

## 2. 页面架构

- [x] **iframe 架构**: 深度嵌套，80+ iframe
- [x] **页面类型**: 传统多页面应用 (ASP.NET WebForms)
- [x] **技术栈**: ASP.NET Classic + jQuery + TinyMCE 3.5.8

```
架构类型: 传统多页面应用 (ASP.NET WebForms)
iframe 嵌套层数: 3-4 层
技术栈: ASP.NET + jQuery + TinyMCE 3.5.8
```

### 2.1 Iframe 层次结构

```
clinic_main.aspx (顶层)
├── waittinglistframe → waittinglist.aspx
│   └── waittinglistFrame → waittinglistshow.aspx (患者列表)
├── workarea0 → ov_doctor_spec.aspx (visit 主页面)
│   ├── MenuFrame (左侧菜单栏, 56+ 菜单项)
│   ├── InfoFrame (右侧信息栏)
│   ├── OfficeVisit (visit主表单, 仅page切换时visible)
│   ├── ptnote → ov_ptnote2018.aspx (PT Note 编辑)
│   ├── diagnose → ov_icdcpt.aspx (ICD/CPT 选择)
│   ├── checkout (结账)
│   ├── chiefComplaint, systemreview, bodydiagram... (其他section)
│   └── 80+ 其他功能iframe
├── workarea1-15 (其他patient tabs)
├── searchframe, searchicdframe, searchcptframe
└── startpageframe
```

### 2.2 关键变量 (workarea0 作用域)

```javascript
nowOVPage     // 当前大分类 (4 = Current Visit)
lastMenuIndex // 最后选中菜单
MenuTitle     // 所有菜单项配置 {Open, Title, ViewOnly, HasSave, Modified, OVPage, RightID, AutoSave}
Menu_PTNote   // = "ptnote"
Menu_ICDCPT   // ICD/CPT 菜单索引
editAble      // 0=只读, 1=可编辑
modified      // 是否有未保存修改
```

---

## 3. Note 编辑区域 — 字段结构

### 3.1 PT Note — SOAP 主体字段

**页面**: `ov_ptnote2018.aspx?patientID={pid}&visitID={vid}&formMode=1&mpatientid={mpid}`
**位置**: `workarea0 > ptnote` iframe

| 区域 | 界面标签 | HTML 元素类型 | 选择器 (id/name) | 编辑器 | 备注 |
|------|----------|--------------|------------------|--------|------|
| Subjective (S) | `<th>Subjective</th>` | textarea | `#SOAPtext0` / name=`SOAPtext0` | TinyMCE (`#SOAPtext0_ifr`) | HTML 内容 |
| Objective (O) | `<th>Objective</th>` | textarea | `#SOAPtext1` / name=`SOAPtext1` | TinyMCE (`#SOAPtext1_ifr`) | HTML 内容 |
| Assessment (A) | `<th>Assessment</th>` | textarea | `#SOAPtext2` / name=`SOAPtext2` | TinyMCE (`#SOAPtext2_ifr`) | HTML 内容 |
| Plan (P) | `<th>Plan</th>` | textarea | `#SOAPtext3` / name=`SOAPtext3` | TinyMCE (`#SOAPtext3_ifr`) | HTML 内容 |
| Notes | `<th>Notes</th>` | textarea | `#SOAPtext4` / name=`SOAPtext4` | TinyMCE (`#SOAPtext4_ifr`) | 附加笔记 |

**设置 TinyMCE 内容的方法:**
```javascript
// 在 ptnote iframe 作用域内:
tinyMCE.getInstanceById("SOAPtext0").setContent("<p>Subjective content here</p>");
tinyMCE.getInstanceById("SOAPtext1").setContent("<p>Objective content here</p>");
tinyMCE.getInstanceById("SOAPtext2").setContent("<p>Assessment content here</p>");
tinyMCE.getInstanceById("SOAPtext3").setContent("<p>Plan content here</p>");
// 设置后标记修改:
modified = 1;
```

### 3.1.1 PT Note 其他字段

| 字段 | HTML 元素类型 | 选择器 | 用途 |
|------|--------------|--------|------|
| 全局模板 | select | `#globalTemplateList` | 全局模板选择 |
| 本地模板 | select | name=`templetList` | 本地模板选择 |
| 模板名称 | input text | name=`subject` | 模板保存时的名称 |
| 模板描述 | textarea + TinyMCE | `#description` / `#description_ifr` | 模板描述 |
| 代码列表1 | select-multiple | `#SelectCodelist` | 选中的代码 |
| 代码列表2 | select-multiple | `#SelectCodelist2` | 选中的代码 |

### 3.2 ICD/CPT — 诊断与代码字段

**页面**: `ov_icdcpt.aspx?patientID={pid}&visitID={vid}&formMode=1&mpatientid={mpid}&SBCount={n}`
**位置**: `workarea0 > diagnose` iframe

#### ICD-10 诊断码

| 字段 | 输入方式 | HTML 元素类型 | 选择器 | 备注 |
|------|----------|--------------|--------|------|
| ICD类型选择 | 下拉 | select | `#icdTypeSelect` | ICD9 / ICD10 |
| ICD搜索框 | 手动输入 | input text | `#currentListCode` | 最少2字符触发搜索 |
| 搜索结果列表 | 下拉 | select | name=`list` | 单击选中，双击添加 |
| ICD模板 | 下拉 | select | `#templateList` | 56个预设模板 |
| 已选ICD (hidden) | 自动 | input hidden | name=`ICDCode` (多个) | 每个已选ICD一个 |
| 已选ICD名 (hidden) | 自动 | input hidden | name=`ICDName` (多个) | 每个已选ICD一个 |
| 搜索方式 | 单选 | radio | name=`Remote` | 1=远程, 0=本地, 2=历史, 3=医疗 |
| 额外ICD | 文本 | textarea | `#otherICD` | 手动输入额外代码 |

**ICD 搜索与添加流程:**
```javascript
// 1. 设置搜索文本
document.ecform.currentListCode.value = "M54.5";

// 2. 触发搜索 (AJAX)
search_by_ajax(1, "M54.5", "1", global_search_tag_icd);
// → 内部调用 search_by_ajax_Common(mode, searchStr, searchby, tag, patientID)

// 3. 搜索结果填入 select[name="list"]

// 4. 添加选中的ICD到visit (两种方式):
// a) 通过列表索引:
addSelection(listIndex);
// b) 直接通过代码:
addSelectionD("Low back pain, unspecified", "M54.50");

// 5. 添加后自动调用:
// → SetModifyICD() (设置 modified=1)
// → addICDToLinkList(code) (关联到CPT)
// → refreshLinkICDStr() (刷新显示)
```

#### CPT 代码

| 字段 | 输入方式 | HTML 元素类型 | 选择器 | 备注 |
|------|----------|--------------|--------|------|
| CPT搜索框 | 手动输入 | input text | `#currentListCode_cpt` | 搜索CPT代码 |
| 搜索结果列表 | 下拉 | select | name=`list_cpt` | 双击添加 |
| CPT模板 | 下拉 | select | `#templateList_cpt` | 124个预设模板 |
| 已选CPT (hidden) | 自动 | input hidden | name=`cpt_code_h` (多个) | 每个已选CPT一个 |
| 已选CPT名 (hidden) | 自动 | input hidden | name=`cpt_text` (多个) | 每个已选CPT一个 |
| Modifier Ma-Md | 文本 | input text | name=`Ma`,`Mb`,`Mc`,`Md` | CPT修饰符 |
| Link ICD | 文本 | input text | name=`LinkICD` | 关联的ICD序号 |
| Units | 文本 | input text | name=`Units` | CPT单位数 |
| 精确搜索 | 复选框 | checkbox | `#chkExactSearch` | 精确匹配模式 |

**CPT 添加流程:**
```javascript
// 通过搜索结果索引添加:
addSelection_cpt(listIndex);
// → 内部调用 addSelectionD_cpt(fullText, text, code)
```

### 3.3 其他关键字段 (visit 头部信息, 只读)

| 字段 | 位置 | 备注 |
|------|------|------|
| Visit Date / DOS | workarea0 顶部 | 如 "07/21/2025", 只读 |
| Provider / 医师 | workarea0 顶部 | 如 "FD → CC", 只读 |
| Insurance | workarea0 顶部 | 如 "HEALTHFIRST", 只读 |
| 患者姓名 | workarea0 顶部 | 如 "CHEN, AIJIN", 只读 |
| 患者DOB/年龄/性别 | workarea0 顶部 | 如 "09/27/1956 69y Female", 只读 |

### 3.4 字段输入行为

**PT Note (TinyMCE 3.5.8):**
- 直接设置 `.value` 对 textarea: **不生效** (TinyMCE 覆盖)
- 必须使用 TinyMCE API: `tinyMCE.getInstanceById("SOAPtext0").setContent(html)`
- 或直接操作 TinyMCE body: `tinyMCE.getInstanceById("SOAPtext0").getBody().innerHTML = html`
- 内容格式: **HTML** (支持 `<br>`, `<span>`, `<strong>`, `<p>` 等)
- 修改后需设置 `modified = 1`
- 无字符数限制

**ICD/CPT:**
- ICD搜索: 设置 `currentListCode.value` + 调用 `search_by_ajax()`
- 添加: 调用 `addSelectionD(name, code)` (自动设置 modified)
- 最多12个ICD (超过12个不能关联CPT link)

---

## 4. 保存机制

### 4.1 PT Note 保存

```
触发: 全局 Save 按钮 (workarea0 的 #SavePage) 或自动保存
函数链: saveIt() → refreshEditAble(saveItCallback) → saveItCallback(1) → OfficeVisit.saveAction()
         → 但对PT Note: letsGo(2) → checkOVItemConflict() → letsGoCallback() → reallySubmit(2)
```

**核心保存函数 `reallySubmit(2)`:**
```javascript
function reallySubmit(action) {
    document.ecform.isAjaxSave.value = "1";
    document.ecform.SOAPtext0.value = tinyMCE.getInstanceById("SOAPtext0").getBody().innerHTML;
    document.ecform.SOAPtext1.value = tinyMCE.getInstanceById("SOAPtext1").getBody().innerHTML;
    document.ecform.SOAPtext2.value = tinyMCE.getInstanceById("SOAPtext2").getBody().innerHTML;
    document.ecform.SOAPtext3.value = tinyMCE.getInstanceById("SOAPtext3").getBody().innerHTML;
    document.ecform.SOAPtext4.value = tinyMCE.getInstanceById("SOAPtext4").getBody().innerHTML;
    $.ajax({
        url: '/eClinic/ov_ptnote2018.aspx',
        type: 'post',
        dataType: 'json',
        data: $("form").serialize(),
        success: function (json) {
            if (json.Success == "1") {
                // 保存成功
                modified = 0;
                parent.SetMenuModified(parent.Menu_PTNote, 0, 1);
                parent.reloadOfficeVisit();
            }
        }
    });
}
```

```
PT Note 保存按钮: workarea0 → div#SavePage (onclick="saveIt()")
保存类型: AJAX POST
URL: /eClinic/ov_ptnote2018.aspx
Content-Type: application/x-www-form-urlencoded (form.serialize())
确认弹窗: 仅冲突时有 ConflictAlert
成功标志: json.Success == "1"
```

### 4.2 ICD/CPT 保存

```
触发: 全局 Save 按钮 或 离开ICD/CPT section时自动保存(AutoSaveIframe)
函数链: letsGo(2) → checkCPTLinkData() → checkOldCPT() → continueSave(2)
```

**核心保存函数 `continueSave(2)`:**
```javascript
function continueSave(action) {
    // 收集所有已选ICD codes
    document.ecform.selectionRes.value = gatherResultICD();    // ICDCode1\nICDCode2\n...
    document.ecform.selectionNameRes.value = gatherNameResultICD();
    document.ecform.formMode.value = action;  // 2 = save

    // 检查 superbill / problem list 选项
    if (document.ecform.chkAddICDToSuperbill.checked)
        document.ecform.saveToSuperbill.value = "1";

    // 提交表单
    document.ecform.submit();  // POST to ov_icdcpt.aspx
}
```

```
ICD/CPT 保存按钮: workarea0 → div#SavePage (same global save)
保存类型: Form POST (整页提交, 非AJAX)
URL: /eClinic/ov_icdcpt.aspx (同页面)
确认弹窗: 无ICD时 confirm("You didn't select any code...")
         已bill时 alert("Billing is created, you can not change ICD/CPT any more.")
成功标志: 页面重新加载
```

### 4.3 自动保存 (AutoSaveIframe)

当切换菜单section时，如果当前section有未保存修改 (`modified == 1`)，自动触发保存:
```javascript
// workarea0 作用域
function AutoSaveIframe(lastMenuIndex) {
    // 检查: ovpage==1, MenuTitle有配置, modified, 有写权限
    // 对 ICDCPT, PTNote 等: 调用 refreshEditAble(AutoSaveIframeCallback, lastIndex)
}
```

---

## 5. Note 类型区分

- [x] **区分方式**: 创建 visit 时在 Waiting Room 弹窗选择
  - "Are you sure you want to open this PT Note?"
  - 选项: `Initial Evaluation Note` / `Re-evaluation Note` / `Progress Note` (radio)
- [x] **字段结构**: IE/TX/Re-eval **共用同一个 PT Note 页面** (`ov_ptnote2018.aspx`)
  - 同样的 SOAPtext0-4 字段
  - 区别仅在 visit 的 subject 字段 ("IE-PT TREATMENT" vs "PT TREATMENT")
- [x] **模板功能**: 有
  - 全局模板: `#globalTemplateList`
  - 本地模板: `name=templetList`
  - 56+ ICD 模板, 124+ CPT 模板

---

## 6. 网络请求分析

### 6.1 PT Note 保存请求

```
URL: /eClinic/ov_ptnote2018.aspx
Method: POST
Content-Type: application/x-www-form-urlencoded
```

Request Payload (form serialized):
```
SOAPtext0=<html content>&SOAPtext1=<html content>&SOAPtext2=<html content>&SOAPtext3=<html content>&SOAPtext4=<html content>&visitID=1007355276&patientID=1002273032&formMode=2&isAjaxSave=1&PageReadTime=...&SelectCodelist=...&SelectCodelist2=...
```

Response:
```json
{
  "Success": "1",
  "dbtime": "2/17/2026 11:37:32 AM"
}
```

### 6.2 ICD 搜索请求

```
URL: 内部AJAX (search_by_ajax_Common)
Method: 推测 POST/GET
参数: mode=1, searchStr, searchby (1=remote, 2=local, 3=history), patientID
```

### 6.3 ICD/CPT 保存请求

```
URL: /eClinic/ov_icdcpt.aspx (同页面)
Method: POST (form submit)
Content-Type: application/x-www-form-urlencoded
参数: selectionRes=M54.50\nM54.51\n..., formMode=2, visitID, patientID, ...
```

### 6.4 其他 API

```
编辑权限检查: POST /eClinic/ov_CheckOVStatus.aspx
参数: clinicid=3997&doctorid=1000017968&visitid=1007355276
响应: {EditAble: 1}
```

---

## 7. 认证与安全

- [x] **认证方式**: ASP.NET Session Cookie (`ASP.NET_SessionId`)
- [x] **CSRF**: ASP.NET ViewState (`__VIEWSTATE`, `__VIEWSTATEGENERATOR`) 仅在 ICD/CPT 页面
- [x] **Session 信息**: `top.g_sessionID`, `top.g_clinicID`, `top.g_doctorID`
- [x] **Visit 锁定**: 编辑时锁定 visit (`document.ecform.locked.value`)
- [x] **权限控制**: `top.HasWrite(RightID)` 检查写权限

---

## 8. 工作流程 (完整操作序列)

### 8.1 标准操作流程

```
1. 进入 visit (moveInMe(n))
2. 点击 "ICD/CPT" (menuButicdcpt.click())
   → 搜索/选择 ICD codes (addSelectionD)
   → 搜索/选择 CPT codes (addSelection_cpt)
   → 点击 Save (saveIt() 或 letsGo(2))
3. 点击 "PT Note" (menuButptnote.click())
   → 填入 SOAP 内容 (TinyMCE setContent)
   → 点击 Save (saveIt() → reallySubmit(2))
4. 点击 "Checkout" (menuButcheckout.click())
   → Generate Billing (仅未bill的visit才有此按钮)
```

### 8.2 菜单点击方式

```javascript
// 通过 MenuFrame 内的按钮点击:
// PT Note:
onclick="parent.MustReturnPage=1;parent.select_ovpage(4);parent.select_page(4,7);parent.Relocal('ptnote',true);"

// ICD/CPT:
onclick="parent.MustReturnPage=1;parent.select_ovpage(4);parent.select_page(5,0);parent.Relocal('icdcpt',true);"

// Checkout:
onclick="parent.select_ovpage(4);parent.select_page(9,0);parent.Relocal('checkout',true);"
```

---

## 9. 已知坑点

1. **关闭确认弹窗**: 点击 Close/离开 visit 时弹出 `confirm("Are you sure you want to close OFFICE VISIT?")` — 如果 dismiss 会关闭visit
2. **Billing 锁定**: 已 bill 的 visit 无法修改 ICD/CPT (`parent.isPassToBill != 0`)
3. **冲突检测**: PT Note 保存时会检查是否有其他用户同时修改 (`checkOVItemConflict`)
4. **TinyMCE 3.5.8**: 非常老的版本, API 为 `tinyMCE.getInstanceById()` 而非 `tinymce.get()`
5. **iframe 深层嵌套**: 操作需要从 `top → workarea0 → 目标iframe`，跨iframe通信全靠 `parent`/`top` 引用
6. **自动保存**: 切换 section 时自动触发 AutoSaveIframe, 可能打断操作
7. **Modified 标志**: 必须设置 `modified = 1` 才能触发保存, 否则 `letsGo(2)` 直接 return
8. **ICD 上限**: 最多12个ICD与CPT关联 (超过12个会warning)
9. **ViewState**: ICD/CPT 页面有 ASP.NET ViewState, form submit 后页面重载

---

## 调查结论

### 推荐集成方案

- [x] **方案 B**: 增强 Tampermonkey / Chrome Extension + soap-system API

**理由:**

1. **API-to-API 不可行**: MDLand 没有公开 REST API。PT Note 保存虽然是 AJAX POST，但需要 ASP.NET Session、ViewState、以及在正确的 iframe 上下文中操作。独立调用 API 需要维护完整的 session 和 cookie，极其复杂。

2. **DOM 操作可行但需改进**:
   - PT Note 使用 TinyMCE 3.5.8，有稳定的 API (`setContent`, `getBody`)
   - ICD/CPT 有明确的添加函数 (`addSelectionD`, `addSelection_cpt`)
   - 保存有明确的函数链 (`reallySubmit`, `letsGo(2)`)
   - 这些函数名和 ID 在 ASP.NET WebForms 中通常比较稳定

3. **推荐方案: Chrome Extension**:
   - 比 Tampermonkey 有更好的 iframe 访问权限
   - 可以注入 content script 到 `mdland.net` 域下所有 frame
   - 与 soap-system API 通信获取生成的 SOAP 内容
   - 一键填入 + 保存

### 集成代码骨架

```javascript
// === 1. 填入 PT Note SOAP 内容 ===
function fillPTNote(soapData) {
  const workarea = top.document.querySelector('iframe[name="workarea0"]');
  const wdoc = workarea.contentDocument;
  const ptFrame = wdoc.querySelector('iframe[name="ptnote"]');
  const pdoc = ptFrame.contentDocument;
  const tinyMCE = pdoc.defaultView.tinyMCE;

  tinyMCE.getInstanceById("SOAPtext0").setContent(soapData.subjective);
  tinyMCE.getInstanceById("SOAPtext1").setContent(soapData.objective);
  tinyMCE.getInstanceById("SOAPtext2").setContent(soapData.assessment);
  tinyMCE.getInstanceById("SOAPtext3").setContent(soapData.plan);

  pdoc.defaultView.modified = 1;
}

// === 2. 添加 ICD codes ===
function addICDCodes(codes) {
  const workarea = top.document.querySelector('iframe[name="workarea0"]');
  const wdoc = workarea.contentDocument;
  const diagFrame = wdoc.querySelector('iframe[name="diagnose"]');
  const ddoc = diagFrame.contentDocument;
  const dwin = ddoc.defaultView;

  codes.forEach(({ name, code }) => {
    dwin.addSelectionD(name, code);
  });
}

// === 3. 添加 CPT codes ===
function addCPTCodes(codes) {
  const workarea = top.document.querySelector('iframe[name="workarea0"]');
  const wdoc = workarea.contentDocument;
  const diagFrame = wdoc.querySelector('iframe[name="diagnose"]');
  const ddoc = diagFrame.contentDocument;
  const dwin = ddoc.defaultView;

  codes.forEach(({ text, code }) => {
    dwin.addSelectionD_cpt(text, text, code);
  });
}

// === 4. 触发保存 ===
function triggerSave() {
  const workarea = top.document.querySelector('iframe[name="workarea0"]');
  const wdoc = workarea.contentDocument;
  wdoc.defaultView.saveIt();
}
```

---

*调查人: Claude Code (Chrome DevTools MCP)*
*调查日期: 2026-02-17*
*MDLand 版本/环境: iClinic Ver 12.3.1801, ClinicID 3997, web153.b.mdland.net*

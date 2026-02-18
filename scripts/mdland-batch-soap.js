// ==UserScript==
// @name         MDLand Batch SOAP V1.0
// @namespace    https://mdland.local/batch-soap
// @version      1.0.0
// @description  MDLand SOAP 笔记批量自动填入脚本 - 从 soap-system 获取预生成的 SOAP 数据
// @author       Auto
// @match        https://*.mdland.net/*
// @match        http://*.mdland.net/*
// @grant        none
// @run-at       document-start
// @require      file:///Users/ping/Desktop/Code/Claude-PT-done/core/mdland-core-config.js
// @require      file:///Users/ping/Desktop/Code/Claude-PT-done/core/mdland-core-utils.js
// @require      file:///Users/ping/Desktop/Code/Claude-PT-done/core/mdland-core-state.js
// @require      file:///Users/ping/Desktop/Code/Claude-PT-done/core/mdland-core-ui.js
// ==/UserScript==

/**
 * MDLand Batch SOAP V1.0
 *
 * 复用 pt-auto-bill-v5 架构: Navigator + Fillers + StateManager + UI
 *
 * 流程:
 *   1. 用户在 soap-system BatchView 生成批次数据
 *   2. 复制 JSON → 粘贴到本脚本面板 (或从 API 获取)
 *   3. 按患者分组 → 逐个 visit 执行:
 *      openVisit → fillICD → fillCPT → saveDiagnose
 *      → fillSOAP → saveSOAP → checkout → closeVisit
 */
(function () {
    'use strict';

    // ============================================
    // 共享模块引用
    // ============================================
    const CONFIG = window.MDLandConfig;
    const Utils = window.MDLandUtils;
    const State = window.MDLandState;
    const UI = window.MDLandUI;

    Utils.Logger.setPrefix('Batch SOAP');
    const { log, warn, error } = Utils.Logger;
    const {
        wait, waitFor, humanWait, smartWait,
        getAllDocs, findInAllDocs, clearDocsCache,
        humanClick, humanInput, safeDispatchEvent,
        interceptDialogs, withRetry
    } = Utils;

    // 拦截弹窗
    interceptDialogs(window);
    if (window.parent !== window) interceptDialogs(window.parent);
    if (window.top !== window) interceptDialogs(window.top);

    // ============================================
    // 脚本配置
    // ============================================
    const SCRIPT_CONFIG = {
        VERSION: '1.0.0',
        THEME: 'bill',
        STORAGE_KEY: 'batch_soap_state_v1',

        // soap-system API 地址
        API_BASE: 'http://150.136.150.184:3001',

        WAIT: {
            SHORT: 500,
            MEDIUM: 1000,
            LONG: 2000,
            PAGE_LOAD: 3000,
            DIALOG: 300
        },

        SELECTORS: {
            WAITING_ROOM: '#mainmenubutton, [title="Waiting Room"]',
            WL_DIV: '#WL',
            ONE_PATIENT_RADIO: 'input[type="radio"][name="listAllPatient"]',
            SEARCH_FRAME: '#frm_searchframe',
            SEARCH_INPUT: '#searchStr',
            SEARCH_BUTTON: '#btnSearch',
            SELECTOR_DIV: '#selectorDiv',
            CLAIM_ROW: 'tr[id^="trt"]',
        }
    };

    // ============================================
    // 屏幕常亮
    // ============================================
    const ScreenWakeLock = {
        wakeLock: null,
        async enable() {
            if (this.wakeLock || !('wakeLock' in navigator)) return;
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
                log('Screen wake lock enabled');
            } catch (e) { /* ignore */ }
        },
        async disable() {
            if (!this.wakeLock) return;
            try { await this.wakeLock.release(); } catch (e) { /* ignore */ }
            this.wakeLock = null;
        }
    };

    // ============================================
    // 状态管理
    // ============================================
    const stateManager = State.createStateManager({
        storageKey: SCRIPT_CONFIG.STORAGE_KEY,
        privacyFields: CONFIG.PRIVACY.EXCLUDE_FROM_STORAGE,
        initialState: {
            batchData: null,
            patientGroups: [],
        }
    });

    // ============================================
    // Session 检测
    // ============================================
    function checkSession() {
        const hasWorkarea = !!top.document.querySelector('iframe[name="workarea0"]');
        const hasSession = !!top.g_sessionID;
        if (!hasWorkarea || !hasSession) {
            throw new Error('SESSION_EXPIRED: Please re-login to MDLand');
        }
    }

    // ============================================
    // Navigator — 页面导航 (复用 pt-auto-bill-v5 + 扩展)
    // ============================================
    const Navigator = {
        async clickWaitingRoom() {
            log('Clicking Waiting Room...');
            const btn = await waitFor(
                () => findInAllDocs(SCRIPT_CONFIG.SELECTORS.WAITING_ROOM),
                { timeout: CONFIG.TIMEOUTS.DEFAULT, desc: 'Waiting Room button' }
            );
            btn.element.click();
            await waitFor(() => {
                const wl = findInAllDocs(SCRIPT_CONFIG.SELECTORS.WL_DIV);
                return wl && wl.element.style.visibility !== 'hidden';
            }, { timeout: CONFIG.TIMEOUTS.DEFAULT, desc: 'Waiting Room visible' });
            log('Waiting Room opened');
            await wait(SCRIPT_CONFIG.WAIT.MEDIUM);
        },

        async clickOnePatient() {
            log('Selecting One Patient...');
            const radio = await waitFor(() => {
                for (const doc of getAllDocs()) {
                    const radios = doc.querySelectorAll(SCRIPT_CONFIG.SELECTORS.ONE_PATIENT_RADIO);
                    for (const r of radios) {
                        if (r.parentElement?.textContent?.includes('One Patient')) {
                            return { element: r, doc };
                        }
                    }
                }
                return null;
            }, { timeout: CONFIG.TIMEOUTS.DEFAULT, desc: 'One Patient radio' });
            radio.element.click();
            await wait(SCRIPT_CONFIG.WAIT.MEDIUM);
        },

        async searchPatient(dob) {
            log(`Searching patient DOB: ${dob}...`);
            const searchInput = await waitFor(() => {
                const frame = findInAllDocs(SCRIPT_CONFIG.SELECTORS.SEARCH_FRAME);
                if (frame?.element?.contentDocument) {
                    const input = frame.element.contentDocument.querySelector(SCRIPT_CONFIG.SELECTORS.SEARCH_INPUT);
                    if (input) return { element: input, doc: frame.element.contentDocument };
                }
                return findInAllDocs(SCRIPT_CONFIG.SELECTORS.SEARCH_INPUT);
            }, { timeout: CONFIG.TIMEOUTS.DEFAULT, desc: 'Search input' });

            await humanInput(searchInput.element, dob);

            const goBtn = await waitFor(() => {
                const frame = findInAllDocs(SCRIPT_CONFIG.SELECTORS.SEARCH_FRAME);
                if (frame?.element?.contentDocument) {
                    const btn = frame.element.contentDocument.querySelector(SCRIPT_CONFIG.SELECTORS.SEARCH_BUTTON);
                    if (btn) return { element: btn, doc: frame.element.contentDocument };
                }
                return findInAllDocs(SCRIPT_CONFIG.SELECTORS.SEARCH_BUTTON);
            }, { timeout: CONFIG.TIMEOUTS.SHORT, desc: 'Go button' });

            goBtn.element.click();

            await waitFor(() => {
                const frame = findInAllDocs(SCRIPT_CONFIG.SELECTORS.SEARCH_FRAME);
                const doc = frame?.element?.contentDocument || document;
                const selector = doc.querySelector(SCRIPT_CONFIG.SELECTORS.SELECTOR_DIV);
                return selector && selector.querySelectorAll('tr[onclick]').length > 0;
            }, { timeout: CONFIG.TIMEOUTS.LONG, desc: 'Search results' });

            log('Search results shown');
            await wait(SCRIPT_CONFIG.WAIT.SHORT);
        },

        async selectPatient(name, dob) {
            log(`Selecting patient: ${name}...`);
            const result = await waitFor(() => {
                const frame = findInAllDocs(SCRIPT_CONFIG.SELECTORS.SEARCH_FRAME);
                const doc = frame?.element?.contentDocument || document;
                const selector = doc.querySelector(SCRIPT_CONFIG.SELECTORS.SELECTOR_DIV);
                if (!selector) return null;

                const rows = selector.querySelectorAll('tr[onclick], tr[ondblclick]');
                for (const row of rows) {
                    const text = row.textContent?.toUpperCase() || '';
                    if (text.includes(dob)) {
                        const nameParts = name.toUpperCase().split(/[\s,]+/).filter(p => p.length > 1);
                        if (nameParts.every(p => text.includes(p))) {
                            const link = row.querySelector('a');
                            return { row, link, doc };
                        }
                    }
                }
                return null;
            }, { timeout: CONFIG.TIMEOUTS.DEFAULT, desc: 'Patient row' });

            if (result.link) {
                result.link.click();
            } else {
                result.row.click();
            }

            await wait(SCRIPT_CONFIG.WAIT.LONG);
            log(`Patient selected: ${name}`);
        },

        /**
         * 打开 Waiting Room 中第 N 个 visit (1-based)
         */
        async openVisitByIndex(index) {
            log(`Opening visit #${index}...`);
            checkSession();

            // 在 waittinglist 中找到 visit 行
            const wlFrame = await waitFor(() => {
                for (const doc of getAllDocs()) {
                    const rows = doc.querySelectorAll(SCRIPT_CONFIG.SELECTORS.CLAIM_ROW);
                    if (rows.length > 0) return { rows, doc };
                }
                return null;
            }, { timeout: CONFIG.TIMEOUTS.DEFAULT, desc: 'Visit rows' });

            // 按时间正序排列, visit index 是 1-based
            const targetRow = wlFrame.rows[index - 1];
            if (!targetRow) {
                throw new Error(`Visit #${index} not found (total: ${wlFrame.rows.length})`);
            }

            // 使用 moveInMe(rowIndex)
            const moveLink = targetRow.querySelector('a[href*="moveInMe"]');
            if (moveLink) {
                moveLink.click();
            } else {
                // 直接调用 moveInMe
                const win = wlFrame.doc.defaultView || window;
                if (win.moveInMe) {
                    win.moveInMe(index);
                } else {
                    targetRow.click();
                }
            }

            // 等待 workarea0 加载 ov_doctor_spec.aspx
            await waitFor(() => {
                const wa0 = top.document.getElementById('workarea0');
                if (!wa0?.contentDocument) return null;
                const url = wa0.contentDocument.location?.href || '';
                return url.includes('ov_doctor_spec') ? wa0 : null;
            }, { timeout: CONFIG.TIMEOUTS.LONG, desc: 'Visit page loaded' });

            log(`Visit #${index} opened`);
            await wait(SCRIPT_CONFIG.WAIT.LONG);
        },

        /**
         * 获取 workarea0 窗口引用
         */
        getWA0() {
            const wa0 = top.document.getElementById('workarea0');
            return wa0?.contentWindow || null;
        },

        /**
         * 获取 OfficeVisit iframe
         */
        getOfficeVisit() {
            const wa0 = this.getWA0();
            if (!wa0?.document) return null;
            const ov = wa0.document.getElementById('OfficeVisit');
            return ov?.contentDocument || null;
        },

        /**
         * 导航到 ICD/CPT 编辑页
         */
        async navigateToICD() {
            log('Navigating to ICD/CPT...');
            const ovDoc = this.getOfficeVisit();
            if (!ovDoc) throw new Error('OfficeVisit iframe not found');

            const icdBtn = ovDoc.getElementById('a_EMR_icdcpt');
            if (!icdBtn) throw new Error('ICD/CPT menu button not found');
            icdBtn.click();

            // 等待 diagnose iframe 加载
            await waitFor(() => {
                const wa0 = this.getWA0();
                if (!wa0?.document) return null;
                const diagFrame = wa0.document.getElementById('diagnose');
                if (!diagFrame?.contentDocument) return null;
                const url = diagFrame.contentDocument.location?.href || '';
                return url.includes('ov_icdcpt') ? diagFrame : null;
            }, { timeout: CONFIG.TIMEOUTS.DEFAULT, desc: 'ICD/CPT page' });

            log('ICD/CPT page loaded');
            await wait(SCRIPT_CONFIG.WAIT.MEDIUM);
        },

        /**
         * 导航到 PT Note 编辑页
         */
        async navigateToPTNote() {
            log('Navigating to PT Note...');
            const ovDoc = this.getOfficeVisit();
            if (!ovDoc) throw new Error('OfficeVisit iframe not found');

            const ptBtn = ovDoc.getElementById('a_EMR_ptnote');
            if (!ptBtn) throw new Error('PT Note menu button not found');
            ptBtn.click();

            // 等待 ptnote iframe 加载
            await waitFor(() => {
                const wa0 = this.getWA0();
                if (!wa0?.document) return null;
                const ptFrame = wa0.document.getElementById('ptnote');
                if (!ptFrame?.contentDocument) return null;
                const url = ptFrame.contentDocument.location?.href || '';
                if (!url.includes('ov_ptnote')) return null;
                // 等待 TinyMCE 初始化
                const ptWin = ptFrame.contentWindow;
                return ptWin?.tinyMCE?.getInstanceById?.('SOAPtext0') ? ptFrame : null;
            }, { timeout: CONFIG.TIMEOUTS.LONG, desc: 'PT Note + TinyMCE' });

            log('PT Note page loaded');
            await wait(SCRIPT_CONFIG.WAIT.MEDIUM);
        },

        /**
         * 导航到 Checkout 页
         */
        async navigateToCheckout() {
            log('Navigating to Checkout...');
            const ovDoc = this.getOfficeVisit();
            if (!ovDoc) throw new Error('OfficeVisit iframe not found');

            const checkoutBtn = ovDoc.getElementById('a_EMR_checkout');
            if (!checkoutBtn) throw new Error('Checkout menu button not found');
            checkoutBtn.click();

            await waitFor(() => {
                const wa0 = this.getWA0();
                if (!wa0?.document) return null;
                const frame = wa0.document.getElementById('checkout');
                if (!frame?.contentDocument) return null;
                const url = frame.contentDocument.location?.href || '';
                return url.includes('checkout') ? frame : null;
            }, { timeout: CONFIG.TIMEOUTS.DEFAULT, desc: 'Checkout page' });

            log('Checkout page loaded');
            await wait(SCRIPT_CONFIG.WAIT.MEDIUM);
        }
    };

    // ============================================
    // ICDFiller — ICD 代码填充
    // ============================================
    const ICDFiller = {
        /**
         * 获取 diagnose iframe document
         */
        getDiagDoc() {
            const wa0 = Navigator.getWA0();
            if (!wa0?.document) return null;
            const diag = wa0.document.getElementById('diagnose');
            return diag?.contentDocument || null;
        },

        getDiagWin() {
            const wa0 = Navigator.getWA0();
            if (!wa0?.document) return null;
            const diag = wa0.document.getElementById('diagnose');
            return diag?.contentWindow || null;
        },

        /**
         * 添加 ICD codes
         * 策略: 优先从备选列表选取，否则 addSelectionD
         */
        async addICDCodes(icdCodes) {
            const diagDoc = this.getDiagDoc();
            const diagWin = this.getDiagWin();
            if (!diagDoc || !diagWin) throw new Error('Diagnose iframe not accessible');

            for (const icd of icdCodes) {
                // 尝试从备选列表找到
                const listEl = diagDoc.querySelector('select[name="list"]');
                let foundInList = false;

                if (listEl) {
                    for (let i = 0; i < listEl.options.length; i++) {
                        if (listEl.options[i].value === icd.code) {
                            listEl.selectedIndex = i;
                            // 触发双击添加
                            if (listEl.ondblclick) {
                                listEl.ondblclick();
                            } else {
                                safeDispatchEvent(listEl, 'dblclick');
                            }
                            foundInList = true;
                            log(`ICD ${icd.code} added from preset list`);
                            break;
                        }
                    }
                }

                if (!foundInList) {
                    // 直接调用 addSelectionD
                    if (diagWin.addSelectionD) {
                        diagWin.addSelectionD(icd.name || icd.code, icd.code);
                        log(`ICD ${icd.code} added via addSelectionD`);
                    } else {
                        throw new Error(`addSelectionD not available for ICD ${icd.code}`);
                    }
                }

                await smartWait('write');
            }

            log(`Added ${icdCodes.length} ICD codes`);
        }
    };

    // ============================================
    // CPTFiller — CPT 代码填充
    // ============================================
    const CPTFiller = {
        getDiagDoc() {
            return ICDFiller.getDiagDoc();
        },

        getDiagWin() {
            return ICDFiller.getDiagWin();
        },

        /**
         * 添加 CPT codes
         * 策略: 优先从备选列表选取，否则 addSelectionD_cpt
         */
        async addCPTCodes(cptCodes) {
            const diagDoc = this.getDiagDoc();
            const diagWin = this.getDiagWin();
            if (!diagDoc || !diagWin) throw new Error('Diagnose iframe not accessible');

            for (const cpt of cptCodes) {
                const listCPT = diagDoc.querySelector('select[name="list_cpt"]');
                let foundInList = false;

                if (listCPT) {
                    for (let i = 0; i < listCPT.options.length; i++) {
                        // 备选列表 value 可能包含 Modifier (如 "9920325")
                        const optValue = listCPT.options[i].value;
                        if (optValue === cpt.code || optValue.startsWith(cpt.code)) {
                            listCPT.selectedIndex = i;
                            if (listCPT.ondblclick) {
                                listCPT.ondblclick();
                            } else {
                                safeDispatchEvent(listCPT, 'dblclick');
                            }
                            foundInList = true;
                            log(`CPT ${cpt.code} added from preset list`);
                            break;
                        }
                    }
                }

                if (!foundInList) {
                    if (diagWin.addSelectionD_cpt) {
                        const name = cpt.name || cpt.code;
                        diagWin.addSelectionD_cpt(name, name, cpt.code);
                        log(`CPT ${cpt.code} added via addSelectionD_cpt`);
                    } else {
                        throw new Error(`addSelectionD_cpt not available for CPT ${cpt.code}`);
                    }
                }

                await smartWait('write');
            }

            // 设置 Units 和 LinkICD
            await this.setUnitsAndLinks(cptCodes);

            log(`Added ${cptCodes.length} CPT codes`);
        },

        /**
         * 设置每个 CPT 的 Units 和 LinkICD
         */
        async setUnitsAndLinks(cptCodes) {
            const diagDoc = this.getDiagDoc();
            if (!diagDoc) return;

            const unitFields = diagDoc.querySelectorAll('input[name="Units"]');
            const linkFields = diagDoc.querySelectorAll('input[name="LinkICD"]');

            // 获取已添加的 ICD 数量来构建 LinkICD
            const icdCount = diagDoc.querySelectorAll('input[name="diag_code_h"]').length;
            const linkICD = Array.from({ length: icdCount }, (_, i) => String(i + 1)).join(',');

            for (let i = 0; i < cptCodes.length; i++) {
                // 找到对应的 CPT 字段 (按已有 CPT 数量倒数)
                const fieldIdx = unitFields.length - cptCodes.length + i;
                if (fieldIdx < 0 || fieldIdx >= unitFields.length) continue;

                // 始终显式设置 Units (不依赖默认值)
                if (unitFields[fieldIdx]) {
                    unitFields[fieldIdx].value = String(cptCodes[i].units || 1);
                    safeDispatchEvent(unitFields[fieldIdx], 'change');
                }

                // 设置 LinkICD
                if (linkFields[fieldIdx]) {
                    linkFields[fieldIdx].value = linkICD;
                    safeDispatchEvent(linkFields[fieldIdx], 'change');
                }
            }

            // 设置修改标记
            const modifiedFields = diagDoc.querySelectorAll('input[name="link_select_modified"]');
            for (const field of modifiedFields) {
                field.value = '1';
            }
        }
    };

    // ============================================
    // SOAPFiller — SOAP 内容填充
    // ============================================
    const SOAPFiller = {
        /**
         * 获取 ptnote iframe
         */
        getPTFrame() {
            const wa0 = Navigator.getWA0();
            if (!wa0?.document) return null;
            const pt = wa0.document.getElementById('ptnote');
            return pt || null;
        },

        getPTWin() {
            const frame = this.getPTFrame();
            return frame?.contentWindow || null;
        },

        /**
         * 文本转 HTML (每行 → <p>content</p>)
         */
        textToHTML(text) {
            if (!text) return '';
            return text
                .split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => {
                    const escaped = line
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;');
                    return `<p>${escaped}</p>`;
                })
                .join('');
        },

        /**
         * 填充 SOAP 四个 section
         */
        async fillSOAP(soap) {
            const ptWin = this.getPTWin();
            if (!ptWin) throw new Error('PT Note window not accessible');

            const tinyMCE = ptWin.tinyMCE;
            if (!tinyMCE) throw new Error('TinyMCE not loaded');

            const sections = [
                { id: 'SOAPtext0', content: soap.subjective, label: 'Subjective' },
                { id: 'SOAPtext1', content: soap.objective, label: 'Objective' },
                { id: 'SOAPtext2', content: soap.assessment, label: 'Assessment' },
                { id: 'SOAPtext3', content: soap.plan, label: 'Plan' },
            ];

            for (const section of sections) {
                const editor = tinyMCE.getInstanceById(section.id);
                if (!editor) {
                    warn(`TinyMCE instance ${section.id} not found`);
                    continue;
                }

                const html = this.textToHTML(section.content);
                editor.setContent(html);
                log(`Filled ${section.label}: ${section.content.substring(0, 50)}...`);
                await smartWait('write');
            }

            // 设置 modified 标记
            ptWin.modified = 1;
            log('SOAP sections filled');
        },

        /**
         * 保存 SOAP (AJAX POST, 无页面重载)
         */
        async saveSOAP() {
            const ptWin = this.getPTWin();
            if (!ptWin) throw new Error('PT Note window not accessible');

            if (ptWin.reallySubmit) {
                ptWin.reallySubmit();
                log('SOAP saved via reallySubmit()');
                await wait(SCRIPT_CONFIG.WAIT.LONG);
            } else {
                throw new Error('reallySubmit function not found');
            }
        }
    };

    // ============================================
    // Biller — Checkout / Generate Billing
    // ============================================
    const Biller = {
        async generateBilling() {
            log('Generating billing...');
            const wa0 = Navigator.getWA0();
            if (!wa0?.document) throw new Error('workarea0 not accessible');

            const checkoutFrame = wa0.document.getElementById('checkout');
            if (!checkoutFrame?.contentWindow) throw new Error('Checkout frame not found');

            const checkoutWin = checkoutFrame.contentWindow;

            // 使用 checkOutOV(2) 完整流程
            if (checkoutWin.checkOutOV) {
                checkoutWin.checkOutOV(2);
            } else if (checkoutWin.doCheckOut) {
                checkoutWin.doCheckOut(2);
            } else {
                throw new Error('checkOutOV/doCheckOut not available');
            }

            // 等待 billing 创建完成
            await waitFor(() => {
                const billingSpan = checkoutFrame.contentDocument?.getElementById('spanPassToBill');
                if (!billingSpan) return null;
                return billingSpan.textContent?.includes('Billing is created') ? billingSpan : null;
            }, { timeout: CONFIG.TIMEOUTS.LONG, desc: 'Billing created' });

            log('Billing generated');
        }
    };

    // ============================================
    // Closer — 关闭 Visit
    // ============================================
    const Closer = {
        async closeVisit() {
            log('Closing visit...');
            const wa0Win = Navigator.getWA0();
            if (!wa0Win) throw new Error('workarea0 not accessible');

            if (wa0Win.closeMe) {
                wa0Win.closeMe(true);  // 跳过所有 confirm
            } else {
                throw new Error('closeMe function not found');
            }

            // 等待 emptyarea 加载
            await waitFor(() => {
                const wa0 = top.document.getElementById('workarea0');
                if (!wa0?.contentDocument) return null;
                const url = wa0.contentDocument.location?.href || '';
                return url.includes('emptyarea') ? wa0 : null;
            }, { timeout: CONFIG.TIMEOUTS.DEFAULT, desc: 'Visit closed' });

            log('Visit closed');
            await wait(SCRIPT_CONFIG.WAIT.LONG);
        }
    };

    // ============================================
    // ICD/CPT 保存 (Manual Save)
    // ============================================
    async function saveDiagnose() {
        log('Saving ICD/CPT (letsGo)...');
        const diagWin = ICDFiller.getDiagWin();
        if (!diagWin) throw new Error('Diagnose window not accessible');

        if (diagWin.letsGo) {
            diagWin.letsGo(2);
        } else {
            throw new Error('letsGo function not found');
        }

        // 等待页面重载完成
        await wait(SCRIPT_CONFIG.WAIT.LONG);
        await waitFor(() => {
            const wa0 = Navigator.getWA0();
            if (!wa0?.document) return null;
            const diag = wa0.document.getElementById('diagnose');
            if (!diag?.contentDocument) return null;
            const url = diag.contentDocument.location?.href || '';
            return url.includes('ov_icdcpt') ? diag : null;
        }, { timeout: CONFIG.TIMEOUTS.LONG, desc: 'ICD/CPT page reloaded' });

        log('ICD/CPT saved');
        await wait(SCRIPT_CONFIG.WAIT.MEDIUM);
    }

    // ============================================
    // 主执行引擎
    // ============================================

    /**
     * 执行单个 visit 任务
     */
    async function executeVisitTask(task, patient, mode) {
        const stepLabel = `${patient.name} Visit #${task.dos} (${task.noteType})`;
        log(`=== Processing: ${stepLabel} ===`);

        try {
            checkSession();

            // Step 1: ICD/CPT (skip in soap-only mode)
            if (mode !== 'soap-only') {
                await Navigator.navigateToICD();
                await ICDFiller.addICDCodes(task.icdCodes);
                await CPTFiller.addCPTCodes(task.cptCodes);
                await saveDiagnose();
            }

            // Step 2: SOAP
            await Navigator.navigateToPTNote();
            await SOAPFiller.fillSOAP(task.generated.soap);
            await SOAPFiller.saveSOAP();

            // Step 3: Checkout / Billing (skip in soap-only mode)
            if (mode !== 'soap-only') {
                await Navigator.navigateToCheckout();
                await Biller.generateBilling();
            }

            // Step 4: Close
            await Closer.closeVisit();

            log(`=== Completed: ${stepLabel} ===`);
            return { success: true };
        } catch (err) {
            error(err, stepLabel);

            // 尝试关闭 visit (best effort)
            try { await Closer.closeVisit(); } catch (e) { /* ignore */ }

            return { success: false, error: err.message };
        }
    }

    /**
     * 处理一个患者的所有 visits
     */
    async function processPatientGroup(patient, isFirst, mode) {
        const { name, dob, visits } = patient;
        log(`Processing patient: ${name} (${visits.length} visits)`);

        // 首次需要打开 Waiting Room
        if (isFirst) {
            await Navigator.clickWaitingRoom();
        }

        await Navigator.clickOnePatient();
        await Navigator.searchPatient(dob);
        await Navigator.selectPatient(name, dob);

        for (let i = 0; i < visits.length; i++) {
            const visit = visits[i];

            if (stateManager.shouldStop()) {
                log('Stop requested');
                break;
            }

            // 跳过已完成或已跳过的任务
            if (visit.status === 'completed' || visit.status === 'skipped') {
                continue;
            }

            // 找到这个 visit 在全局 taskQueue 中的索引
            const taskIdx = findTaskIndex(patient, visit);
            if (taskIdx >= 0) {
                stateManager.updateTask(taskIdx, { status: 'processing' });
                stateManager.setCurrentIndex(taskIdx);
            }

            // 打开 visit
            await Navigator.openVisitByIndex(visit.dos);

            // 执行任务
            const result = await executeVisitTask(visit, patient, mode);

            if (taskIdx >= 0) {
                stateManager.updateTask(taskIdx, {
                    status: result.success ? 'completed' : 'failed',
                    result: result.success ? 'Done' : `Failed: ${result.error}`,
                    error: result.error || null
                });
            }

            // 同患者多 visit: 关闭后重新搜索
            if (i < visits.length - 1 && result.success) {
                await Navigator.searchPatient(dob);
                await Navigator.selectPatient(name, dob);
            }
        }
    }

    /**
     * 在 taskQueue 中找到对应的 task 索引
     */
    function findTaskIndex(patient, visit) {
        const state = stateManager.getState();
        return state.taskQueue.findIndex(t =>
            t.patientName === patient.name &&
            t.dos === visit.dos &&
            t.noteType === visit.noteType
        );
    }

    /**
     * 从批次数据构建任务队列
     */
    function buildTaskQueue(batchData) {
        const tasks = [];
        for (const patient of batchData.patients) {
            for (const visit of patient.visits) {
                tasks.push({
                    patientName: patient.name,
                    dob: patient.dob,
                    dos: visit.dos,
                    noteType: visit.noteType,
                    txNumber: visit.txNumber,
                    bodyPart: visit.bodyPart,
                    status: visit.status === 'done' ? 'pending' : 'skipped',
                    name: `${patient.name} - DOS#${visit.dos} (${visit.noteType}${visit.txNumber ? '#' + visit.txNumber : ''})`,
                    billingId: `${visit.bodyPart}-${visit.noteType}`
                });
            }
        }
        return tasks;
    }

    /**
     * 主运行入口
     */
    async function runTasks() {
        const state = stateManager.getState();
        const batchData = state.batchData || stateManager.getOriginalData();

        if (!batchData || !batchData.patients || batchData.patients.length === 0) {
            UI.showToast('No batch data loaded', { type: 'warning' });
            return;
        }

        stateManager.setRunning(true);
        await ScreenWakeLock.enable();

        const patients = batchData.patients;
        const mode = batchData.mode || 'full';

        try {
            for (let i = 0; i < patients.length; i++) {
                if (stateManager.shouldStop()) break;
                await processPatientGroup(patients[i], i === 0, mode);
            }
        } catch (err) {
            error(err, 'runTasks');
            UI.showToast(`Error: ${err.message}`, { type: 'error' });
        } finally {
            stateManager.setRunning(false);
            await ScreenWakeLock.disable();

            if (stateManager.isAllDone()) {
                UI.showToast('All visits processed!', { type: 'success' });
            }
        }
    }

    // ============================================
    // 数据加载
    // ============================================

    /**
     * 从 API 加载批次数据
     */
    async function loadBatchFromAPI(batchId) {
        try {
            const res = await fetch(`${SCRIPT_CONFIG.API_BASE}/api/batch/${batchId}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Failed to load batch');
            return json.data;
        } catch (err) {
            error(err, 'loadBatchFromAPI');
            throw err;
        }
    }

    /**
     * 从 JSON 字符串加载批次数据
     */
    function loadBatchFromJSON(jsonStr) {
        const data = JSON.parse(jsonStr);
        // 可能是完整 API 响应或直接的 batch 数据
        return data.data || data;
    }

    /**
     * 设置批次数据并初始化任务队列
     */
    function setBatchData(batchData) {
        const tasks = buildTaskQueue(batchData);

        stateManager.updateState({ batchData });
        stateManager.setTaskQueue(tasks, batchData);

        panel.updateFileName(
            `Batch: ${batchData.batchId}`,
            batchData.summary?.totalVisits || tasks.length
        );
        panel.enableRunButton();
        panel.updateStatus(`Loaded ${tasks.length} visits for ${batchData.patients.length} patients`);

        log(`Batch loaded: ${batchData.batchId}, ${tasks.length} tasks`);
    }

    // ============================================
    // UI 初始化
    // ============================================

    let panel = null;

    function initUI() {
        panel = UI.createPanel({
            id: 'mdland-batch-soap-panel',
            theme: SCRIPT_CONFIG.THEME,
            title: 'Batch SOAP',
            version: SCRIPT_CONFIG.VERSION,
            icon: '📋',
            fileAccept: '.json',
            statsConfig: ['total', 'completed', 'failed', 'skipped'],

            onFileUpload(file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const batchData = loadBatchFromJSON(e.target.result);
                        setBatchData(batchData);
                        UI.showToast('Batch data loaded', { type: 'success' });
                    } catch (err) {
                        error(err, 'File upload');
                        panel.updateStatus(`Error: ${err.message}`);
                        UI.showToast('Invalid JSON file', { type: 'error' });
                    }
                };
                reader.readAsText(file);
            },

            onStart() {
                runTasks();
            },

            onStop() {
                stateManager.requestStop();
                panel.updateStatus('Stopping...');
            },

            onClear() {
                stateManager.updateState({ batchData: null });
            },

            onTaskRetry(index) {
                stateManager.resetTask(index);
            },

            onTaskDelete(index) {
                stateManager.removeTask(index);
            }
        });

        // 添加 "Load from API" 按钮
        panel.setCustomContent(`
            <hr class="mdland-divider">
            <div style="display: flex; gap: 8px; margin-top: 8px;">
                <input type="text" id="batch-id-input" placeholder="Batch ID or JSON..."
                    style="flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
                    font-size: 12px; outline: none; font-family: inherit;">
                <button id="batch-load-btn"
                    style="padding: 8px 14px; background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 600;
                    cursor: pointer; white-space: nowrap;">Load</button>
            </div>
        `);

        // 绑定加载按钮
        const loadBtn = panel.element.querySelector('#batch-load-btn');
        const inputEl = panel.element.querySelector('#batch-id-input');

        loadBtn.addEventListener('click', async () => {
            const value = inputEl.value.trim();
            if (!value) return;

            try {
                let batchData;
                if (value.startsWith('{') || value.startsWith('[')) {
                    batchData = loadBatchFromJSON(value);
                } else {
                    panel.updateStatus('Loading from API...');
                    batchData = await loadBatchFromAPI(value);
                }
                setBatchData(batchData);
                inputEl.value = '';
                UI.showToast('Batch loaded', { type: 'success' });
            } catch (err) {
                panel.updateStatus(`Error: ${err.message}`);
                UI.showToast(`Load failed: ${err.message}`, { type: 'error' });
            }
        });

        // Enter 键触发加载
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loadBtn.click();
        });

        panel.bindStateManager(stateManager);
        panel.mount();

        log('Panel mounted');
    }

    // ============================================
    // 启动
    // ============================================

    if (document.readyState === 'complete') {
        initUI();
    } else {
        window.addEventListener('load', initUI);
    }

})();

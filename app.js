import { initTeamWorkspace } from './team-workspace.js?v=1.8.0';
import { initTraining } from './training.js?v=1.8.0';
import { CONFIG } from './pricing-config.js?v=1.8.0';
import { WARRANTY_DATA, WARRANTY_KINDS, WARRANTY_ACTIONS } from './warranty-data.js?v=1.8.0';
import { formatQuoteId, generateQuoteSummary, normalizeMoney, calculateQuote, assessLogistics, reviewLogistics, summarizeLogistics, ACTUAL_COST_FIELDS, SERVICE_LABELS, LOGISTICS_LABELS, quoteTotal, readHistory, escapeHTML, quoteDate, QUOTE_STATUS, parseBackup, mergeRecords, upsertRecord, matchesRecord } from './quote-core.js?v=1.8.0';

import { DRIVER_DATA, DRIVER_EXCLUSIONS, DRIVER_CATEGORIES, matchesDriver } from './driver-data.js?v=1.8.0';

        const newFields = () => ({ schemaVersion: 2, billingStage: 'DIAGNOSIS', logisticsPlan: 'DEDICATED', logisticsFee: '', feeConfirmed: false, routeConfirmed: false, windowConfirmed: false, actualConfirmed: false, actualMinutes: '', actualEngineerMinutes: '', actualHourlyCost: '', actualTravelCost: '', actualOtherCost: '', actualRevenue: '', actualNotes: '', logisticsWindow: '', repairFee: '', repairConfirmed: false, paidAmount: '', logisticsMinutes: '', hourlyCost: '', travelCost: '', logisticsOtherCost: '', targetMargin: '' });
        let state = { ...newFields(),
            device: 'DESKTOP', service: 'IN_STORE', zone: 'ZONE_A',
            urgency: 'NORMAL', source: 'OTHER', warranty: 'OUT',
            specialDiscount: 0,
            contractDiscount: 0,
            manufacturerFee: 0,
            otherFee: 0, // 新增其他費用
            staffName: '', // 新增報價人員
            department: '維修服務部', // 新增部門
            id: crypto.randomUUID().toUpperCase(),
            date: quoteDate(),
            activeTab: 'quote'
        };

        // 歷史紀錄相關常數
        const MAX_HISTORY = 200;
        let historyData = [];
        let storageWarning = '';
        try {
            const raw = localStorage.getItem('yj_quote_history');
            historyData = readHistory(raw, CONFIG, MAX_HISTORY);
            if (raw && (() => { try { const parsed = JSON.parse(raw); return !Array.isArray(parsed) || parsed.length !== historyData.length; } catch { return true; } })()) storageWarning = '歷史資料無法讀取；原始資料未覆寫。請先備份瀏覽器資料。';
        } catch { storageWarning = '瀏覽器儲存空間無法使用，歷史紀錄暫時無法保存。'; }
        function notify(message) { $('app-status').textContent = message; }
        function pricesFor(value) { return value.pricing || CONFIG; }
        function persistHistory(records) {
            if (storageWarning) { notify(storageWarning); return false; }
            try { localStorage.setItem('yj_quote_history', JSON.stringify(records)); return true; }
            catch { notify('儲存失敗，請先匯出備份，並檢查瀏覽器可用空間。'); return false; }
        }

        const $ = (id) => document.getElementById(id);
        let UI = {};

        function init() {
            UI = {
                deviceWrap: $('device-options'), btnInStore: $('btn-IN_STORE'), btnOnSite: $('btn-ON_SITE'),
                distWrap: $('distance-container'), distSelect: $('distance-select'),
                urgencyWrap: $('urgency-options'), btnSourceOwn: $('btn-source-OWN'), btnSourceOther: $('btn-source-OTHER'),
                btnWarrantyIn: $('btn-warranty-IN'), btnWarrantyOut: $('btn-warranty-OUT'),
                specialDiscountInput: $('special-discount-input'),
                contractDiscountInput: $('contract-discount-input'),
                manufacturerFeeInput: $('manufacturer-fee-input'),
                otherFeeInput: $('other-fee-input'), // 新增
                problemInput: $('problem-input'),
                staffNameInput: $('staff-name-input'), // 新增
                departmentSelect: $('department-select'), // 新增
                dispTotal: $('display-total'), dispBase: $('display-inspection'), dispTrans: $('display-transport'),
                dispTransRow: $('display-transport-row'), dispUrg: $('display-urgency'), dispUrgRow: $('display-urgency-row'),
                dispDisc: $('display-discount'), dispDiscRow: $('display-discount-row'),
                dispSpecialDisc: $('display-special-discount'), dispSpecialDiscRow: $('display-special-discount-row'),
                dispContractDisc: $('display-contract-discount'), dispContractDiscRow: $('display-contract-discount-row'),
                dispManufacturerFee: $('display-manufacturer-fee'), dispManufacturerFeeRow: $('display-manufacturer-fee-row'),
                dispOtherFee: $('display-other-fee'), dispOtherFeeRow: $('display-other-fee-row'), // 新增
                dispDate: $('display-date'),
                dispDev: $('display-device-type'), dispWarrantyIcon: $('warranty-indicator'), dispWarrantyText: $('warranty-text'),
                dispService: $('display-service-mode'), dispId: $('display-id'),
                dispStaffName: $('display-staff-name'), // 新增
                dispDepartment: $('display-department'), // 新增
                headDate: $('current-date-header'),
                btnCopy: $('copy-btn'), brandGrid: $('brand-grid'), driverGrid: $('driver-grid'),
                dispProblemContainer: $('display-problem-container'), dispProblemText: $('display-problem-text'),
                historyList: $('history-list'),
            };

            const now = new Date();
            const dateStr = quoteDate(now);
            if (UI.headDate) UI.headDate.innerText = dateStr;
            if (UI.dispDate) UI.dispDate.innerText = dateStr;
            if (UI.dispId) UI.dispId.innerText = formatQuoteId(state.id);

            renderQuoteForm();
            renderWarranties();
            renderDrivers();
            renderHistory(); // 渲染歷史紀錄
            if (storageWarning) notify(storageWarning);
            initWorkspace();
            $('new-quote-btn').onclick = () => {
                if (!confirm('建立新報價將清空目前表單，請先保存需要保留的內容。是否繼續？')) return;
                state = { ...newFields(), device: 'DESKTOP', service: 'IN_STORE', zone: 'ZONE_A', urgency: 'NORMAL', source: 'OTHER', warranty: 'OUT', specialDiscount: 0, contractDiscount: 0, manufacturerFee: 0, otherFee: 0, staffName: state.staffName, department: state.department, id: crypto.randomUUID().toUpperCase(), date: quoteDate() };
                loadHistoryData({ state, problem: '' });
                notify('已建立新報價；原本的歷史與草稿仍保留。');
            };

            $('btn-PICKUP').onclick = () => { if (state.schemaVersion !== 2) { notify('舊版報價保留原計價方式，請建立新報價使用收送方案。'); return; } state.service = 'PICKUP'; render(); };
            UI.btnInStore.onclick = () => { state.service = 'IN_STORE'; render(); };
            UI.btnOnSite.onclick = () => { state.service = 'ON_SITE'; render(); };
            UI.btnSourceOwn.onclick = () => { state.source = 'OWN'; render(); };
            UI.btnSourceOther.onclick = () => { state.source = 'OTHER'; render(); };
            UI.btnWarrantyIn.onclick = () => { state.warranty = 'IN'; render(); };
            UI.btnWarrantyOut.onclick = () => { state.warranty = 'OUT'; render(); };
            UI.btnCopy.onclick = copyToClipboard;

            // 即時監聽輸入框變化
            UI.specialDiscountInput.addEventListener('input', (e) => {
                const val = normalizeMoney(e.target.value);
                e.target.value = e.target.value === '' ? '' : String(val);
                state.specialDiscount = val;
                render();
            });
            UI.manufacturerFeeInput.addEventListener('input', (e) => {
                const val = normalizeMoney(e.target.value);
                e.target.value = e.target.value === '' ? '' : String(val);
                state.manufacturerFee = val;
                render();
            });
            UI.otherFeeInput.addEventListener('input', (e) => {
                const val = normalizeMoney(e.target.value);
                e.target.value = e.target.value === '' ? '' : String(val);
                state.otherFee = val;
                render();
            });
            UI.contractDiscountInput.addEventListener('input', (e) => {
                const val = normalizeMoney(e.target.value);
                e.target.value = e.target.value === '' ? '' : String(val);
                state.contractDiscount = val;
                render();
            });

            UI.problemInput.addEventListener('input', updateProblemDisplay);

            // 新增報價人員與部門監聽
            UI.staffNameInput.addEventListener('input', (e) => {
                state.staffName = e.target.value;
                updateStaffDisplay();
            });
            UI.departmentSelect.addEventListener('change', (e) => {
                state.department = e.target.value;
                updateStaffDisplay();
            });

            render();
            updateStaffDisplay(); // 初始化顯示
        }

        function updateProblemDisplay() {
            const text = UI.problemInput.value.trim();
            if (text) {
                UI.dispProblemContainer.classList.remove('hidden');
                UI.dispProblemText.innerText = text;
            } else {
                UI.dispProblemContainer.classList.add('hidden');
            }
        }

        function updateStaffDisplay() {
            UI.dispStaffName.innerText = state.staffName || '--';
            UI.dispDepartment.innerText = state.department;
        }

        function generateSummary(dataState, problemText, totalText, dateStr) {
            return generateQuoteSummary(dataState,problemText,pricesFor(dataState),dateStr);
        }

        // --- 歷史紀錄功能區 ---

        function currentRecord() {
            if (!state.caseId) {
                let ancestor = state;
                const visited = new Set();
                while (!ancestor.caseId && ancestor.previousQuoteId && !visited.has(ancestor.id)) {
                    visited.add(ancestor.id);
                    const parent = historyData.find(item => item.state.id === ancestor.previousQuoteId);
                    if (!parent) break;
                    ancestor = parent.state;
                }
                state.caseId = ancestor.caseId || ancestor.previousQuoteId || ancestor.id;
            }
            return { timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }),
                state: structuredClone({ ...state, pricing: pricesFor(state) }),
                calculation: calculateQuote(state, pricesFor(state)),
                problem: UI.problemInput.value, total: quoteTotal(state, pricesFor(state)).toLocaleString('zh-TW') };
        }
        function addToHistory(record) {
            let savedRecord = record?.state ? record : currentRecord();
            if (['ACCEPTED', 'DONE'].includes(savedRecord.state.status) && calculateQuote(savedRecord.state, pricesFor(savedRecord.state)).pending.length) {
                notify('仍有待確認項目，不能保存為客戶同意或已完成；請先補齊，或改存草稿。'); return false;
            }
            const previous = historyData.find(item => item.state.id === savedRecord.state.id);
            if (previous && (JSON.stringify(previous.state) !== JSON.stringify(savedRecord.state) || previous.problem !== savedRecord.problem)) {
                state = { ...state, previousQuoteId: state.id, id: crypto.randomUUID().toUpperCase() };
                savedRecord = currentRecord(); render();
            }
            const next = upsertRecord(historyData, savedRecord, MAX_HISTORY);
            if (!persistHistory(next)) return false;
            historyData = next;
            renderHistory();
            notify('報價已保存；修改已存報價會另建單號，保留原始版本。');
            return true;
        }

        function renderHistory() {
            if (!UI.historyList) return;
            UI.historyList.innerHTML = '';
            renderCostReport();

            if (historyData.length === 0) {
                UI.historyList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">尚無紀錄；填寫表單後按「保存報價」。</p>';
                $('history-count').textContent = '0';
                return;
            }

            let visibleCount = 0;
            historyData.forEach((item, index) => {
                if (!matchesRecord(item, $('history-search').value, $('history-status').value)) return;
                visibleCount++;
                const el = document.createElement('div');
                el.className = "p-3 rounded-xl border border-slate-100 bg-slate-50 hover:border-blue-300 hover:bg-blue-50 transition-all group relative";

                // Format: Date Time | Staff | Device | Total
                const deviceName = CONFIG.INSPECTION[item.state.device]?.label || '未知設備';
                const staff = escapeHTML(item.state.staffName || '未具名');

                // 處理故障現象摘要
                let problemSummary = '';
                if (item.problem) {
                    // 取前 15 個字，若超過則加 ...
                    const maxLength = 15;
                    problemSummary = item.problem.length > maxLength
                        ? ' - ' + item.problem.substring(0, maxLength) + '...'
                        : ' - ' + item.problem;
                }

                el.innerHTML = `
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-[10px] font-bold text-slate-400">${escapeHTML(item.timestamp)}</span>
                        <span class="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">${staff}</span>
                    </div>
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-xs font-bold text-slate-700 truncate mr-2" title="${escapeHTML(item.problem || '')}">${deviceName}<span class="text-slate-500 font-normal">${escapeHTML(problemSummary)}</span></span>
                        <span class="text-sm font-black text-slate-900 whitespace-nowrap">NT$ ${escapeHTML(item.total)}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2 break-words">${escapeHTML(item.state.customerName || '未填客戶')} · ${escapeHTML(item.state.deviceModel || '未填型號')} · ${escapeHTML(QUOTE_STATUS[item.state.status] || '草稿')}</p>
                    <div class="flex gap-2">
                        <button onclick="loadHistoryItem(${index})" class="flex-1 bg-blue-100 text-blue-700 text-xs font-bold py-1.5 rounded-lg">載入</button>
                        <button onclick="copyHistoryItem(${index}, this)" class="flex-1 bg-slate-200 text-slate-600 text-xs font-bold py-1.5 rounded-lg hover:bg-slate-300 transition-colors">複製</button>
                        <button onclick="printHistoryItem(${index})" class="flex-1 bg-slate-200 text-slate-600 text-xs font-bold py-1.5 rounded-lg hover:bg-slate-300 transition-colors">列印</button>
                    </div>
                `;
                UI.historyList.appendChild(el);
            });
            if (!visibleCount) UI.historyList.textContent = '沒有符合條件的報價。';
            $('history-count').textContent = String(historyData.length);
        }

        window.loadHistoryItem = (index) => {
            if (!confirm('是否載入此歷史報價？\n目前未儲存的內容將被覆蓋。')) return;
            loadHistoryData(historyData[index]);
        };

        function loadHistoryData(record) {
            state = JSON.parse(JSON.stringify(record.state)); // Deep copy back

            // 手動恢復 UI 輸入框的值
            UI.specialDiscountInput.value = state.specialDiscount || '';
            UI.contractDiscountInput.value = state.contractDiscount || '';
            UI.manufacturerFeeInput.value = state.manufacturerFee || '';
            UI.otherFeeInput.value = state.otherFee || '';
            UI.staffNameInput.value = state.staffName || '';
            UI.departmentSelect.value = state.department || '維修服務部';
            UI.distSelect.value = state.zone;
            state.date ||= record.timestamp?.split(' ')[0]?.replaceAll('/', '-') || quoteDate();
            UI.problemInput.value = record.problem || '';
            state.customerName ||= ''; state.deviceModel ||= ''; state.status ||= 'DRAFT';
            $('customer-name').value = state.customerName;
            $('device-model').value = state.deviceModel;
            $('quote-status').value = state.status;

            // 重新渲染介面
            render();
            updateProblemDisplay();
            updateStaffDisplay();
        }

        window.copyHistoryItem = (index, btnElement) => {
            const record = historyData[index];
            const dateStr = record.state.date || record.timestamp.split(' ')[0];
            const summary = generateSummary(record.state, record.problem, record.total, dateStr);

            navigator.clipboard.writeText(summary).then(() => {
                const originalText = btnElement.innerText;
                const originalClass = btnElement.className;

                btnElement.innerText = "已複製";
                btnElement.className = "flex-1 bg-emerald-100 text-emerald-700 text-xs font-bold py-1.5 rounded-lg transition-colors";

                setTimeout(() => {
                    btnElement.innerText = originalText;
                    btnElement.className = originalClass;
                }, 1500);
            }).catch(() => notify('複製失敗，請確認瀏覽器剪貼簿權限，或改用列印。'));
        };

        window.printHistoryItem = (index) => {
            if(!confirm('列印歷史報價需載入資料，將覆蓋當前未儲存內容。是否繼續？')) return;

            loadHistoryData(historyData[index]);

            // Wait for render
            setTimeout(() => {
                window.print();
            }, 500);
        };

        // --- 結束 歷史紀錄功能區 ---

        function renderQuoteForm() {
            UI.deviceWrap.innerHTML = '';
            Object.keys(CONFIG.INSPECTION).forEach(key => {
                const btn = document.createElement('button');
                btn.type = "button";
                btn.id = `dev-${key}`;
                btn.className = "py-3.5 px-2 rounded-xl text-sm font-bold border-2 transition-all bg-white border-slate-100 text-slate-500 hover:border-blue-200 shadow-sm";
                btn.innerText = CONFIG.INSPECTION[key].label;
                btn.onclick = () => { state.device = key; render(); };
                UI.deviceWrap.appendChild(btn);
            });
            UI.distSelect.innerHTML = '';
            Object.keys(CONFIG.TRANSPORT).forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.innerText = `${CONFIG.TRANSPORT[key].label} (+$${CONFIG.TRANSPORT[key].price})`;
                UI.distSelect.appendChild(opt);
            });
            UI.distSelect.onchange = (e) => { state.zone = e.target.value; render(); };
            UI.urgencyWrap.innerHTML = '';
            Object.keys(CONFIG.URGENCY).forEach(key => {
                const btn = document.createElement('button');
                btn.type = "button";
                btn.id = `urg-${key}`;
                btn.className = "py-3.5 px-2 rounded-xl text-sm font-bold border-2 transition-all bg-white border-slate-100 text-slate-500 hover:border-blue-200 shadow-sm";
                btn.innerText = CONFIG.URGENCY[key].label;
                btn.onclick = () => { state.urgency = key; render(); };
                UI.urgencyWrap.appendChild(btn);
            });
        }

        function renderWarranties() {
            $('warranty-serial-count').textContent = WARRANTY_DATA.filter(brand => brand.kind === 'SERIAL').length;
            $('warranty-service-count').textContent = WARRANTY_DATA.filter(brand => brand.kind !== 'SERIAL').length;
            UI.brandGrid.replaceChildren();
            $('brand-service-grid').replaceChildren();
            WARRANTY_DATA.forEach(brand => {
                const btn = document.createElement('button');
                btn.className = "brand-card bg-white border-2 border-slate-100 p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-2 group";
                btn.onclick = () => {
                    const detail = $('brand-detail');
                    const phoneBtn = $('detail-phone');
                    detail.classList.remove('hidden');
                    $('detail-icon').innerText = brand.icon;
                    $('detail-name').innerText = brand.name;
                    $('detail-type').innerText = `${brand.type} · ${WARRANTY_KINDS[brand.kind]}`;
                    $('detail-note').textContent = brand.note;
                    $('detail-checked').textContent = `入口檢查：${brand.checkedOn}（未輸入實機序號驗證回傳）`;
                    $('detail-link').textContent = WARRANTY_ACTIONS[brand.kind];
                    $('detail-link').href = brand.url;
                    const driver=DRIVER_DATA.find(item=>item.id===brand.id);
                    $('detail-driver').hidden=!driver;
                    $('detail-driver').onclick=()=>{if(driver){$('driver-search').value='';$('driver-category').value='ALL';renderDrivers();window.switchTab('drivers');openDriver(driver);}};
                    const fallback = $('detail-fallback');
                    fallback.classList.toggle('hidden', !brand.fallbackUrl);
                    if (brand.fallbackUrl) {
                        fallback.href = brand.fallbackUrl;
                        fallback.textContent = brand.fallbackLabel || '官方備用入口';
                    } else { fallback.removeAttribute('href'); fallback.textContent = ''; }

                    if (brand.phone) {
                        phoneBtn.href = `tel:${brand.phone}`;
                        phoneBtn.classList.remove('hidden');
                    } else {
                        phoneBtn.classList.add('hidden');
                    }

                    detail.scrollIntoView({ behavior: 'smooth' });
                };
                btn.innerHTML = `<div class="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center font-black">${brand.icon}</div><span class="text-[10px] font-bold text-slate-600 truncate w-full text-center">${brand.name}</span>`;
                const badge = document.createElement('span');
                badge.className = 'text-xs font-bold text-blue-700';
                badge.textContent = WARRANTY_KINDS[brand.kind];
                btn.appendChild(badge);
                (brand.kind === 'SERIAL' ? UI.brandGrid : $('brand-service-grid')).appendChild(btn);
            });
        }

        function openDriver(brand) {
            $('driver-detail').classList.remove('hidden');
            $('driver-icon').textContent=brand.icon;
            $('driver-name').textContent=brand.name;
            $('driver-note').textContent=brand.note;
            $('driver-kind').textContent=brand.kind==='GUIDE'?'官方下載操作指引':brand.categories.map(key=>DRIVER_CATEGORIES[key]).join('、');
            $('driver-host').textContent=`官方網域：${new URL(brand.url).hostname} · 入口核對：${brand.checkedOn}`;
            $('driver-link').href=brand.url;
            $('driver-link').textContent=brand.kind==='GUIDE'?'查看官方下載指引 ↗':'前往原廠驅動頁 ↗';
            $('driver-warranty').href=WARRANTY_DATA.find(item=>item.id===brand.id).url;
            $('driver-detail').scrollIntoView({behavior:'smooth',block:'nearest'});
        }
        function renderDrivers() {
            UI.driverGrid.replaceChildren(); $('driver-guide-grid').replaceChildren();
            const found=DRIVER_DATA.filter(brand=>matchesDriver(brand,$('driver-search').value,$('driver-category').value));
            $('driver-count').textContent=`符合 ${found.length}／${DRIVER_DATA.length} 家（一般入口 ${DRIVER_DATA.filter(item=>item.kind==='DRIVER').length} 家，特殊平台指引 ${DRIVER_DATA.filter(item=>item.kind==='GUIDE').length} 家）`;
            $('driver-empty').hidden=found.length!==0;
            $('driver-guide-section').hidden=!found.some(brand=>brand.kind==='GUIDE');
            found.forEach(brand => {
                const btn = document.createElement('button');
                btn.type='button';
                btn.className = "brand-card bg-white border-2 border-slate-100 p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-2 group";
                btn.onclick = () => openDriver(brand);
                btn.innerHTML = `<div class="w-12 h-12 bg-slate-800 text-white rounded-xl flex items-center justify-center font-black">${escapeHTML(brand.icon)}</div><span class="text-xs font-bold text-slate-600">${escapeHTML(brand.name)}</span><span class="text-xs text-blue-700">${brand.kind==='GUIDE'?'Intel Mac 指引':escapeHTML(brand.categories.map(key=>DRIVER_CATEGORIES[key]).join('／'))}</span>`;
                (brand.kind==='GUIDE'?$('driver-guide-grid'):UI.driverGrid).appendChild(btn);
            });
            $('driver-search').oninput=()=>{$('driver-detail').classList.add('hidden');renderDrivers();};
            $('driver-category').onchange=()=>{$('driver-detail').classList.add('hidden');renderDrivers();};
            $('driver-reset').onclick=()=>{$('driver-search').value='';$('driver-category').value='ALL';$('driver-detail').classList.add('hidden');renderDrivers();};
            $('driver-exclusions').replaceChildren();
            DRIVER_EXCLUSIONS.forEach(item=>{const li=document.createElement('li');li.textContent=`${item.name}：${item.reason}`;$('driver-exclusions').appendChild(li);});
        }

        function render() {
            const config = pricesFor(state);
            UI.dispId.innerText = formatQuoteId(state.id);
            UI.dispDate.innerText = state.date;
            UI.distSelect.value = state.zone;
            document.querySelectorAll('#device-options button').forEach(b => b.classList.remove('btn-active'));
            $(`dev-${state.device}`)?.classList.add('btn-active');
            [UI.btnInStore, UI.btnOnSite, $('btn-PICKUP')].forEach(b => b.classList.remove('btn-active'));
            $(`btn-${state.service}`).classList.add('btn-active');
            renderFulfillment();
            if (state.service === 'ON_SITE') UI.distWrap.classList.remove('hidden');
            else UI.distWrap.classList.add('hidden');

            // 統一使用 btn-active
            document.querySelectorAll('#urgency-options button').forEach(b => b.classList.remove('btn-active'));
            $(`urg-${state.urgency}`)?.classList.add('btn-active');

            // 統一使用 btn-active
            [UI.btnSourceOwn, UI.btnSourceOther].forEach(b => b.classList.remove('btn-active'));
            if (state.source === 'OWN') UI.btnSourceOwn.classList.add('btn-active');
            else UI.btnSourceOther.classList.add('btn-active');

            [UI.btnWarrantyIn, UI.btnWarrantyOut].forEach(b => b.classList.remove('btn-active'));
            if (state.warranty === 'IN') UI.btnWarrantyIn.classList.add('btn-active');
            else UI.btnWarrantyOut.classList.add('btn-active');

            const calculation = calculateQuote(state, config);
            const { basePrice, transPrice, urgPrice, discPrice } = calculation;
            const specialDiscount = state.specialDiscount;
            const manufacturerFee = state.manufacturerFee;
            const otherFee = state.otherFee;
            const contractDiscount = state.contractDiscount;

            // 計算總價 (包含原廠檢測費加項，其他費用加項，扣除折抵)
            let total = quoteTotal(state, config);
            if (total < 0) total = 0; // 避免負數

            UI.dispTotal.innerText = total.toLocaleString('zh-TW');
            $('mobile-total').textContent = total.toLocaleString('zh-TW');
            renderIdentity();
            $('base-fee-label').textContent = calculation.lines[0].label;
            $('transport-fee-label').textContent = calculation.lines[1].label;
            $('urgency-fee-label').textContent = calculation.lines.find(line=>line.key==='urgency').label;
            UI.dispBase.innerText = `$${basePrice.toLocaleString()}`;
            UI.dispDev.innerText = config.INSPECTION[state.device].label;
            UI.dispService.innerText = SERVICE_LABELS[state.service];
            if (transPrice > 0 || (state.service === 'PICKUP' && state.feeConfirmed === true && state.logisticsFee !== '')) { UI.dispTransRow.classList.remove('hidden'); UI.dispTrans.innerText = `$${transPrice.toLocaleString()}`; }
            else UI.dispTransRow.classList.add('hidden');

            if (urgPrice > 0) {
                UI.dispUrgRow.classList.remove('hidden');
                UI.dispUrg.innerText = `+$${urgPrice.toLocaleString()}`;
            } else {
                UI.dispUrgRow.classList.add('hidden');
            }

            // 原廠檢測費顯示
            if (manufacturerFee > 0) {
                UI.dispManufacturerFeeRow.classList.remove('hidden');
                UI.dispManufacturerFee.innerText = `+$${manufacturerFee.toLocaleString()}`;
            } else {
                UI.dispManufacturerFeeRow.classList.add('hidden');
            }

            // 其他費用顯示
            if (otherFee > 0) {
                UI.dispOtherFeeRow.classList.remove('hidden');
                UI.dispOtherFee.innerText = `+$${otherFee.toLocaleString()}`;
            } else {
                UI.dispOtherFeeRow.classList.add('hidden');
            }

            if (discPrice !== 0) {
                UI.dispDiscRow.classList.remove('hidden');
                UI.dispDisc.innerText = discPrice < 0 ? `-$${Math.abs(discPrice).toLocaleString()}` : `+$${discPrice.toLocaleString()}`;
            } else {
                UI.dispDiscRow.classList.add('hidden');
            }

            // 特殊減免顯示
            if (specialDiscount > 0) {
                UI.dispSpecialDiscRow.classList.remove('hidden');
                UI.dispSpecialDisc.innerText = `-$${specialDiscount.toLocaleString()}`;
            } else {
                UI.dispSpecialDiscRow.classList.add('hidden');
            }

            // 合約客戶折抵顯示
            if (contractDiscount > 0) {
                UI.dispContractDiscRow.classList.remove('hidden');
                UI.dispContractDisc.innerText = `-$${contractDiscount.toLocaleString()}`;
            } else {
                UI.dispContractDiscRow.classList.add('hidden');
            }

            UI.dispWarrantyIcon.className = `warranty-dot dot-${state.warranty === 'IN' ? 'green' : 'red'}`;
            UI.dispWarrantyText.innerText = state.warranty === 'IN' ? '保固內' : '已過保';
        }

        window.handlePrint = () => { if (addToHistory()) window.print(); };
        window.switchTab = (tabId) => {
            ['quote', 'warranty', 'drivers', 'team', 'training'].forEach(s => {
                const el = $(`section-${s}`);
                const tab = $(`tab-${s}`);
                if (el) el.classList.add('hidden');
                if (tab) { tab.classList.remove('tab-active'); tab.classList.add('tab-inactive'); }
            });
            $(`section-${tabId}`)?.classList.remove('hidden');
            $('mobile-quote-bar').hidden = tabId !== 'quote';
            $(`tab-${tabId}`)?.classList.replace('tab-inactive', 'tab-active');
        };

        function copyToClipboard() {


            if (!addToHistory()) return;
            const dateStr = state.date;

            const problem = UI.problemInput.value.trim();
            const total = UI.dispTotal.innerText;
            const summary = generateSummary(state, problem, total, dateStr);

            navigator.clipboard.writeText(summary).then(() => {
                const oldHTML = UI.btnCopy.innerHTML;
                UI.btnCopy.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg> 已複製內容`;
                setTimeout(() => UI.btnCopy.innerHTML = oldHTML, 2000);
            }).catch(() => notify('複製失敗，請確認瀏覽器剪貼簿權限，或改用列印。'));
        }

        function renderIdentity() {
            $('display-customer').textContent = state.customerName || '未填寫';
            $('display-model').textContent = state.deviceModel || '未填寫';
            $('display-quote-status').textContent = QUOTE_STATUS[state.status] || '草稿';
        }
        function downloadJSON(value, filename) {
            const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
            const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
            document.body.appendChild(anchor); anchor.click(); anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        function renderCostReport() {
            const report = summarizeLogistics(historyData);
            $('cost-report-caption').textContent = `本機資料：${report.open} 案尚未完成，${report.awaiting} 案已完成但實際成本未核對。每案僅計本機排序最新版本；不受下方搜尋篩選影響。`;
            const rows = $('cost-report-rows'); rows.replaceChildren();
            for (const [key, group] of Object.entries(report.groups)) {
                const tr = document.createElement('tr');
                for (const value of [LOGISTICS_LABELS[key], group.count, group.count ? '$' + Math.floor(group.revenue-group.cost).toLocaleString() : '—', group.count ? group.engineerMinutes.toLocaleString() + ' 分' : '—', group.comparable ? `${group.underestimated} / ${group.comparable}` : '—']) {
                    const td = document.createElement('td'); td.className = 'p-2 border-b whitespace-nowrap'; td.textContent = String(value); tr.appendChild(td);
                }
                rows.appendChild(tr);
            }
        }

        function renderFulfillment() {
            const modern = state.schemaVersion === 2;
            $('fulfillment-controls').hidden = !modern;
            $('legacy-note').hidden = modern;
            $('logistics-controls').hidden = state.service !== 'PICKUP';
            $('repair-controls').hidden = state.billingStage !== 'REPAIR';
            for (const element of document.querySelectorAll('[data-quote-field]')) {
                const value = state[element.dataset.quoteField];
                if (element.type === 'checkbox') element.checked = value === true;
                else if (document.activeElement !== element) element.value = value ?? '';
            }
            const result = calculateQuote(state, pricesFor(state));
            $('quote-completeness').textContent = result.pending.length ? '尚非完整報價：' + result.pending.join('；') : '服務與維修承諾依雙方確認範圍。';
            $('total-caption').textContent = result.pending.length ? '目前項目小計（尚非完整報價）' : '預估總額';
            $('mobile-total-caption').textContent = result.pending.length ? '小計・待確認' : '預估總額';
            $('fulfillment-summary').textContent = state.service === 'PICKUP' ? `${LOGISTICS_LABELS[state.logisticsPlan]}｜取件及回送：${state.logisticsWindow || '待確認'}。收送費含約定取件與回送，不含現場拆裝檢修；優先取件不代表當日修復。` : '';
            const paid = normalizeMoney(state.paidAmount);
            $('previous-quote').textContent = state.previousQuoteId ? `前版單號：${formatQuoteId(state.previousQuoteId)}` : '';
            $('payment-summary').textContent = modern ? `已付 $${paid.toLocaleString()}；${paid > result.total ? '溢付待核對' : '待付'} $${Math.abs(result.total-paid).toLocaleString()}${result.pending.length ? '（依目前小計）' : ''}` : '';
            $('cost-assessment').textContent = assessLogistics(state);
            $('actual-cost-review').textContent = reviewLogistics(state).message;
        }

        function initWorkspace() {
            for (const element of document.querySelectorAll('[data-quote-field]')) {
                element.addEventListener('input', () => {
                    const key = element.dataset.quoteField;
                    if (['logisticsFee', 'logisticsPlan', 'logisticsWindow'].includes(key)) state.feeConfirmed = false;
                    if (['logisticsPlan', 'logisticsWindow'].includes(key)) state.routeConfirmed = false;
                    if (['logisticsPlan', 'logisticsWindow'].includes(key)) state.windowConfirmed = false;
                    if ([...ACTUAL_COST_FIELDS, 'actualNotes', 'logisticsPlan', 'logisticsFee'].includes(key)) state.actualConfirmed = false;
                    if (key === 'repairFee') state.repairConfirmed = false;
                    state[key] = element.type === 'checkbox' ? element.checked : element.type === 'number' ? (element.value === '' ? '' : normalizeMoney(element.value)) : element.value;
                    if (element.type === 'number') element.value = String(state[key]);
                    render();
                });
            }

            for (const [id, key] of [['customer-name','customerName'],['device-model','deviceModel'],['quote-status','status']]) {
                $(id).addEventListener('input', event => { state[key] = event.target.value; renderIdentity(); });
            }
            $('save-quote-btn').onclick = addToHistory;
            $('mobile-save-btn').onclick = addToHistory;
            $('mobile-view-btn').onclick = () => $('quote-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
            $('history-search').oninput = renderHistory;
            $('history-status').onchange = renderHistory;
            const archiveKey='yj_quote_history_archives_v1';
            let clearArmed=false;
            const historyMessage=text=>{ $('history-clear-status').textContent=text; notify(text); };
            $('clear-history-btn').onclick=()=>{
                if(storageWarning) { historyMessage(storageWarning); return; }
                if(!clearArmed) { clearArmed=true; $('clear-history-btn').textContent='確認清空本機歷史'; historyMessage('再次按確認清空。紀錄會先保留在此瀏覽器的還原區，可按「還原上次清空」恢復；草稿與團隊案件不受影響。'); return; }
                clearArmed=false; $('clear-history-btn').textContent='清空歷史';
                try {
                    const raw=localStorage.getItem('yj_quote_history') || '[]';
                    const records=readHistory(raw,CONFIG,MAX_HISTORY);
                    if(!Array.isArray(JSON.parse(raw)) || JSON.parse(raw).length!==records.length) throw new Error('歷史資料有讀取問題，請先下載原始資料備援。');
                    if(!records.length) { historyData=[]; renderHistory(); historyMessage('目前沒有歷史紀錄可清空。'); return; }
                    const archives=JSON.parse(localStorage.getItem(archiveKey) || '[]');
                    if(!Array.isArray(archives)) throw new Error('還原區無法讀取，歷史紀錄未清空。');
                    archives.push({format:'yj-quote-backup',version:1,exportedAt:new Date().toISOString(),records});
                    localStorage.setItem(archiveKey,JSON.stringify(archives));
                    if(!persistHistory([])) return;
                    historyData=[]; renderHistory(); historyMessage(`已清空 ${records.length} 筆本機歷史，可按「還原上次清空」恢復。`);
                } catch(error) { historyMessage(error instanceof Error ? error.message : '清空失敗，請先匯出備份。'); }
            };
            $('restore-history-btn').onclick=()=>{
                if(storageWarning) { historyMessage(storageWarning); return; }
                try {
                    const archives=JSON.parse(localStorage.getItem(archiveKey) || '[]');
                    if(!Array.isArray(archives)) throw new Error('還原區無法讀取。');
                    if(!archives.length) { historyMessage('目前沒有可還原的清空紀錄。'); return; }
                    const incoming=parseBackup(JSON.stringify(archives.at(-1)),CONFIG,MAX_HISTORY);
                    const current=readHistory(localStorage.getItem('yj_quote_history'),CONFIG,MAX_HISTORY);
                    const next=mergeRecords(current,incoming,MAX_HISTORY);
                    if(!persistHistory(next)) return;
                    historyData=next; renderHistory();
                    archives.pop(); localStorage.setItem(archiveKey,JSON.stringify(archives));
                    historyMessage(`已還原上次清空，現在共 ${next.length} 筆；相同單號保留目前版本。`);
                } catch(error) { historyMessage(error instanceof Error ? error.message : '還原失敗。'); }
            };
            $('save-draft-btn').onclick = () => {
                try { localStorage.setItem('yj_quote_draft_v1', JSON.stringify(currentRecord())); notify('草稿已保存於此瀏覽器，下次可按「載入草稿」。'); }
                catch { notify('草稿儲存失敗，請檢查瀏覽器空間。'); }
            };
            $('load-draft-btn').onclick = () => {
                try {
                    const raw = localStorage.getItem('yj_quote_draft_v1');
                    const [draft] = readHistory(raw ? '[' + raw + ']' : '[]', CONFIG, 1);
                    if (!draft) { notify('尚無可用草稿。'); return; }
                    if (!confirm('載入草稿將取代目前表單，是否繼續？')) return;
                    loadHistoryData(draft); notify('已載入草稿。');
                } catch { notify('草稿無法讀取；原始資料未更動。'); }
            };
            $('note-template').onchange = event => {
                if (!event.target.value) return;
                UI.problemInput.value = [UI.problemInput.value.trim(), event.target.value].filter(Boolean).join('\n');
                updateProblemDisplay(); event.target.value = '';
            };
            $('export-backup-btn').onclick = () => {
                if (storageWarning) { notify('歷史資料有讀取問題，請先下載原始資料備援。'); return; }
                downloadJSON({ format: 'yj-quote-backup', version: 1, exportedAt: new Date().toISOString(), records: historyData }, '永捷報價備份-' + quoteDate() + '.json');
                notify('已開始下載備份，請妥善保存；檔案包含報價與客戶稱呼。');
            };
            $('export-raw-btn').onclick = () => {
                try { downloadJSON({ rawHistory: localStorage.getItem('yj_quote_history'), rawDraft: localStorage.getItem('yj_quote_draft_v1') }, '永捷原始資料備援-' + quoteDate() + '.json'); }
                catch { notify('無法讀取本機資料。'); }
            };
            $('import-backup-input').onchange = async event => {
                const file = event.target.files[0];
                if (!file) return;
                try {
                    if (file.size > 2 * 1024 * 1024) throw new Error('備份檔超過 2 MB，請檢查檔案。');
                    const incoming = parseBackup(await file.text(), CONFIG, MAX_HISTORY);
                    const next = mergeRecords(historyData, incoming, MAX_HISTORY);
                    if (!confirm('匯入 ' + incoming.length + ' 筆報價？同單號保留本機版本，完成後共 ' + next.length + ' 筆。')) return;
                    if (persistHistory(next)) { historyData = next; renderHistory(); notify('備份匯入完成，本機已有的同單號報價保持不變。'); }
                } catch (error) { notify(error.message || '匯入失敗；原有資料未更動。'); }
                finally { event.target.value = ''; }
            };
        }
        init();
        initTraining(window.switchTab);
        if(new URLSearchParams(location.search).get('tab')==='training') window.switchTab('training');
        initTeamWorkspace({
            getRecord: currentRecord,
            onOpenRecord(record, meta) {
                loadHistoryData({ ...record, state: { ...newFields(), ...record.state, ...meta.costs, cloudOrgId: meta.orgId, cloudCaseId: meta.caseId, cloudRevision: meta.revision } });
                window.switchTab('quote'); notify(`已載入團隊案件版本 ${meta.revision}；修改後請回「團隊作業」同步。`);
            },
            onSaved(result, meta) {
                loadHistoryData({ ...result.record, state: { ...state, ...result.record.state, cloudOrgId: meta.orgId, cloudCaseId: result.id, cloudRevision: result.revision } });
                notify(`已同步至團隊，報價版本 ${result.revision}。`);
            }
        });

import { normalizeMoney, quoteTotal, readHistory, escapeHTML, quoteDate } from './quote-core.js';

        const CONFIG = {
            INSPECTION: {
                'DESKTOP': { label: '桌上型電腦', price: 500 },
                'LAPTOP': { label: '筆記型電腦', price: 500 },
                'INKJET': { label: '噴墨印表機', price: 400 },
                'LASER': { label: '雷射印表機', price: 400 },
                'SERVER': { label: 'NAS/伺服器', price: 600 },
                'NETWORK': { label: '弱電監控/網路', price: 600 },
                'SOFTWARE': { label: '軟體及遠端', price: 450 },
                'OTHER_IT': { label: '其他資訊產品', price: 400 },
                'DELIVERY': { label: '設備代送費', price: 300 }
            },
            TRANSPORT: {
                'ZONE_A': { label: '市區 (5km內)', price: 300 },
                'ZONE_B': { label: '郊區 (5-15km)', price: 700 },
                'ZONE_C': { label: '偏遠地區 (15km+)', price: 1200 },
                'MOUNTAIN': { label: '特殊山區', price: 3000 },
                'ISLAND': { label: '離島地區', price: 8000 }
            },
            URGENCY: {
                'NORMAL': { label: '一般 (3-5天)', price: 0 },
                'EXPRESS': { label: '急件 (當日)', price: 500 },
                'EMERGENCY': { label: '特急 (假日)', price: 800 }
            },
            SOURCE: {
                'OWN': { label: '購於永捷', price: -200 },
                'OTHER': { label: '購於他處', price: 0 }
            }
        };

        const WARRANTY_DATA = [
            { id: 'Genuine', name: '捷元 Genuine', type: '通路/電腦', icon: 'G', url: 'https://www.genuine.com.tw/Service/guaranteeInfo' },
            { id: 'Weblink', name: '展碁 Weblink', type: '通路代理', icon: 'W', url: 'https://www.weblink.com.tw/service-inpuiry.htm' },
            { id: 'Xander', name: '建達 Xander', type: '通路代理', icon: 'X', url: 'https://www.xander.com.tw/repair/warranty_search.aspx' },
            { id: 'Unitech', name: '精技 Unitech', type: '通路代理', icon: 'U', url: 'https://www.unitech.com.tw/login.aspx' },
            { id: 'Lenovo', name: '聯想 Lenovo', type: '電腦/筆電', icon: 'Le', url: 'https://pcsupport.lenovo.com/tw/zh/warranty-lookup#/' },
            { id: 'ViewSonic', name: 'ViewSonic', type: '螢幕/投影', icon: 'VS', url: 'https://www.viewsonic.com/tw/support/warranty/' },
            { id: 'BenQ', name: 'BenQ 明基', type: '螢幕/電子', icon: 'BQ', url: 'https://www.benq.com/zh-tw/support/registration-warranty/warranty-checker.html' },
            { id: 'Gigabyte', name: '技嘉 GIGABYTE', type: '電腦/零件', icon: 'GA', url: 'https://www.gigabyte.com/tw/Support/Consumer/Warranty/Check' },
            { id: 'Philips', name: '飛利浦 Philips', type: '螢幕/家電', icon: 'Ph', url: 'https://www.philips.com.tw/c-w/support-home/warranty.html?title=' },
            { id: 'AOC', name: 'AOC', type: '螢幕顯示', icon: 'AO', url: 'https://tw.aoc.com/index/explore/route/warranty' },
            { id: 'ADATA', name: '威剛 ADATA', type: '記憶體/SSD', icon: 'AD', url: 'https://www.xpg.com/tw/support/xpg?tab=warranty' },
            { id: 'Kingston', name: '金士頓 Kingston', type: '記憶體/SSD', icon: 'Ki', url: 'https://www.kingston.com/tw/company/warranty' },
            { id: 'Transcend', name: '創見 Transcend', type: '記憶體/SSD', icon: 'Tr', url: 'https://tw.transcend-info.com/support/verification' },
            { id: 'Seagate', name: '希捷 SEAGATE', type: '硬碟', icon: 'SG', url: 'https://www.seagate.com/tw/zh/support/warranty-and-replacements/' },
            { id: 'WD', name: 'WD 西部數據', type: '硬碟', icon: 'WD', url: 'https://support-en.wd.com/app/warrantystatusweb' },
            { id: 'Toshiba', name: '東芝 Toshiba', type: '硬碟', icon: 'To', url: 'https://www.afastor.com/tw/registration_' },
            { id: 'Acer', name: 'Acer 宏碁', type: '電腦/零件', icon: 'AC', url: 'https://dss.acer.com.tw/DSSApp/custservice/MachineQuery_EndUser.jsp', phone: '0800-258-222' },
            { id: 'Apple', name: 'Apple 蘋果', type: '電腦/平板', icon: 'Ap', url: 'https://checkcoverage.apple.com/?locale=zh_TW', phone: '0800-095-988' },
            { id: 'ASUS', name: 'ASUS 華碩', type: '電腦/零件', icon: 'A', url: 'https://www.asus.com/tw/support/warranty-status-inquiry/', phone: '0800-093-456' },
            { id: 'Brother', name: 'Brother 兄弟', type: '印表機', icon: 'B', url: 'https://crm.brother.tw/warranty_searches/new', phone: '0800-600-211' },
            { id: 'Canon', name: 'Canon 佳能', type: '印表機', icon: 'C', url: 'https://www.canon.com.tw/service/service_menu.aspx', phone: '0809-022-888' },
            { id: 'Dell', name: 'DELL 戴爾', type: '電腦/伺服器', icon: 'D', url: 'https://www.dell.com/support/home/zh-tw?app=warranty', phone: '0800-186-971' },
            { id: 'Epson', name: 'Epson 愛普生', type: '印表機', icon: 'E', url: 'https://www.epson-service.com.tw/servmMaintain.page', phone: '0800-212-873' },
            { id: 'HP', name: 'HP 惠普', type: '電腦/印表機', icon: 'HP', url: 'https://support.hp.com/tw-zh/check-warranty', phone: '0800-010-055' },
            { id: 'MSI', name: 'MSI 微星', type: '電腦/零件', icon: 'M', url: 'https://tw.msi.com/page/warranty', phone: '0800-018-880' }
        ];

        const DRIVER_DATA = [
            { id: 'BROTHER', name: 'Brother 兄弟', icon: 'BR', url: 'https://support.brother.com/g/b/productsearch.aspx?c=tw&lang=zh&content=dl' },
            { id: 'CANON', name: 'Canon 佳能', icon: 'CA', url: 'https://tw.canon/zh_TW/support' },
            { id: 'EPSON', name: 'Epson 愛普生', icon: 'EP', url: 'https://www.epson.com.tw/Support/Printers/sh/s1' },
            { id: 'HP', name: 'HP 惠普', icon: 'HP', url: 'https://support.hp.com/tw-zh/drivers/printers' }
        ];

        let state = {
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
        const MAX_HISTORY = 50;
        let historyData = [];
        let storageWarning = '';
        try {
            const raw = localStorage.getItem('yj_quote_history');
            historyData = readHistory(raw, CONFIG, MAX_HISTORY);
            if (raw && (() => { try { const parsed = JSON.parse(raw); return !Array.isArray(parsed) || parsed.length !== historyData.length; } catch { return true; } })()) storageWarning = '歷史資料無法讀取；原始資料未覆寫。請先備份瀏覽器資料。';
        } catch { storageWarning = '瀏覽器儲存空間無法使用，歷史紀錄暫時無法保存。'; }
        function notify(message) { $('app-status').textContent = message; }
        function pricesFor(value) { return value.pricing || CONFIG; }
        function persistHistory() {
            if (storageWarning) { notify(storageWarning); return; }
            try { localStorage.setItem('yj_quote_history', JSON.stringify(historyData)); }
            catch { notify('報價已產生，但歷史紀錄儲存失敗，請另行備份。'); }
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
            if (UI.dispId) UI.dispId.innerText = `YJ-${state.id}`;

            renderQuoteForm();
            renderWarranties();
            renderDrivers();
            renderHistory(); // 渲染歷史紀錄
            if (storageWarning) notify(storageWarning);
            $('new-quote-btn').onclick = () => {
                if (!confirm('建立新報價將清空目前表單，請先複製或列印需要保留的內容。是否繼續？')) return;
                state = { device: 'DESKTOP', service: 'IN_STORE', zone: 'ZONE_A', urgency: 'NORMAL', source: 'OTHER', warranty: 'OUT', specialDiscount: 0, contractDiscount: 0, manufacturerFee: 0, otherFee: 0, staffName: state.staffName, department: state.department, id: crypto.randomUUID().toUpperCase(), date: quoteDate() };
                loadHistoryData({ state, problem: '' });
                notify('已建立新報價。');
            };

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
            const config = pricesFor(dataState);
            const basePrice = config.INSPECTION[dataState.device].price;
            const transPrice = dataState.service === 'ON_SITE' ? config.TRANSPORT[dataState.zone].price : 0;
            const urgPrice = config.URGENCY[dataState.urgency].price;
            const discPrice = config.SOURCE[dataState.source].price;
            const specialDiscount = dataState.specialDiscount;
            const manufacturerFee = dataState.manufacturerFee;
            const otherFee = dataState.otherFee;
            const contractDiscount = dataState.contractDiscount;

            let summary = `【永捷系統科技 - 檢測報價摘要】\n`;
            summary += `----------------------------\n`;
            summary += `報價單號：YJ-${dataState.id}\n`;
            summary += `報價日期：${dateStr}\n`;
            summary += `報價人員：${dataState.staffName || '--'} (${dataState.department})\n`;
            summary += `設備種類：${config.INSPECTION[dataState.device].label}\n`;
            summary += `服務方式：${dataState.service === 'IN_STORE' ? '門市檢測' : '到府檢測 (' + config.TRANSPORT[dataState.zone].label + ')'}\n`;
            summary += `優先等級：${config.URGENCY[dataState.urgency].label}\n`;
            summary += `保固狀態：${dataState.warranty === 'IN' ? '保固內' : '已過保'}\n`;
            summary += `設備來源：${config.SOURCE[dataState.source].label}\n`;

            if (problemText) {
                summary += `故障描述：${problemText}\n`;
            }

            summary += `----------------------------\n`;
            summary += `費用細目：\n`;
            summary += `- 檢測基本費：$${basePrice.toLocaleString()}\n`;
            if (transPrice > 0) summary += `- 服務出勤費：$${transPrice.toLocaleString()}\n`;
            if (urgPrice > 0) summary += `- 優先處理費：$${urgPrice.toLocaleString()}\n`;
            if (manufacturerFee > 0) summary += `- 代送原廠費：$${manufacturerFee.toLocaleString()}\n`;
            if (otherFee > 0) summary += `- 其他加項費：$${otherFee.toLocaleString()}\n`;
            if (discPrice !== 0) summary += `- 客戶折抵額：$${discPrice.toLocaleString()}\n`;
            if (specialDiscount > 0) summary += `- 特殊減免額：$${specialDiscount.toLocaleString()} (需主管核准)\n`;
            if (contractDiscount > 0) summary += `- 合約客戶折抵：$${contractDiscount.toLocaleString()} (手動折抵)\n`;

            summary += `----------------------------\n`;
            summary += `預估總額：NT$ ${totalText}\n`;
            summary += `----------------------------\n`;
            summary += `※ 注意：此報價不含零件耗材費用，最終金額以實際檢測為準。`;

            return summary;
        }

        // --- 歷史紀錄功能區 ---

        function addToHistory() {
            const timestamp = new Date().toLocaleString('zh-TW', { hour12: false });
            const record = {
                timestamp: timestamp,
                state: JSON.parse(JSON.stringify({ ...state, pricing: pricesFor(state) })), // 保存當次價格
                problem: UI.problemInput.value,
                total: UI.dispTotal.innerText
            };

            historyData.unshift(record);
            if (historyData.length > MAX_HISTORY) {
                historyData = historyData.slice(0, MAX_HISTORY);
            }
            persistHistory();
            renderHistory();
        }

        function renderHistory() {
            if (!UI.historyList) return;
            UI.historyList.innerHTML = '';

            if (historyData.length === 0) {
                UI.historyList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">尚無紀錄</p>';
                return;
            }

            historyData.forEach((item, index) => {
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
                    <div class="flex gap-2">
                        <button onclick="loadHistoryItem(${index})" class="flex-1 bg-blue-100 text-blue-700 text-xs font-bold py-1.5 rounded-lg">載入</button>
                        <button onclick="copyHistoryItem(${index}, this)" class="flex-1 bg-slate-200 text-slate-600 text-xs font-bold py-1.5 rounded-lg hover:bg-slate-300 transition-colors">複製</button>
                        <button onclick="printHistoryItem(${index})" class="flex-1 bg-slate-200 text-slate-600 text-xs font-bold py-1.5 rounded-lg hover:bg-slate-300 transition-colors">列印</button>
                    </div>
                `;
                UI.historyList.appendChild(el);
            });
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
            WARRANTY_DATA.forEach(brand => {
                const btn = document.createElement('button');
                btn.className = "brand-card bg-white border-2 border-slate-100 p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-2 group";
                btn.onclick = () => {
                    const detail = $('brand-detail');
                    const phoneBtn = $('detail-phone');
                    detail.classList.remove('hidden');
                    $('detail-icon').innerText = brand.icon;
                    $('detail-name').innerText = brand.name;
                    $('detail-type').innerText = brand.type;
                    $('detail-link').href = brand.url;

                    if (brand.phone) {
                        phoneBtn.href = `tel:${brand.phone}`;
                        phoneBtn.classList.remove('hidden');
                    } else {
                        phoneBtn.classList.add('hidden');
                    }

                    detail.scrollIntoView({ behavior: 'smooth' });
                };
                btn.innerHTML = `<div class="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center font-black">${brand.icon}</div><span class="text-[10px] font-bold text-slate-600 truncate w-full text-center">${brand.name}</span>`;
                UI.brandGrid.appendChild(btn);
            });
        }

        function renderDrivers() {
            DRIVER_DATA.forEach(brand => {
                const btn = document.createElement('button');
                btn.className = "brand-card bg-white border-2 border-slate-100 p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-2 group";
                btn.onclick = () => {
                    $('driver-detail').classList.remove('hidden');
                    $('driver-icon').innerText = brand.icon;
                    $('driver-name').innerText = brand.name;
                    $('driver-link').href = brand.url;
                    $('driver-detail').scrollIntoView({ behavior: 'smooth' });
                };
                btn.innerHTML = `<div class="w-12 h-12 bg-slate-800 text-white rounded-xl flex items-center justify-center font-black">${brand.icon}</div><span class="text-xs font-bold text-slate-600">${brand.name}</span>`;
                UI.driverGrid.appendChild(btn);
            });
        }

        function render() {
            const config = pricesFor(state);
            UI.dispId.innerText = `YJ-${state.id}`;
            UI.dispDate.innerText = state.date;
            UI.distSelect.value = state.zone;
            document.querySelectorAll('#device-options button').forEach(b => b.classList.remove('btn-active'));
            $(`dev-${state.device}`)?.classList.add('btn-active');
            [UI.btnInStore, UI.btnOnSite].forEach(b => b.classList.remove('btn-active'));
            if (state.service === 'IN_STORE') UI.btnInStore.classList.add('btn-active');
            else UI.btnOnSite.classList.add('btn-active');
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

            const basePrice = config.INSPECTION[state.device].price;
            const transPrice = state.service === 'ON_SITE' ? config.TRANSPORT[state.zone].price : 0;
            const urgPrice = config.URGENCY[state.urgency].price;
            const discPrice = config.SOURCE[state.source].price;
            const specialDiscount = state.specialDiscount;
            const manufacturerFee = state.manufacturerFee;
            const otherFee = state.otherFee;
            const contractDiscount = state.contractDiscount;

            // 計算總價 (包含原廠檢測費加項，其他費用加項，扣除折抵)
            let total = quoteTotal(state, config);
            if (total < 0) total = 0; // 避免負數

            UI.dispTotal.innerText = total.toLocaleString();
            UI.dispBase.innerText = `$${basePrice.toLocaleString()}`;
            UI.dispDev.innerText = config.INSPECTION[state.device].label;
            UI.dispService.innerText = state.service === 'IN_STORE' ? '門市檢測' : '到府檢測';
            if (transPrice > 0) { UI.dispTransRow.classList.remove('hidden'); UI.dispTrans.innerText = `$${transPrice.toLocaleString()}`; }
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

        window.handlePrint = () => window.print();
        window.switchTab = (tabId) => {
            ['quote', 'warranty', 'drivers'].forEach(s => {
                const el = $(`section-${s}`);
                const tab = $(`tab-${s}`);
                if (el) el.classList.add('hidden');
                if (tab) { tab.classList.remove('tab-active'); tab.classList.add('tab-inactive'); }
            });
            $(`section-${tabId}`)?.classList.remove('hidden');
            $(`tab-${tabId}`)?.classList.replace('tab-inactive', 'tab-active');
        };

        function copyToClipboard() {


            const now = new Date();
            const dateStr = state.date;

            const problem = UI.problemInput.value.trim();
            const total = UI.dispTotal.innerText;
            const summary = generateSummary(state, problem, total, dateStr);

            navigator.clipboard.writeText(summary).then(() => {
                addToHistory();
                const oldHTML = UI.btnCopy.innerHTML;
                UI.btnCopy.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg> 已複製內容`;
                setTimeout(() => UI.btnCopy.innerHTML = oldHTML, 2000);
            }).catch(() => notify('複製失敗，請確認瀏覽器剪貼簿權限，或改用列印。'));
        }

        init();

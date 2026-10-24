import {QUOTE_DECLARATIONS} from './customer-declaration.js?v=2.0.3';
export function normalizeMoney(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1000000, Math.max(0, Math.trunc(number))) : 0;
}
// Customer-facing reference; the full record ID remains unchanged for storage and synchronization.
export function formatQuoteId(id) {
    let hash=14695981039346656037n;
    for(const byte of new TextEncoder().encode(String(id).toUpperCase())) hash=BigInt.asUintN(64,(hash^BigInt(byte))*1099511628211n);
    return 'YJ-'+hash.toString(36).toUpperCase().padStart(13,'0');
}
export function quoteDate(date = new Date()) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function quoteTotal(state, config) {
    if (state.schemaVersion === 2) return calculateQuote(state, config).total;
    return Math.max(0, config.INSPECTION[state.device].price
        + (state.service === 'ON_SITE' ? config.TRANSPORT[state.zone].price : 0)
        + config.URGENCY[state.urgency].price + config.SOURCE[state.source].price
        + normalizeMoney(state.manufacturerFee) + normalizeMoney(state.otherFee)
        - normalizeMoney(state.specialDiscount) - normalizeMoney(state.contractDiscount));
}
export const SERVICE_LABELS = Object.freeze({ IN_STORE: '門市檢測', ON_SITE: '到府檢測', PICKUP: '客製化收送服務' });
export const SERVICE_DESCRIPTIONS = Object.freeze({
    IN_STORE: '客戶自行送件到門市，不收收送費；檢測費仍依原規則計算。',
    ON_SITE: '工程師到客戶現場檢測，依所選區域沿用原出勤費。後續取回及回送依原約定確認，不會自動加收客製化收送費。',
    PICKUP: '一般安排不適用或需特殊收送時使用。選擇順路排線、專程、優先或外包物流，確認完整取件及回送費；內部成本分析可按需展開。'
});
export const LOGISTICS_LABELS = Object.freeze({ SCHEDULED: '順路排線收送', DEDICATED: '預約專程收送', PRIORITY: '優先收送', COURIER: '外包物流' });
const hasMoney = value => ['number', 'string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1000000;
export const ACTUAL_COST_FIELDS = Object.freeze(['actualMinutes', 'actualEngineerMinutes', 'actualHourlyCost', 'actualTravelCost', 'actualOtherCost', 'actualRevenue']);
export function calculateQuote(state, config) {
    const modern = state.schemaVersion === 2;
    const pickup = state.service === 'PICKUP';
    const repaired = modern && state.billingStage === 'REPAIR';
    const pending = [];
    if (pickup) {
        if (!hasMoney(state.logisticsFee) || state.feeConfirmed !== true) pending.push('收送費尚未確認，未計入不代表免費');
        if (!state.logisticsWindow?.trim() || state.windowConfirmed !== true) pending.push('取件及回送時段尚未確認');
        if (state.logisticsPlan === 'SCHEDULED' && state.routeConfirmed !== true) pending.push('排線尚未確認，不能承諾排線時段');
    }
    if (repaired && (!hasMoney(state.repairFee) || state.repairConfirmed !== true)) pending.push('維修金額尚未取得客戶同意');
    const basePrice = repaired ? (hasMoney(state.repairFee) ? normalizeMoney(state.repairFee) : 0) : config.INSPECTION[state.device].price;
    const transPrice = pickup ? (hasMoney(state.logisticsFee) && state.feeConfirmed === true ? normalizeMoney(state.logisticsFee) : 0)
        : state.service === 'ON_SITE' ? config.TRANSPORT[state.zone].price : 0;
    const urgPrice = config.URGENCY[state.urgency].price;
    const discount = config.SOURCE[state.source].price;
    const discPrice = modern ? (repaired || state.device === 'DELIVERY' ? 0 : Math.max(-basePrice, discount)) : discount;
    const lines = [
        { key: 'base', label: repaired ? '維修費（不另加檢測費）' : '檢測基本費', amount: basePrice },
        { key: 'transport', label: pickup ? '收送費（含約定取件及回送）' : '到府出勤費', amount: transPrice },
        { key: 'urgency', label: config.URGENCY[state.urgency].label, amount: urgPrice },
        { key: 'source', label: modern ? '購於永捷檢測折抵' : '客戶折抵額', amount: discPrice },
        { key: 'manufacturer', label: '原廠費用加項', amount: normalizeMoney(state.manufacturerFee) },
        { key: 'other', label: '其他加項費', amount: normalizeMoney(state.otherFee) },
        { key: 'special', label: '特殊減免額（需主管核准）', amount: -normalizeMoney(state.specialDiscount) },
        { key: 'contract', label: '合約折抵', amount: -normalizeMoney(state.contractDiscount) }
    ];
    if (pickup && state.device === 'DELIVERY') pending.push('代送費與客戶收送費可能重疊，請確認服務範圍');
    return { lines, total: Math.max(0, lines.reduce((sum, line) => sum + line.amount, 0)), pending, basePrice, transPrice, urgPrice, discPrice, repaired };
}
export function assessLogistics(state) {
    if (state.service !== 'PICKUP') return '請選擇客製化收送服務後評估收送成本。';
    if (!['logisticsMinutes', 'hourlyCost', 'travelCost', 'logisticsOtherCost', 'targetMargin', 'logisticsFee'].every(key => hasMoney(state[key])) || state.feeConfirmed !== true)
        return '成本資料未齊：空白代表未知，請輸入完整週期的工時、成本及已確認收送費。';
    const margin = Number(state.targetMargin);
    if (margin >= 100) return '目標毛利率必須小於 100%。';
    const cost = Number(state.logisticsMinutes) / 60 * Number(state.hourlyCost) + Number(state.travelCost) + Number(state.logisticsOtherCost);
    const minimum = Math.ceil(cost / (1 - margin / 100));
    return `預估收送成本 $${Math.ceil(cost).toLocaleString()}；達標收費 $${minimum.toLocaleString()}；收入減估計成本 $${Math.floor(Number(state.logisticsFee) - cost).toLocaleString()}。${Number(state.logisticsFee) < minimum ? '低於目標，請調整方案或交主管評估。' : '達到填入的成本目標，仍須確認排程與客戶同意。'}此為成本分攤估計，非公司淨利或外包現金節省。`;
}
export function reviewLogistics(state) {
    if (state.service !== 'PICKUP') return { ready: false, message: '結案成本核對適用於客製化收送服務。' };
    if (!ACTUAL_COST_FIELDS.every(key => hasMoney(state[key]))) return { ready: false, message: '實際資料未齊：請填人員總分鐘、其中工程師分鐘、平均每小時成本、交通、其他成本及實際收送淨收入；沒有費用請填 0。' };
    if (Number(state.actualEngineerMinutes) > Number(state.actualMinutes)) return { ready: false, message: '工程師分鐘不能大於人員總分鐘（工程師已包含在總工時內，不重複加計）。' };
    const cost = Number(state.actualMinutes) / 60 * Number(state.actualHourlyCost) + Number(state.actualTravelCost) + Number(state.actualOtherCost);
    const revenue = Number(state.actualRevenue);
    const contribution = revenue - cost;
    const margin = revenue > 0 ? contribution / revenue * 100 : null;
    const estimateKnown = ['logisticsMinutes', 'hourlyCost', 'travelCost', 'logisticsOtherCost'].every(key => hasMoney(state[key]));
    const estimatedCost = estimateKnown ? Number(state.logisticsMinutes) / 60 * Number(state.hourlyCost) + Number(state.travelCost) + Number(state.logisticsOtherCost) : null;
    const variance = estimatedCost === null ? null : cost - estimatedCost;
    const checked = state.actualConfirmed === true;
    return { ready: checked, cost, revenue, contribution, margin, estimatedCost, variance, engineerMinutes: Number(state.actualEngineerMinutes),
        message: `${checked ? '已核對' : '尚未核對，僅供試算'}：實際收送成本 $${Math.ceil(cost).toLocaleString()}；收送淨收入 $${revenue.toLocaleString()}；收入減分攤成本 $${Math.floor(contribution).toLocaleString()}；毛利率 ${margin === null ? '無收入，無法計算' : margin.toFixed(1) + '%'}；工程師 ${Number(state.actualEngineerMinutes).toLocaleString()} 分鐘。${variance === null ? '本版預估成本未齊，無法比較。' : `較本版預估${variance >= 0 ? '增加' : '減少'} $${Math.ceil(Math.abs(variance)).toLocaleString()}。`}不代表整案淨利，也不等同可節省的薪資現金。` };
}

// Join revision chains (including branches) before selecting the first record in local history order.
// Persisted caseId keeps the chain linked when older versions fall outside the history capacity.
export function summarizeLogistics(records) {
    const parents = new Map();
    const find = id => {
        if (!parents.has(id)) parents.set(id, id);
        let root = id;
        while (parents.get(root) !== root) root = parents.get(root);
        let next;
        while (parents.get(id) !== id) { next = parents.get(id); parents.set(id, root); id = next; }
        return root;
    };
    for (const { state } of records) {
        find(state.id);
        for (const key of ['caseId', 'previousQuoteId']) if (typeof state[key] === 'string' && state[key]) {
            const left = find(state.id), right = find(state[key]);
            if (left !== right) parents.set(left, right);
        }
    }
    const seen = new Set();
    const groups = Object.fromEntries(Object.keys(LOGISTICS_LABELS).map(key => [key, { count: 0, revenue: 0, cost: 0, engineerMinutes: 0, underestimated: 0, comparable: 0 }]));
    let awaiting = 0, open = 0;
    for (const { state } of records) {
        const root = find(state.id);
        if (seen.has(root)) continue;
        seen.add(root);
        if (state.service !== 'PICKUP' || state.status === 'CANCELLED') continue;
        if (state.status !== 'DONE') { open++; continue; }
        const result = reviewLogistics(state);
        if (!result.ready || !Object.hasOwn(groups, state.logisticsPlan)) { awaiting++; continue; }
        const group = groups[state.logisticsPlan];
        group.count++; group.revenue += result.revenue; group.cost += result.cost; group.engineerMinutes += result.engineerMinutes;
        if (result.variance !== null) { group.comparable++; if (result.variance > 0) group.underestimated++; }
    }
    return { groups, awaiting, open };
}
export function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
export function readHistory(raw, config, limit = 50) {
    let records;
    try { records = JSON.parse(raw || '[]'); } catch { return []; }
    if (!Array.isArray(records)) return [];
    return records.filter(record => {
        const state = record?.state;
        return state && ['INSPECTION', 'TRANSPORT', 'URGENCY', 'SOURCE'].every((group, index) =>
            Object.hasOwn(config[group], state[['device', 'zone', 'urgency', 'source'][index]]))
            && Object.hasOwn(SERVICE_LABELS, state.service)
            && (state.schemaVersion === undefined || state.schemaVersion === 2)
            && (state.service !== 'PICKUP' || (state.schemaVersion === 2 && Object.hasOwn(LOGISTICS_LABELS, state.logisticsPlan)))
            && (state.schemaVersion !== 2 || ['DIAGNOSIS', 'REPAIR'].includes(state.billingStage))
            && ['IN', 'OUT'].includes(state.warranty)
            && typeof state.id === 'string' && typeof record.timestamp === 'string'
            && typeof record.problem === 'string' && ['string', 'number'].includes(typeof record.total);
    }).slice(0, limit).map(record => {
        const state = { ...record.state };
        if (state.schemaVersion === 2) {
            for (const key of ['logisticsFee', 'repairFee', 'paidAmount', 'logisticsMinutes', 'hourlyCost', 'travelCost', 'logisticsOtherCost', 'targetMargin', ...ACTUAL_COST_FIELDS]) state[key] = hasMoney(state[key]) ? Number(state[key]) : '';
            for (const key of ['feeConfirmed', 'routeConfirmed', 'windowConfirmed', 'repairConfirmed', 'actualConfirmed']) state[key] = state[key] === true;
            state.logisticsWindow = typeof state.logisticsWindow === 'string' ? state.logisticsWindow.slice(0, 500) : '';
            state.actualNotes = typeof state.actualNotes === 'string' ? state.actualNotes.slice(0, 500) : '';
        }
        for (const key of ['caseId', 'previousQuoteId']) if (typeof state[key] !== 'string' || !state[key] || state[key].length > 100) delete state[key];
        for (const key of ['specialDiscount', 'contractDiscount', 'manufacturerFee', 'otherFee']) state[key] = normalizeMoney(state[key]);
        state.staffName = typeof state.staffName === 'string' ? state.staffName.slice(0, 100) : '';
        state.customerName = typeof state.customerName === 'string' ? state.customerName.slice(0,100) : '';
        state.deviceModel = typeof state.deviceModel === 'string' ? state.deviceModel.slice(0,160) : '';
        state.status = Object.hasOwn(QUOTE_STATUS, state.status) ? state.status : 'DRAFT';
        state.department = typeof state.department === 'string' ? state.department : '維修服務部';
        // Only retain complete numeric price snapshots matching known configuration keys.
        if (state.pricing) {
            const valid = Object.entries(config).every(([group, options]) => Object.keys(options).every(key => {
                const item = state.pricing[group]?.[key];
                return item && typeof item.label === 'string' && Number.isFinite(item.price) && Math.abs(item.price) <= 1000000;
            }));
            if (!valid) delete state.pricing;
        }
        return { ...record, state };
    });
}
export const QUOTE_STATUS = Object.freeze({ DRAFT: '草稿', QUOTED: '已報價', ACCEPTED: '客戶同意', DONE: '已完成', CANCELLED: '已取消' });

export function upsertRecord(records, record, limit = 200) {
    return [record, ...records.filter(item => item.state.id !== record.state.id)].slice(0, limit);
}

export function mergeRecords(existing, incoming, limit = 200) {
    const seen = new Set();
    const merged = [...existing, ...incoming].filter(record => {
        if (seen.has(record.state.id)) return false;
        seen.add(record.state.id); return true;
    });
    if (merged.length > limit) throw new Error(`合併後超過 ${limit} 筆上限；請先備份並分批處理，原有資料未更動。`);
    return merged;
}

export function matchesRecord(record, query = '', status = '') {
    if (status && (record.state.status || 'DRAFT') !== status) return false;
    const text = [record.state.id, 'YJ-'+record.state.id, formatQuoteId(record.state.id), record.state.customerName, record.state.deviceModel, record.state.staffName,
        record.state.department, record.problem, record.timestamp].join(' ').toLocaleLowerCase();
    return query.trim().toLocaleLowerCase().split(/\s+/).every(term => text.includes(term));
}

export function parseBackup(raw, config, limit = 200) {
    let backup;
    try { backup = JSON.parse(raw); } catch { throw new Error('不是有效的 JSON 備份檔。'); }
    if (!backup || backup.format !== 'yj-quote-backup' || backup.version !== 1 || !Array.isArray(backup.records)) {
        throw new Error('備份格式或版本不支援，請選擇本程式匯出的備份。');
    }
    if (backup.records.length > limit) throw new Error(`備份超過 ${limit} 筆上限，原有資料未更動。`);
    const records = readHistory(JSON.stringify(backup.records), config, limit);
    if (records.length !== backup.records.length) throw new Error('備份含不完整的報價，未匯入任何資料。');
    records.forEach((record, index) => {
        if (backup.records[index].state.pricing && !record.state.pricing) throw new Error('備份價格資料無效，未匯入任何資料。');
        if (record.state.pricing && Number(String(record.total).replaceAll(',', '')) !== quoteTotal(record.state, record.state.pricing)) {
            throw new Error('備份總額與明細不一致，未匯入任何資料。');
        }
    });
    return records;
}

export function generateQuoteSummary(dataState, problemText, config, dateStr) {
 const c=calculateQuote(dataState,config),paid=normalizeMoney(dataState.paidAmount);
 return [
 '【永捷檢測報價】',
 '報價單號：'+formatQuoteId(dataState.id),
 ...(dateStr?['日期：'+dateStr]:[]),
 ...(dataState.customerName?['客戶：'+dataState.customerName]:[]),
 '',
 '【服務內容】',
 '設備：'+(dataState.deviceModel || config.INSPECTION[dataState.device].label),
 '服務：'+SERVICE_LABELS[dataState.service],
 ...(problemText?.trim()?['故障現象：'+problemText.trim()]:[]),
 ...(dataState.service==='IN_STORE'?['客戶自行送件到門市，不收收送費；檢測費依本單約定。']:[]),
 ...(dataState.service==='ON_SITE'?['到府檢測按本單收取出勤費；後續取回及回送依原約定確認，新增費用須先取得同意。']:[]),
 ...(dataState.service==='PICKUP'?['收送：'+LOGISTICS_LABELS[dataState.logisticsPlan],'取件／回送：'+(dataState.logisticsWindow||'待確認'),'收送不含現場拆裝檢修；優先取件不代表當日修復。']:[]),
 '',
 '【費用明細】',
 ...c.lines.filter(l=>l.amount||l.key==='base').map(l=>(l.key==='special'?'優惠折讓':l.label)+'：'+(l.amount<0?'−':'')+'$'+Math.abs(l.amount).toLocaleString('zh-TW')),
 (c.pending.length?'目前小計（尚有待確認項目）':'預估合計')+'：NT$ '+c.total.toLocaleString('zh-TW')+'（含稅）',
 ...(paid>0?['已收紀錄：$'+paid.toLocaleString()+'；'+(paid>c.total?'溢付待核對':'預估待付')+'：$'+Math.abs(c.total-paid).toLocaleString()]:[]),
 ...(c.pending.length?['待確認：'+c.pending.join('；')]:[]),
 '',
 '【報價聲明】',
 ...QUOTE_DECLARATIONS.map((text,index)=>(index+1)+'. '+text),
 ].join('\n');
}

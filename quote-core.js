export function normalizeMoney(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1000000, Math.max(0, Math.trunc(number))) : 0;
}
export function quoteDate(date = new Date()) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function quoteTotal(state, config) {
    return Math.max(0, config.INSPECTION[state.device].price
        + (state.service === 'ON_SITE' ? config.TRANSPORT[state.zone].price : 0)
        + config.URGENCY[state.urgency].price + config.SOURCE[state.source].price
        + normalizeMoney(state.manufacturerFee) + normalizeMoney(state.otherFee)
        - normalizeMoney(state.specialDiscount) - normalizeMoney(state.contractDiscount));
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
            && ['IN_STORE', 'ON_SITE'].includes(state.service)
            && ['IN', 'OUT'].includes(state.warranty)
            && typeof state.id === 'string' && typeof record.timestamp === 'string'
            && typeof record.problem === 'string' && ['string', 'number'].includes(typeof record.total);
    }).slice(0, limit).map(record => {
        const state = { ...record.state };
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
    const text = [record.state.id, record.state.customerName, record.state.deviceModel, record.state.staffName,
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

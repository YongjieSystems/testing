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
        state.staffName = typeof state.staffName === 'string' ? state.staffName : '';
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

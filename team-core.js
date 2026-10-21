export const TEAM_ROLES = Object.freeze({ MANAGER:'主管', STAFF:'客服／行政', ENGINEER:'工程師', DRIVER:'收送人員' });
export const PRIVATE_COST_FIELDS = Object.freeze(['logisticsMinutes','hourlyCost','travelCost','logisticsOtherCost','targetMargin','actualMinutes','actualEngineerMinutes','actualHourlyCost','actualTravelCost','actualOtherCost','actualRevenue','actualNotes','actualConfirmed']);
export function teamPayload(record,manager=false) {
    const state={...record.state};
    const costs=manager ? Object.fromEntries(PRIVATE_COST_FIELDS.filter(key=>state[key]!==undefined).map(key=>[key,state[key]])) : null;
    for (const key of PRIVATE_COST_FIELDS) delete state[key];
    // Server reconstructs this data and computes the total from its own pricebook.
    for (const key of ['pricing','cloudCaseId','cloudRevision','cloudOrgId']) delete state[key];
    return {record:{state,problem:record.problem},costs};
}
export function teamError(error) {
    if(error?.message==='Invalid login credentials') return '帳號或密碼不正確。請核對信箱拼字、英文大小寫；忘記密碼可按「忘記密碼／寄送重設信」。';
    if(error?.code==='over_email_send_rate_limit') return '重設信寄送過於頻繁，請稍候再試，並只使用最新一封信。';
    if(['40001','PT409'].includes(error?.code)) return '有人已更新同一筆資料。你的表單尚未送出；請先保留內容，再重新載入最新版本。';
    if(error?.code==='42501') return '權限不足或帳號已停用。請重新整理登入狀態，必要時聯絡主管。';
    return typeof error?.message==='string' ? error.message : '連線未完成；目前表單內容仍保留，請稍後重試。';
}
export function localToIso(value) {
    if(!value || !Number.isFinite(new Date(value).getTime())) throw new Error('請填有效日期及時間');
    const taipei=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) ? value+'+08:00' : value;
    return new Date(taipei).toISOString();
}

export function teamFetch(input,init={}) {
    const deadline=AbortSignal.timeout(20000);
    return fetch(input,{...init,signal:init.signal ? AbortSignal.any([init.signal,deadline]) : deadline});
}

export function isoToTaipeiInput(value) {
    const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
    const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

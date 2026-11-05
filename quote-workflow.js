// Shared employee workflow helpers. No prices, roles or approval rules are changed here.
export const FAULT_TEMPLATES = ['無法開機。','開機後沒有畫面。','系統速度緩慢。','使用時當機或自動重新啟動。','無法列印。','網路連線不穩。'];
export const NOTE_TEMPLATES = ['請於處理前聯繫確認資料備份需求。','若需增加服務或更換零件，將另行說明費用並取得同意。','交付時間另行約定，請於取件前先聯繫。'];
export const RENTAL_TEMPLATES = ['設備規格與配件依本次報價約定交付。','送裝與回收依本次約定地點及時段安排。','續租或提前歸還，請先聯繫確認費用與安排。'];
export function appendTemplate(current, added, limit=4000) {
 const base=String(current || ''), text=String(added || '').trim();
 if(!text || base.split('\n').some(line=>line.trim()===text))return base;
 const next=base+(base && !base.endsWith('\n')?'\n':'')+text;
 if(next.length>limit)throw Error('加入後超過字數上限，請先精簡文字；原內容已保留。');
 return next;
}
export function taipeiToday(now=new Date()) {return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function validDay(value) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value || ''))return false;
 const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===value;
}
export function dateHints({start='',end='',validUntil='',today=taipeiToday(),lines=[]}={}) {
 const errors=[],warnings=[];
 for(const [label,value] of [['起租日期',start],['歸還日期',end],['報價有效期限',validUntil]])if(value && !validDay(value))errors.push(label+'格式不正確');
 if(validDay(start)&&validDay(end)) {
  if(end<start)errors.push('歸還日期不可早於起租日期');
  const max=new Date(start+'T00:00:00Z');max.setUTCFullYear(max.getUTCFullYear()+3);
  if(end>max.toISOString().slice(0,10))errors.push('租期不可超過3年');
 }
 if(validDay(validUntil)&&validUntil<today)warnings.push('報價有效期限已過，請確認是否更新');
 if(validDay(start)&&start<today)warnings.push('起租日期已過，請確認是否為補登案件');
 lines.forEach((line,index)=>{
  const a=line.start||start,b=line.end||end;
  if((line.start&&!validDay(line.start))||(line.end&&!validDay(line.end)))errors.push('第'+(index+1)+'項日期格式不正確');
  if(validDay(a)&&validDay(b)){if(b<a)errors.push('第'+(index+1)+'項歸還日期不可早於起租日期');const max=new Date(a+'T00:00:00Z');max.setUTCFullYear(max.getUTCFullYear()+3);if(b>max.toISOString().slice(0,10))errors.push('第'+(index+1)+'項租期不可超過3年');}
 });
 return {errors:[...new Set(errors)],warnings};
}
export function inspectionHints(state,problem,pending=[],today=taipeiToday()) {
 const warnings=[...pending];
 if(!state.customerName?.trim())warnings.push('客戶稱呼尚未填寫');
 if(!String(problem||'').trim())warnings.push('故障現象尚未填寫');
 if(!state.staffName?.trim())warnings.push('報價人員尚未填寫');
 const errors=[];
 if(!validDay(state.date))errors.push('報價日期格式不正確');
 else if(state.date!==today)warnings.push('報價日期不是今天；如為舊案或補登請確認');
 return {errors,warnings:[...new Set(warnings)]};
}
export function repairHints(note,selected,errors=[]) {
 const warnings=[];
 if(!selected)errors=[...errors,'請先選擇維修設備、型號與故障項目'];
 if(!note.customerName?.trim())warnings.push('客戶稱呼尚未填寫');
 if(!note.quotationPersonnel?.trim())warnings.push('報價人員尚未填寫');
 return {errors,warnings};
}
// Page-inline confirmation: missing details can be saved; invalid data cannot be delivered.
export function askOutput(host,review,unsaved,execute,save,notify) {
 host.replaceChildren();host.hidden=false;host.scrollIntoView?.({behavior:'smooth',block:'center'});
 const add=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;host.append(e);return e;};
 add('strong',review.errors.length?'請先修正以下內容':'交付前再確認');
 const list=add('ul','');for(const text of (review.errors.length?review.errors:review.warnings)){const li=document.createElement('li');li.textContent=text;list.append(li);}
 if(unsaved)add('p','目前有內容尚未保存到團隊；只輸出畫面不代表已共用。');
 let running=false;
 const go=async(withSave)=>{if(running)return;running=true;for(const b of host.querySelectorAll('button'))b.disabled=true;
  try{if(withSave)await save();await execute();host.hidden=true;}catch(e){notify(e.message||'操作未完成，原輸入已保留。');}finally{running=false;for(const b of host.querySelectorAll('button'))b.disabled=false;}};
 if(!review.errors.length){
  if(unsaved){const b=add('button','保存到團隊並繼續');b.type='button';b.onclick=()=>go(true);}
  const b=add('button',unsaved?'只輸出目前畫面':'確認後繼續');b.type='button';b.onclick=()=>go(false);
 }
 const cancel=add('button','返回修改');cancel.type='button';cancel.onclick=()=>{host.hidden=true;};
}

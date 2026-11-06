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
 host.replaceChildren();host.hidden=false;
 const dialog=document.createElement('dialog');dialog.className='customer-output-dialog customer-copy-owned';dialog.setAttribute?.('aria-label','交付客戶報價前確認');host.append(dialog);
 const add=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;dialog.append(e);return e;};
 add('h2',review.errors.length?'請先修正以下內容':'交付客戶報價前確認');
 const list=add('ul','');for(const text of (review.errors.length?review.errors:review.warnings)){const li=document.createElement('li');li.textContent=text;list.append(li);}
 if(unsaved)add('p','目前有內容尚未保存到團隊，可先保存再交付，或只輸出目前畫面。');
 const feedback=add('p','');feedback.setAttribute?.('role','status');let running=false;
 const close=()=>{if(running)return;dialog.close?.();host.hidden=true;host.replaceChildren();};
 dialog.oncancel=e=>{if(running)e.preventDefault();else close();};dialog.onclose=()=>{if(host.contains?.(dialog)){host.hidden=true;host.replaceChildren();}};
 const go=async(withSave)=>{if(running)return;running=true;for(const b of host.querySelectorAll('button'))b.disabled=true;
  try{if(withSave){feedback.textContent='正在保存到團隊…';await save();}await execute();running=false;close();}
  catch(e){feedback.textContent=e.message||'操作未完成，原輸入已保留。';notify(feedback.textContent);}
  finally{running=false;for(const b of host.querySelectorAll('button'))b.disabled=false;}};
 const actions=add('div','');actions.className='output-dialog-actions';
 const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.type='button';b.onclick=fn;actions.append(b);};
 if(!review.errors.length){if(unsaved)button('保存到團隊並繼續',()=>go(true));button(unsaved?'只輸出目前畫面':'確認後繼續',()=>go(false));}
 button('返回修改',close);if(dialog.showModal)dialog.showModal();else dialog.open=true;
}

// Try the modern clipboard first, then the browser's selection-based copy.
// A denied clipboard is recoverable: the caller shows selectable customer text.
export async function copyCustomerText(text, env={}) {
 const nav=env.navigator ?? globalThis.navigator,doc=env.document ?? globalThis.document;
 if(nav?.clipboard?.writeText){try{await nav.clipboard.writeText(text);return true;}catch{}}
 if(!doc?.createElement || !doc?.body)return false;
 let field;const focused=doc.activeElement;
 try{
  field=doc.createElement('textarea');field.value=text;field.readOnly=true;
  field.setAttribute('aria-label','客戶報價複製備援');
  field.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px';
  // Appending inside the active modal keeps the fallback out of its inert background.
  const parent=doc.querySelector?.('dialog[open]') || doc.body;parent.append(field);
  field.focus();field.select();field.setSelectionRange?.(0,text.length);
  return doc.execCommand?.('copy')===true;
 }catch{return false;}finally{field?.remove();focused?.focus?.({preventScroll:true});}
}


export function closeCustomerDialogs(doc=globalThis.document){for(const d of doc?.querySelectorAll?.('.customer-copy-owned') || []){d.close?.();d.remove();}}
export function showManualCustomerCopy(text,doc=globalThis.document){
 if(!doc?.body)return;
 const dialog=doc.createElement('dialog');dialog.className='customer-output-dialog customer-copy-owned';dialog.setAttribute('aria-label','手動複製客戶報價');
 const title=doc.createElement('h2');title.textContent='手動複製客戶報價';
 const hint=doc.createElement('p');hint.textContent='瀏覽器未允許自動複製。請按「選取全部文字」，再長按選「複製」，貼到LINE。也可改用Chrome或Safari開啟網站。';
 const field=doc.createElement('textarea');field.readOnly=true;field.value=text;field.setAttribute('aria-label','可手動複製的客戶報價');
 const buttons=doc.createElement('div');buttons.className='output-dialog-actions';
 const select=doc.createElement('button');select.type='button';select.textContent='選取全部文字';select.onclick=()=>{field.focus();field.select();field.setSelectionRange?.(0,text.length);};
 const close=doc.createElement('button');close.type='button';close.textContent='完成／關閉';close.onclick=()=>{dialog.close?.();dialog.remove();};
 dialog.onclose=()=>dialog.remove();buttons.append(select,close);dialog.append(title,hint,field,buttons);doc.body.append(dialog);
 if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
}
export async function copyCustomerQuote(text,notify,env={}){
 if(await copyCustomerText(text,env)){notify('✓ 已複製客戶報價，可貼到LINE或訊息。');return true;}
 showManualCustomerCopy(text,env.document ?? globalThis.document);notify('自動複製未完成，已開啟可手動複製的客戶報價。');return false;
}

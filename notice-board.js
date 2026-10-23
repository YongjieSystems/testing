// One shared notice board; no read receipts, rankings or additional employee tasks.
export function createNoticeBoard() {
 let context=null,generation=0,rows=[],editing=null,timer=null;
 const root=document.createElement('section');root.className='workspace-notices no-print';root.hidden=true;
 const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e};
 const heading=node('h2','公司公告');const feed=node('div');const status=node('p');status.setAttribute('role','status');
 const manage=node('details');manage.append(node('summary','主管：發布／管理公告'));
 const select=node('select');select.setAttribute('aria-label','選擇公告');
 const title=node('input');title.maxLength=100;title.setAttribute('aria-label','公告標題');title.placeholder='公告標題';
 const body=node('textarea');body.maxLength=4000;body.setAttribute('aria-label','公告內容');body.placeholder='想告訴同事的訊息（純文字）';
 const publish=node('button','發布公告');publish.type='button';
 const archive=node('button','下架此公告');archive.type='button';
 manage.append(select,title,body,publish,archive);root.append(heading,feed,status,manage);
 const mount=()=>{if(!root.isConnected)(document.querySelector('main')||document.querySelector('.app-shell')||document.getElementById('root')||document.body).prepend(root)};
 function resetForm(){editing=null;title.value='';body.value='';select.value='';archive.disabled=true;}
 function render(){
  root.hidden=!context?.org||!context?.user||(!rows.some(x=>x.active)&&context.role!=='MANAGER');
  feed.replaceChildren();for(const a of rows.filter(x=>x.active)){
   const card=node('article');card.append(node('h3',a.title),node('p',a.body),node('small','更新：'+new Date(a.updated_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})));feed.append(card);
  }
  if(!feed.childNodes.length)feed.append(node('p','目前沒有公告，直接開始工作即可。'));
  const chosen=select.value;select.replaceChildren();const o=node('option','＋ 新公告');o.value='';select.append(o);
  for(const a of rows){const opt=node('option',a.title+(a.active?'':'（已下架）'));opt.value=a.id;select.append(opt)}
  if(rows.some(a=>a.id===chosen))select.value=chosen;
 }
 async function refresh(){const c=context,g=++generation;if(!c?.org||!c?.user){root.hidden=true;return}
  try{const r=await c.client.from('yj_announcements').select('*').eq('org_id',c.org).order('updated_at',{ascending:false}).limit(30);if(g!==generation||context!==c)return;if(r.error)throw r.error;rows=r.data;render();status.textContent='';}
  catch{if(g===generation)status.textContent='公告暫時無法載入，不影響報價；稍後會自動重試。'}
 }
 select.onchange=()=>{const a=rows.find(x=>x.id===select.value);if(!a){resetForm();return}editing=a;title.value=a.title;body.value=a.body;archive.disabled=!a.active;};
 async function save(active){const c=context;if(!c||c.role!=='MANAGER')return;publish.disabled=archive.disabled=true;
  try{const r=await c.client.rpc('yj_save_announcement',{p_org:c.org,p_id:editing?.id||null,p_expected:editing?.revision||0,p_title:title.value,p_body:body.value,p_active:active});if(r.error)throw r.error;if(context!==c)return;resetForm();await refresh();status.textContent=active?'公告已發布，三套程式約30秒內更新。':'公告已下架，歷史異動仍保留。';}
  catch(e){if(context===c)status.textContent=e?.message||'公告未保存，請重新確認。'}finally{publish.disabled=false;archive.disabled=!editing?.active;}
 }
 publish.onclick=()=>save(true);archive.onclick=()=>save(false);
 return {
  setContext(c){const changed=context?.org!==c?.org||context?.role!==c?.role||context?.user?.id!==c?.user?.id;context=c;mount();manage.hidden=c?.role!=='MANAGER';if(changed){generation++;rows=[];feed.replaceChildren();resetForm();if(timer)clearInterval(timer);timer=null;if(c?.org&&c?.user){refresh();timer=setInterval(refresh,30000)}}root.hidden=!c?.org||!c?.user||(!rows.some(x=>x.active)&&c.role!=='MANAGER');},
  dispose(){generation++;if(timer)clearInterval(timer);root.remove();context=null;}
 };
}

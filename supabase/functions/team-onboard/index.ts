import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const frontend = 'https://yongjiesystems.github.io/testing/';
const allowedOrigins = new Set(['https://yongjiesystems.github.io']);
Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const headers: Record<string,string> = { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin' };
  if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
  headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  const respond = (status:number,body:unknown) => new Response(JSON.stringify(body),{status,headers});
  if (origin && !allowedOrigins.has(origin)) return respond(403,{error:'不允許的網站來源'});
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers});
  if (req.method!=='POST') return respond(405,{error:'只接受 POST'});
  const admin = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const text=await req.text();
    if (text.length>4096) return respond(413,{error:'請求過大'});
    const input=JSON.parse(text);
    let org:string, email:string, actor:string|null=null;
    if (input.mode==='bootstrap') {
      const {data,error}=await admin.rpc('yj_consume_bootstrap',{p_token:input.token});
      if (error || !data) return respond(403,{error:'設定連結無效、已使用或已過期'});
      org=data.org_id; email=data.email;
    } else if (input.mode==='invite') {
      const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'') || '';
      const {data:{user},error}=await admin.auth.getUser(token);
      if (error || !user) return respond(401,{error:'請重新登入'});
      org=String(input.orgId || ''); email=String(input.email || '').trim().toLowerCase(); actor=user.id;
      const {data:manager}=await admin.from('yj_memberships').select('id').eq('org_id',org).eq('user_id',user.id).eq('role','MANAGER').eq('active',true).maybeSingle();
      if (!manager) return respond(403,{error:'只有主管可開通員工'});
      const {data:member}=await admin.from('yj_memberships').select('user_id').eq('org_id',org).eq('email',email).eq('active',true).maybeSingle();
      if (!member || member.user_id) return respond(409,{error:'請先登錄啟用員工；已開通帳號不可透過此入口重發登入連結'});
    } else return respond(400,{error:'操作無效'});
    // Never generate a login link for an existing user: that would let a manager impersonate others.
    const {data:created,error:createError}=await admin.auth.admin.createUser({email,email_confirm:true,password:crypto.randomUUID()+crypto.randomUUID(),user_metadata:{yj_password_setup:true}});
    if (createError || !created.user) return respond(409,{error:'此電子郵件已有帳號或無法開通，請用原登入方式，或由專案擁有者處理恢復。此入口不會重設既有帳號。'});
    const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:'magiclink',email});
    if (linkError || !link.properties?.hashed_token) return respond(503,{error:'帳號已建立但開通連結尚未完成，請由專案擁有者處理；請勿重複建立帳號。'});
    const {error:finishError}=await admin.rpc('yj_finish_onboarding',{p_org:org,p_email:email,p_user:created.user.id,p_actor:actor});
    if (finishError) return respond(409,{error:'帳號名單已變更，請由專案擁有者核對，未傳回登入連結。'});
    const url=new URL(frontend); url.hash=new URLSearchParams({team_token_hash:link.properties.hashed_token}).toString();
    return respond(200,{url:url.toString(),email,message:'此為一次性開通連結，請私下交給該員工；不得放入群組或公開文件。'});
  } catch { return respond(400,{error:'無法完成開通，請核對資料或聯絡專案擁有者。'}); }
});

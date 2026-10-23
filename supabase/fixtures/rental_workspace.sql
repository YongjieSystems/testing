-- Additive rental workspace. Uses the existing verified employee memberships.
create table yj_private.rental_catalogue (id text primary key, plan jsonb not null);
revoke all on yj_private.rental_catalogue from public,anon,authenticated;
-- CATALOGUE_SEED
insert into yj_private.rental_catalogue(id,plan) values
('laser-bw', '{"id":"laser-bw","group":"雷射印表機","name":"雷射單功能黑白","unit":"天","rate":100,"deposit":2000,"included":50,"usage":1,"note":"整段租期每台含50張，超印每張1元。"}'::jsonb),
('laser-bwm', '{"id":"laser-bwm","group":"雷射印表機","name":"雷射多功能黑白","unit":"天","rate":150,"deposit":2000,"included":50,"usage":3,"note":"整段租期每台含50張，超印每張3元。"}'::jsonb),
('laser-c1', '{"id":"laser-c1","group":"雷射印表機","name":"雷射單功能彩色・方案1","unit":"天","rate":100,"deposit":2000,"included":0,"usage":3,"note":"黑白與彩色每張均3元，無內含印量；原方案1。"}'::jsonb),
('laser-c2', '{"id":"laser-c2","group":"雷射印表機","name":"雷射單功能彩色・方案2","unit":"天","rate":200,"deposit":2000,"included":0,"usage":3,"note":"黑白與彩色每張均3元，無內含印量；原方案2，適用差異請人工確認。"}'::jsonb),
('laser-cm', '{"id":"laser-cm","group":"雷射印表機","name":"彩雷買碳免買機","unit":"次","rate":1500,"deposit":2000,"note":"原耗材採購借機方案，每台每色1,500元，期數欄填購買色數；請確認碳粉品項、借用期間及退機範圍。"}'::jsonb),
('ink-bw', '{"id":"ink-bw","group":"噴墨印表機","name":"噴墨單功能黑白","unit":"天","rate":100,"deposit":2000,"included":50,"usage":0.3,"note":"整段租期每台含50張，超印每張0.3元；依原規則每台超印費無條件捨去至整元。"}'::jsonb),
('ink-bwm', '{"id":"ink-bwm","group":"噴墨印表機","name":"噴墨多功能黑白","unit":"天","rate":150,"deposit":2000,"included":50,"usage":0.3,"note":"整段租期每台含50張，超印每張0.3元；依原規則每台超印費無條件捨去至整元。"}'::jsonb),
('ink-c', '{"id":"ink-c","group":"噴墨印表機","name":"噴墨單功能彩色","unit":"月","rate":1500,"deposit":2000,"note":"含維修及耗材，沿用原月租價；原方案未定內含印量與超印價，請於本項補充用量約定，並非不限量承諾。"}'::jsonb),
('ink-cm', '{"id":"ink-cm","group":"噴墨印表機","name":"噴墨多功能彩色","unit":"月","rate":1500,"deposit":2000,"note":"含維修及耗材，沿用原月租價；原方案未定內含印量與超印價，請於本項補充用量約定，並非不限量承諾。"}'::jsonb),
('dot-310', '{"id":"dot-310","group":"點陣印表機","name":"LQ310類似後進紙規格","unit":"天","rate":100,"deposit":2000,"note":"每台每日含100張，超量須另外約定。"}'::jsonb),
('dot-690', '{"id":"dot-690","group":"點陣印表機","name":"LQ690類似前／後進紙規格","unit":"天","rate":200,"deposit":2000,"note":"每台每日含100張，超量須另外約定。"}'::jsonb),
('pc-day', '{"id":"pc-day","group":"桌上型電腦","name":"文書桌機・單主機","unit":"天","rate":100,"deposit":4000,"note":"原日租方案；不含螢幕。"}'::jsonb),
('pc-screen', '{"id":"pc-screen","group":"桌上型電腦","name":"文書桌機＋螢幕","unit":"天","rate":200,"deposit":4000,"note":"已含一台螢幕，不要重複加價。"}'::jsonb),
('pc-office', '{"id":"pc-office","group":"桌上型電腦","name":"文書桌機＋螢幕＋Office365原方案","unit":"天","rate":300,"deposit":4000,"note":"原套裝價，已含螢幕；Office授權適用方式須確認，不重複加入同一軟體費。"}'::jsonb),
('pc-month', '{"id":"pc-month","group":"桌上型電腦","name":"文書庫存桌機＋24吋螢幕","unit":"月","rate":600,"deposit":4000,"note":"原8代內CPU方案；含一台24吋螢幕，最低承租及維護範圍依本次約定。"}'::jsonb),
('pc-graphic', '{"id":"pc-graphic","group":"桌上型電腦","name":"繪圖庫存桌機＋24吋螢幕","unit":"月","rate":1000,"deposit":8000,"note":"原9代內CPU方案；含一台24吋螢幕，繪圖軟體另確認。"}'::jsonb),
('pc-custom', '{"id":"pc-custom","group":"桌上型電腦","name":"客製繪圖桌機＋24吋螢幕","unit":"月","rate":2000,"deposit":12000,"note":"原9代內CPU＋32G＋RTX獨顯方案；含螢幕，實際規格須確認。"}'::jsonb),
('nb-short', '{"id":"nb-short","group":"筆記型電腦","name":"文書筆電・15天內短租","unit":"天","rate":850,"deposit":4000,"tier":true,"note":"首日850元，第2天起每日150元，最多15天；不自動切換月租。"}'::jsonb),
('nb-month', '{"id":"nb-month","group":"筆記型電腦","name":"文書筆電・月租","unit":"月","rate":1500,"deposit":4000,"note":"沿用每月1,500元，承租與維修範圍依本次約定。"}'::jsonb),
('nb-gaming', '{"id":"nb-gaming","group":"筆記型電腦","name":"電競筆電・月租","unit":"月","rate":3000,"deposit":8000,"note":"沿用每月3,000元，不提供原價短租方案；請確認實際規格。"}'::jsonb);

create table public.yj_rental_quotes (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.yj_organizations(id),
 client_ref text not null,number text not null,customer text not null,revision integer not null check(revision>0),
 state_version integer not null default 1,workflow text not null default 'REVIEW' check(workflow in ('REVIEW','APPROVED','REJECTED')),
 total numeric not null,pending integer not null default 0,approved_revision integer,approved_by uuid references auth.users(id),approved_at timestamptz,
 decision_reason text not null default '',updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 unique(org_id,client_ref),unique(org_id,number)
);
create index rental_org_updated_idx on public.yj_rental_quotes(org_id,updated_at desc);
create index rental_approver_idx on public.yj_rental_quotes(approved_by);
create index rental_updated_by_idx on public.yj_rental_quotes(updated_by);
create table public.yj_rental_versions (
 quote_id uuid not null references public.yj_rental_quotes(id) on delete cascade,revision integer not null,
 snapshot jsonb not null,fingerprint text not null,created_by uuid not null references auth.users(id),created_name text not null,
 created_at timestamptz not null default now(),primary key(quote_id,revision)
);
create index rental_created_by_idx on public.yj_rental_versions(created_by);
create table public.yj_rental_events (
 id bigint generated always as identity primary key,quote_id uuid not null references public.yj_rental_quotes(id) on delete cascade,
 org_id uuid not null references public.yj_organizations(id),revision integer not null,event text not null,reason text not null default '',
 actor_id uuid not null references auth.users(id),actor_name text not null,created_at timestamptz not null default now()
);
create index rental_event_quote_idx on public.yj_rental_events(quote_id,created_at desc);
create index rental_event_org_idx on public.yj_rental_events(org_id);
create index rental_event_actor_idx on public.yj_rental_events(actor_id);

alter table public.yj_rental_quotes enable row level security;
alter table public.yj_rental_versions enable row level security;
alter table public.yj_rental_events enable row level security;
revoke all on public.yj_rental_quotes,public.yj_rental_versions,public.yj_rental_events from public,anon,authenticated;
grant select on public.yj_rental_quotes,public.yj_rental_versions,public.yj_rental_events to authenticated;
create policy rental_head_read on public.yj_rental_quotes for select to authenticated using(yj_private.actor_role(org_id) in ('MANAGER','STAFF'));
create policy rental_version_read on public.yj_rental_versions for select to authenticated using(exists(select 1 from public.yj_rental_quotes q where q.id=quote_id));
create policy rental_event_read on public.yj_rental_events for select to authenticated using(yj_private.actor_role(org_id) in ('MANAGER','STAFF'));

create function yj_private.rental_number(v text,lim numeric,whole boolean default false) returns numeric language plpgsql immutable set search_path='' as $$
declare n numeric;
begin
 if v is null or trim(v)='' then return null; end if;
 if v !~ '^[0-9]{1,12}([.][0-9]{1,2})?$' then raise exception '金額或數量格式不正確'; end if;
 n:=v::numeric;if n>lim or (whole and trunc(n)<>n) then raise exception '金額或數量超出範圍'; end if;return n;
end;$$;
create function yj_private.rental_date(v text) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if v is null or v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
 return to_char(v::date,'YYYY-MM-DD')=v;
exception when others then return false;
end;$$;
create function yj_private.rental_snapshot(raw jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q jsonb;inq jsonb:='{}';lines jsonb:='[]';l jsonb;clean jsonb;p jsonb;k text;v jsonb;d jsonb;
 qty numeric;periods numeric;price numeric;base numeric;usage numeric;pages numeric;amount numeric;eligible numeric;
 subtotal numeric:=0;discount_base numeric:=0;discount numeric:=0;discount_value numeric;tax numeric:=0;net numeric;deposit numeric;
 suggested numeric:=0;rows jsonb:='[]';checks jsonb:='[]';errs jsonb;pending integer:=0;ids text[]:='{}';start_date text;end_date text;
 text_keys text[]:=array['customer','contact','phone','staff','purpose','start','end','readyAt','address','access','software','network','delivery','urgency','notes','payment','validUntil','tax','depositMode','deposit','depositReason'];
 flag_keys text[]:=array['stockConfirmed','scopeConfirmed','periodsConfirmed','licenseConfirmed','transportConfirmed','reviewed'];
begin
 if raw is null or jsonb_typeof(raw) is distinct from 'object' or octet_length(raw::text)>300000 or raw->>'schema' is distinct from '1' or jsonb_typeof(raw->'inquiry') is distinct from 'object' or jsonb_typeof(raw->'lines') is distinct from 'array' or jsonb_array_length(raw->'lines')>100 or jsonb_typeof(raw->'discount') is distinct from 'object' then raise exception '報價資料格式錯誤或過大'; end if;
 if jsonb_typeof(raw->'id') is distinct from 'string' or length(raw->>'id') not between 1 and 80 then raise exception '報價識別碼無效';end if;
 foreach k in array text_keys loop
  v:=raw->'inquiry'->k;if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>5000 then raise exception '詢價文字欄位錯誤：%',k;end if;
  inq:=inq||jsonb_build_object(k,v);
 end loop;
 foreach k in array flag_keys loop
  v:=raw->'inquiry'->k;if jsonb_typeof(v) is distinct from 'boolean' then raise exception '確認欄位錯誤：%',k;end if;inq:=inq||jsonb_build_object(k,v);
 end loop;
 if inq->>'tax' not in ('pending','included','exclusive') or inq->>'depositMode' not in ('pending','collect','waive') or inq->>'delivery' not in ('待確認','客戶自取自還','專人送裝及回收','僅送達／回收另約','物流寄送來回','多地點／特殊交付') or inq->>'urgency' not in ('正常預約','優先整備','當日急件','夜間／假日','交期待確認') then raise exception '詢價選項無效';end if;
 for l in select value from jsonb_array_elements(raw->'lines') loop
  clean:='{}';errs:='[]';p:=null;base:=null;usage:=0;amount:=null;eligible:=0;
  if jsonb_typeof(l) is distinct from 'object' then raise exception '品項格式無效';end if;
  foreach k in array array['id','kind','planId','name','qty','periods','unit','price','pages','scope','override','overrideReason','start','end'] loop
   if jsonb_typeof(l->k) is distinct from 'string' or length(l->>k)>5000 then raise exception '品項文字欄位錯誤：%',k;end if;clean:=clean||jsonb_build_object(k,l->k);
  end loop;
  if jsonb_typeof(l->'discountable') is distinct from 'boolean' or l->>'kind' not in ('equipment','software','network','delivery','urgent','custom') or l->>'unit' not in ('天','月','次','小時','點','趟','人日') or length(l->>'id') not between 1 and 80 or l->>'id'=any(ids) then raise exception '品項類別或識別碼錯誤／重複';end if;
  ids:=array_append(ids,l->>'id');clean:=clean||jsonb_build_object('discountable',l->'discountable');
  qty:=yj_private.rental_number(l->>'qty',1000,true);periods:=yj_private.rental_number(l->>'periods',3650,true);pages:=yj_private.rental_number(l->>'pages',10000000,true);
  if qty is null or qty=0 then errs:=errs||'"數量須為1～1,000整數"'::jsonb;end if;
  if periods is null or periods=0 then errs:=errs||'"計費期數須為正整數"'::jsonb;end if;
  if length(trim(l->>'name'))=0 then errs:=errs||'"請填項目名稱"'::jsonb;end if;
  if l->>'planId'<>'' then
   select plan into p from yj_private.rental_catalogue where id=l->>'planId';
   if p is null or l->>'kind'<>'equipment' or p->>'unit'<>l->>'unit' then raise exception '原價設備方案不存在或計費單位被變更';end if;
   base:=case when p->'tier'='true'::jsonb then 850+(periods-1)*150 else (p->>'rate')::numeric*periods end;
   if p->'tier'='true'::jsonb and periods>15 then errs:=errs||'"筆電短租最多15天，請另選方案"'::jsonb;end if;
   if p ? 'usage' then
    if pages is null then errs:=errs||'"請填每台預估印量"'::jsonb;else usage:=greatest(0,pages-coalesce((p->>'included')::numeric,0))*(p->>'usage')::numeric;if l->>'planId' like 'ink-%' then usage:=floor(usage);end if;end if;
   end if;
  else
   price:=yj_private.rental_number(l->>'price',10000000);
   if price is null then errs:=errs||'"單價待估"'::jsonb;else base:=price*periods;end if;
  end if;
  if l->>'kind'='equipment' and ((l->>'unit'='月' and periods>36) or (l->>'unit'='天' and periods>1096)) then errs:=errs||'"設備租期不可超過3年"'::jsonb;end if;
  if trim(l->>'override')<>'' then base:=yj_private.rental_number(l->>'override',10000000);if length(trim(l->>'overrideReason'))=0 then errs:=errs||'"人工調價須填原因"'::jsonb;end if;end if;
  start_date:=coalesce(nullif(l->>'start',''),inq->>'start');end_date:=coalesce(nullif(l->>'end',''),inq->>'end');
  if ((l->>'start'<>'' and not yj_private.rental_date(l->>'start')) or (l->>'end'<>'' and not yj_private.rental_date(l->>'end'))) then errs:=errs||'"品項日期無效"'::jsonb;end if;
  if yj_private.rental_date(start_date) and yj_private.rental_date(end_date) and (end_date::date<start_date::date or end_date::date>(start_date::date+interval '3 years')::date) then errs:=errs||'"品項期間須在1天至3年內"'::jsonb;end if;
  if jsonb_array_length(errs)=0 and base is not null and qty is not null then amount:=round((round(base,2)+round(usage,2))*qty,2);if amount>1000000000 then raise exception '單項金額過大';end if;end if;
  if amount is null then pending:=pending+1;else subtotal:=subtotal+amount;if l->'discountable'='true'::jsonb and l->>'kind'='equipment' and l->>'planId'<>'laser-cm' then eligible:=round(base,2)*qty;discount_base:=discount_base+eligible;end if;end if;
  suggested:=suggested+coalesce((p->>'deposit')::numeric*qty,0);
  rows:=rows||jsonb_build_array(jsonb_build_object('amount',amount,'base',base,'usage',usage,'errors',errs,'deposit',coalesce((p->>'deposit')::numeric*qty,0),'discountBase',eligible));lines:=lines||jsonb_build_array(clean);
 end loop;
 d:=raw->'discount';if d->>'type' is null or d->>'type' not in ('amount','percent') or jsonb_typeof(d->'value') is distinct from 'string' or jsonb_typeof(d->'reason') is distinct from 'string' or length(d->>'reason')>5000 then raise exception '優惠格式錯誤';end if;
 d:=jsonb_build_object('type',d->'type','value',d->'value','reason',d->'reason');discount_value:=yj_private.rental_number(d->>'value',case when d->>'type'='percent' then 100 else 100000000 end);
 if discount_value is null then checks:=checks||'"優惠金額待確認"'::jsonb;else discount:=case when d->>'type'='percent' then round(discount_base*discount_value/100,2) else discount_value end;end if;
 if discount>discount_base then checks:=checks||'"優惠不可超過勾選設備基本租金"'::jsonb;end if;
 if discount>0 and length(trim(d->>'reason'))=0 then checks:=checks||'"請填優惠原因"'::jsonb;end if;
 net:=round(subtotal-least(discount,discount_base),2);if inq->>'tax'='exclusive' then tax:=round(net*.05,2);end if;
 if inq->>'depositMode'='collect' then deposit:=yj_private.rental_number(inq->>'deposit',100000000);if deposit is null then checks:=checks||'"押金金額待確認"'::jsonb;end if;elsif inq->>'depositMode'='waive' then deposit:=0;end if;
 if deposit=0 and length(trim(inq->>'depositReason'))=0 then checks:=checks||'"免收或零元押金須填原因"'::jsonb;end if;
 if jsonb_array_length(lines)=0 then checks:=checks||'"尚未加入品項"'::jsonb;end if;if pending>0 then checks:=checks||'"有品項待估或輸入錯誤"'::jsonb;end if;
 if length(trim(inq->>'customer'))=0 then checks:=checks||'"客戶名稱未填"'::jsonb;end if;if length(trim(inq->>'staff'))=0 then checks:=checks||'"報價人員未填"'::jsonb;end if;
 if not yj_private.rental_date(inq->>'start') or not yj_private.rental_date(inq->>'end') then checks:=checks||'"請確認起租與歸還日期"'::jsonb;
 elsif (inq->>'end')::date<(inq->>'start')::date or (inq->>'end')::date>((inq->>'start')::date+interval '3 years')::date then checks:=checks||'"租期須在1天至3年內"'::jsonb;end if;
 if not yj_private.rental_date(inq->>'validUntil') then checks:=checks||'"報價有效期限待確認"'::jsonb;end if;
 if inq->>'tax'='pending' then checks:=checks||'"稅額方式待確認"'::jsonb;end if;if inq->>'depositMode'='pending' then checks:=checks||'"押金方式待確認"'::jsonb;end if;
 if length(trim(inq->>'payment'))=0 then checks:=checks||'"付款安排未填"'::jsonb;end if;
 if inq->>'delivery'='待確認' then checks:=checks||'"交付方式待確認"'::jsonb;end if;
 if inq->>'delivery'<>'客戶自取自還' and length(trim(inq->>'address'))=0 then checks:=checks||'"交付地點未填"'::jsonb;end if;
 if inq->>'delivery' not in ('待確認','客戶自取自還') and (inq->'transportConfirmed'<>'true'::jsonb or not exists(select 1 from jsonb_array_elements(lines) x where x->>'kind'='delivery')) then checks:=checks||'"送裝及回收費另計，請列品項並確認"'::jsonb;end if;
 if inq->>'urgency'='交期待確認' then checks:=checks||'"交期尚未確認"'::jsonb;
 elsif inq->>'urgency'<>'正常預約' and ((inq->>'readyAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' or not exists(select 1 from jsonb_array_elements(lines) x where x->>'kind'='urgent')) then checks:=checks||'"請確認急件費及最晚完成時間"'::jsonb;end if;
 if exists(select 1 from jsonb_array_elements(lines) x where length(trim(x->>'scope'))=0) then checks:=checks||'"有品項服務範圍未填"'::jsonb;end if;
 foreach k in array array['stockConfirmed','scopeConfirmed','periodsConfirmed','reviewed'] loop if inq->k<>'true'::jsonb then checks:=checks||to_jsonb('尚未確認：'||k);end if;end loop;
 if (length(trim(inq->>'software'))>0 or exists(select 1 from jsonb_array_elements(lines) x where x->>'kind'='software' or x->>'planId'='pc-office')) and inq->'licenseConfirmed'<>'true'::jsonb then checks:=checks||'"軟體授權與安裝方式未確認"'::jsonb;end if;
 q:=jsonb_build_object('schema',1,'id',raw->>'id','inquiry',inq,'lines',lines,'discount',d);
 return jsonb_build_object('quote',q,'priceVersion',1,'totals',jsonb_build_object('rows',rows,'subtotal',subtotal,'discountBase',discount_base,'discount',discount,'net',net,'tax',tax,'total',net+tax,'deposit',deposit,'suggestedDeposit',suggested,'checks',checks,'pending',pending,'ready',jsonb_array_length(checks)=0));
end;$$;

create function yj_private.save_rental(p_org uuid,p_id uuid,p_expected integer,p_quote jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.yj_rental_quotes;snap jsonb;previous public.yj_rental_versions;v_id uuid;v_number text;v_name text;fingerprint text;rev integer;
begin
 perform 1 from public.yj_organizations where id=p_org for update;perform yj_private.require_role(p_org,array['MANAGER','STAFF']);
 if p_expected is null or p_expected<0 then raise exception '版本無效';end if;snap:=yj_private.rental_snapshot(p_quote);
 if p_id is null then select * into h from public.yj_rental_quotes where org_id=p_org and (client_ref=p_quote->>'id' or number=p_quote->>'id') for update;
 else select * into h from public.yj_rental_quotes where id=p_id for update;if not found or h.org_id<>p_org then raise exception '沒有此報價權限' using errcode='42501';end if;end if;
 v_id:=coalesce(h.id,gen_random_uuid());v_number:=coalesce(h.number,'R'||to_char(now() at time zone 'Asia/Taipei','YYYYMMDD')||'-'||upper(left(replace(v_id::text,'-',''),8)));
 snap:=jsonb_set(snap,'{quote,id}',to_jsonb(v_number));fingerprint:=md5((snap->'quote')::text);
 if h.id is not null then
  select * into previous from public.yj_rental_versions where quote_id=h.id and revision=h.revision;
  if p_id is null and p_expected=0 and previous.fingerprint=fingerprint then return jsonb_build_object('head',to_jsonb(h),'snapshot',previous.snapshot);end if;
  if p_expected<>h.revision then raise exception '同事已更新此報價，請先保留修改並載入最新版本' using errcode='PT409';end if;
  if previous.fingerprint=fingerprint then return jsonb_build_object('head',to_jsonb(h),'snapshot',previous.snapshot);end if;
 else if p_expected<>0 then raise exception '報價版本不存在' using errcode='PT409';end if;end if;
 rev:=coalesce(h.revision,0)+1;select display_name into v_name from public.yj_memberships where org_id=p_org and user_id=auth.uid() and active;
 if h.id is null then insert into public.yj_rental_quotes(id,org_id,client_ref,number,customer,revision,total,pending,updated_by) values(v_id,p_org,p_quote->>'id',v_number,p_quote->'inquiry'->>'customer',rev,(snap->'totals'->>'total')::numeric,(snap->'totals'->>'pending')::integer,auth.uid());
 else update public.yj_rental_quotes set customer=p_quote->'inquiry'->>'customer',revision=rev,state_version=state_version+1,workflow='REVIEW',approved_revision=null,approved_by=null,approved_at=null,decision_reason='',total=(snap->'totals'->>'total')::numeric,pending=(snap->'totals'->>'pending')::integer,updated_by=auth.uid(),updated_at=now() where id=v_id;end if;
 insert into public.yj_rental_versions values(v_id,rev,snap,fingerprint,auth.uid(),v_name,now());
 insert into public.yj_rental_events(quote_id,org_id,revision,event,actor_id,actor_name) values(v_id,p_org,rev,'SAVED',auth.uid(),v_name);
 select * into h from public.yj_rental_quotes where id=v_id;return jsonb_build_object('head',to_jsonb(h),'snapshot',snap);
end;$$;
create function yj_private.decide_rental(p_id uuid,p_expected integer,p_state integer,p_decision text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.yj_rental_quotes;v_org uuid;snap jsonb;v_name text;
begin
 select org_id into v_org from public.yj_rental_quotes where id=p_id;perform 1 from public.yj_organizations where id=v_org for update;perform yj_private.require_role(v_org,array['MANAGER']);
 select * into h from public.yj_rental_quotes where id=p_id for update;
 if p_expected is null or p_state is null or h.revision<>p_expected or h.state_version<>p_state then raise exception '報價或核准狀態已更新，請重新載入' using errcode='PT409';end if;
 if p_decision is null or p_decision not in ('APPROVED','REJECTED') or p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception '請填核准／退回原因';end if;
 select snapshot into snap from public.yj_rental_versions where quote_id=p_id and revision=h.revision;
 if p_decision='APPROVED' and (yj_private.rental_snapshot(snap->'quote')->'totals'->>'ready')::boolean is not true then raise exception '報價仍有待估或待確認項目，請先補齊再核准';end if;
 select display_name into v_name from public.yj_memberships where org_id=v_org and user_id=auth.uid() and active;
 update public.yj_rental_quotes set workflow=p_decision,state_version=state_version+1,approved_revision=case when p_decision='APPROVED' then revision end,approved_by=case when p_decision='APPROVED' then auth.uid() end,approved_at=case when p_decision='APPROVED' then now() end,decision_reason=trim(p_reason),updated_by=auth.uid(),updated_at=now() where id=p_id returning * into h;
 insert into public.yj_rental_events(quote_id,org_id,revision,event,reason,actor_id,actor_name) values(p_id,v_org,h.revision,p_decision,trim(p_reason),auth.uid(),v_name);
 return to_jsonb(h);
end;$$;
create function yj_private.official_rental(p_id uuid,p_expected integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare h public.yj_rental_quotes;snap jsonb;name text;
begin
 select * into h from public.yj_rental_quotes where id=p_id;perform yj_private.require_role(h.org_id,array['MANAGER','STAFF']);
 if p_expected is null or h.revision<>p_expected or h.workflow<>'APPROVED' or h.approved_revision<>h.revision then raise exception '最新版本尚未核准或已更新，不能輸出正式報價' using errcode='PT409';end if;
 select snapshot into snap from public.yj_rental_versions where quote_id=p_id and revision=h.revision;
 select actor_name into name from public.yj_rental_events where quote_id=p_id and event='APPROVED' and revision=h.revision order by id desc limit 1;
 return jsonb_build_object('head',to_jsonb(h),'snapshot',snap,'approverName',name);
end;$$;

revoke all on function yj_private.rental_number(text,numeric,boolean),yj_private.rental_date(text),yj_private.rental_snapshot(jsonb),yj_private.save_rental(uuid,uuid,integer,jsonb),yj_private.decide_rental(uuid,integer,integer,text,text),yj_private.official_rental(uuid,integer) from public,anon,authenticated;
grant execute on function yj_private.save_rental(uuid,uuid,integer,jsonb),yj_private.decide_rental(uuid,integer,integer,text,text),yj_private.official_rental(uuid,integer) to authenticated;
create function public.yj_save_rental(p_org uuid,p_id uuid,p_expected integer,p_quote jsonb) returns jsonb language sql security invoker set search_path='' as $$select yj_private.save_rental(p_org,p_id,p_expected,p_quote)$$;
create function public.yj_decide_rental(p_id uuid,p_expected integer,p_state integer,p_decision text,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select yj_private.decide_rental(p_id,p_expected,p_state,p_decision,p_reason)$$;
create function public.yj_official_rental(p_id uuid,p_expected integer) returns jsonb language sql security invoker set search_path='' as $$select yj_private.official_rental(p_id,p_expected)$$;
revoke all on function public.yj_save_rental(uuid,uuid,integer,jsonb),public.yj_decide_rental(uuid,integer,integer,text,text),public.yj_official_rental(uuid,integer) from public,anon;
grant execute on function public.yj_save_rental(uuid,uuid,integer,jsonb),public.yj_decide_rental(uuid,integer,integer,text,text),public.yj_official_rental(uuid,integer) to authenticated;

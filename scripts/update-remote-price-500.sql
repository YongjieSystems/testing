-- Authorized price-book update; does not rewrite saved quotations.
update public.yj_organizations
set pricebook=jsonb_set(pricebook,'{INSPECTION,SOFTWARE,price}','500'::jsonb,false)
where id='4aaf18a8-f240-43a2-b9c0-7201a8047cb4'::uuid
  and pricebook #>> '{INSPECTION,SOFTWARE,price}'='450';

import { randomBytes,createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { CONFIG } from '../pricing-config.js';
const testing=process.argv.includes('--test');
const token=randomBytes(32).toString('hex');
const nonce=randomBytes(8).toString('hex');
const email=testing ? `yj-qa-${nonce}@example.com` : 'yj-system@service5c.com.tw';
const name=testing ? `QA TEMP ${nonce}` : '永捷系統科技';
const file=testing ? (process.argv.includes('--screen') ? '.team-screen.local' : '.team-test.local') : '.team-bootstrap.local';
await writeFile(new URL('../'+file,import.meta.url),JSON.stringify({token,email,name,nonce}),{mode:0o600});
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const hash=createHash('sha256').update(token).digest('hex');
process.stdout.write(`with org as (insert into public.yj_organizations(name,pricebook) values(${literal(name)},${literal(JSON.stringify(CONFIG))}::jsonb) returning id), member as (
insert into public.yj_memberships(org_id,email,display_name,role) select id,${literal(email)},${literal(testing?'QA 主管':'永捷主管')},'MANAGER' from org), challenge as (
insert into yj_private.bootstrap_challenges(token_hash,org_id,email,expires_at) select ${literal(hash)},id,${literal(email)},now()+interval '30 minutes' from org)
select id from org;`);

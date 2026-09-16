import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('groups share volume bands and weight, validate unit freight and protect manual values',async()=>{
 const db=new PGlite();
 try{
   await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
   const dir=new URL('../supabase/migrations/',import.meta.url);
   for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')&&f<'027').sort())await db.exec((await readFile(new URL(file,dir),'utf8')).replace('create extension if not exists "pgcrypto";',''));
   const oldKits=(await db.query('select * from pricing_logistic_models where package_units between 2 and 6 order by id')).rows;
   await db.exec(await readFile(new URL('027_logistic_groups.sql',dir),'utf8'));
   const currentKits=(await db.query('select * from pricing_logistic_models where package_units between 2 and 6 order by id')).rows;
   for(let i=0;i<oldKits.length;i++)for(const k of Object.keys(oldKits[i]))assert.deepEqual(currentKits[i][k],oldKits[i][k]);
   await db.exec(`insert into products(name,family_id,weight_kg,width_cm,length_cm,height_cm,unit_cost,target_margin) values
   ('Garrafa A',1,1.1,7,7,28,50,30),('Garrafa B girada',1,1.1,7,28,7,60,30),('Pequena variação',1,1.1,7,7,27.5,50,30),('Outro peso',1,1.2,7,7,28,50,30);`);
   const mappings=(await db.query('select p.name,g.group_id from pricing_product_logistic_groups g join products p on p.id=g.product_id order by name')).rows;
   const groupId=mappings.find(m=>m.name==='Garrafa A').group_id;
   assert.equal(groupId,mappings.find(m=>m.name==='Garrafa B girada').group_id);
   assert.equal(groupId,mappings.find(m=>m.name==='Pequena variação').group_id);
   assert.notEqual(groupId,mappings.find(m=>m.name==='Outro peso').group_id);
   let g=(await db.query('select * from pricing_logistic_models where id=$1',[groupId])).rows[0];
   assert.equal(Number(g.freight_net_value),22.5);assert.equal(g.freight_origin,'manual');assert.equal(Number(g.volume_liters),1.3);
   await db.exec(`insert into auth.users values('00000000-0000-0000-0000-000000000001');insert into profiles(id,is_admin) values('00000000-0000-0000-0000-000000000001',true);select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);set role authenticated;`);
   // An API result is a proposal. It must not replace the approved manual cost.
   await db.query('update pricing_logistic_models set pending_quote=$1,pending_quote_at=now() where id=$2',[JSON.stringify({freight_net_value:43.5,freight_table_value:43.5,freight_discount_percent:0,freight_discount_value:0}),groupId]);
   g=(await db.query('select * from pricing_logistic_models where id=$1',[groupId])).rows[0];
   assert.equal(Number(g.freight_net_value),22.5);assert.equal(g.freight_origin,'manual');
   await assert.rejects(db.query('select public.save_group_freight($1,$2,$3,false)',[groupId,g.freight_revision-1,20]),/grupo mudou/);
   let accepted=(await db.query('select * from public.save_group_freight($1,$2,null,true)',[groupId,g.freight_revision])).rows[0];
   assert.equal(Number(accepted.freight_net_value),43.5);assert.equal(accepted.freight_origin,'api');assert.ok(accepted.accepted_quote);
   accepted=(await db.query('select * from public.save_group_freight($1,$2,22.5,false)',[groupId,accepted.freight_revision])).rows[0];
   assert.equal(Number(accepted.freight_net_value),22.5);assert.equal(accepted.freight_origin,'manual');assert.equal(accepted.accepted_quote,null);
   await db.query("update products set width_cm=8 where name='Garrafa A'");
   const changed=(await db.query("select m.* from pricing_product_logistic_groups g join products p on p.id=g.product_id join pricing_logistic_models m on m.id=g.group_id where p.name='Garrafa A'")).rows[0];
   assert.notEqual(changed.id,groupId);assert.equal(changed.freight_origin,'pending');assert.equal(changed.freight_net_value,null);
 }finally{await db.close();}
});

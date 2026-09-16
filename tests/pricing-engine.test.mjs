import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('026 applies to actual migration chain and enforces new pricing contracts', async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')&&f<='026_pricing_engine.sql').sort()){
   await db.exec((await readFile(new URL(f,dir),'utf8')).replace('create extension if not exists "pgcrypto";',''));
 }
 const rows=async sql=>(await db.query(sql)).rows;
 assert.equal((await rows('select * from pricing_engine_fee_rules')).length,11);
 assert.equal((await rows('select * from pricing_fixed_fee_rules')).length,3);
 assert.equal((await rows('select * from pricing_engine_freight_rules')).length,0);
 assert.equal((await rows('select * from pricing_logistic_models')).length,10);
 assert.equal((await rows('select * from pricing_logistic_models where freight_net_value is not null')).length,0);
 assert.equal((await rows('select * from pricing_family_parameters where packaging_unit_cost=0')).length,3);
 assert.equal((await rows('select * from pricing_tables where discount_percent=10')).length,2);
 assert.equal((await rows("select * from pg_constraint where conrelid='pricing_account_settings'::regclass and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (account_id)' ")).length,1);
 await db.exec("insert into products(name,unit_cost,target_margin) values('Engine test',10,20)");
 assert.equal((await rows('select * from pricing_engine_matrix')).length,6);
 assert.equal((await rows('select * from pricing_engine_matrix where calculated_price is not null')).length,0);
 const product=(await rows('select id from products'))[0].id;
 const table=(await rows("select id from pricing_tables where channel='Shopee' limit 1"))[0].id;
 const d=Object.fromEntries(['quantity','original_unit_cost','original_cost','target_margin_percent','safety_reserve_percent','safety_reserve_value','adjusted_cost','packaging_unit_cost','packaging_total','operational_cost','tax_percent','tax_value','commission_percent','commission_value','fixed_fee','freight_value','discount_percent','discount_value','additional_commission_percent','additional_commission_value','markup_percent','markup_value','additional_fixed_cost','other_costs','announced_price','effective_price','target_result','calculated_result'].map(k=>[k,0]));
 Object.assign(d,{quantity:1,original_unit_cost:10,original_cost:10,target_margin_percent:20,adjusted_cost:10,announced_price:12,effective_price:12,target_result:2,calculated_result:2,product:{id:product},family:{id:1},pricing_table:{id:table},global_parameters:{tax_percent:0,safety_reserve_percent:0,operational_cost:0},fee_rules:[],fixed_fee_rules:[],logistics:null});
 const insert=async(detail=d,channel='Shopee',listing=null)=>db.query(`insert into pricing_calculations(product_id,pricing_table_id,channel,listing_type,calculated_price,effective_price,target_result,calculated_result,calculation_details,engine_version) values($1,$2,$3,$4,12,12,2,2,$5,'test') returning id`,[product,table,channel,listing,JSON.stringify(detail)]);
 const first=(await insert()).rows[0].id;
 await insert();
 assert.equal((await rows('select * from pricing_calculations')).length,2);
 assert.equal((await rows('select * from pricing_current_calculations')).length,1);
 await assert.rejects(insert({},'Shopee'),/snapshot/i);
 await assert.rejects(insert({...d,freight_value:1}),/logistics/i);
 await assert.rejects(insert(d,'Shopee','classic'),/check constraint/);
 await assert.rejects(insert(d,'Mercado Livre',null),/freight|check constraint/);
 await assert.rejects(insert(d,'Mercado Livre','classic'),/freight|foreign key/);
 await assert.rejects(db.query('update pricing_calculations set engine_version=$1 where id=$2',['changed',first]),/immutable/);
 await assert.rejects(db.query('delete from pricing_calculations where id=$1',[first]),/immutable/);
 await assert.rejects(db.exec('update pricing_tables set discount_percent=100'),/check constraint/);
 await db.exec("update pricing_parameters set value=5 where code='tax_percent'");
 assert.deepEqual((await rows('select calculation_details from pricing_calculations limit 1'))[0].calculation_details,d);
 await db.exec('set role authenticated');
 assert.equal((await rows('select * from pricing_calculations')).length,0);
 await assert.rejects(insert(),/row-level security/);
 await db.exec('reset role');
 await db.exec("insert into auth.users values('00000000-0000-0000-0000-000000000001'); insert into profiles(id,is_admin) values('00000000-0000-0000-0000-000000000001',true)");
 await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); set role authenticated");
 await insert();
 assert.equal((await rows('select * from pricing_current_calculations')).length,1);
 await db.exec("update pricing_family_parameters set packaging_unit_cost=1 where family_id=1");
 await db.exec('reset role; set role anon');
 await assert.rejects(db.exec('select * from pricing_calculations'),/permission denied/);
 } finally {await db.close();}
});

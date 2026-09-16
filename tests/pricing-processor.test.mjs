import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const solver=moduleURL(compile(await readFile(new URL('../src/lib/pricingEngine.ts',import.meta.url),'utf8')));
const source=compile(await readFile(new URL('../worker/pricing.ts',import.meta.url),'utf8')).replace("'../src/lib/pricingEngine'",JSON.stringify(solver)).replace("import { mercadoLivre } from './mercadolivre';","const mercadoLivre = () => {throw new Error('unexpected quote')};");
const {calculate,pricing}=await import(moduleURL(source));
const p={id:'p',family_id:1,name:'Teste',unit_cost:86.25,target_margin:30};
const t={id:'t',channel:'Shopee',discount_percent:0,additional_commission_percent:0,markup_percent:0,additional_fixed_cost:0};
const params=['tax_percent','safety_reserve_percent','operational_cost'].map(code=>({code,value:0,confirmed_at:'2026-09-15'}));
const fees=[{channel:'Shopee',family_id:null,min_price:0,max_price:79.99,commission_percent:20,fixed_fee:4},{channel:'Shopee',family_id:null,min_price:80,max_price:99.99,commission_percent:14,fixed_fee:16},{channel:'Shopee',family_id:null,min_price:100,max_price:199.99,commission_percent:14,fixed_fee:20},{channel:'Shopee',family_id:null,min_price:200,max_price:null,commission_percent:14,fixed_fee:26}];
test('banded price matches manual accounting and a full snapshot',()=>{
 const r=calculate(p,t,null,params,fees,[],0,null);
 assert.equal(r.calculated_price,153.64);
 assert.ok(r.calculated_result>=25.875);
 assert.equal(r.calculation_details.fixed_fee,20);
 assert.equal(r.calculated_price,r.calculation_details.announced_price);
 assert.equal(r.calculation_details.commission_value,21.5096);
});
test('campaign preserves target and applies a real discount',()=>{
 const r=calculate(p,{...t,discount_percent:10},null,params,fees,[],0,null);
 assert.equal(r.effective_price,Number((r.calculated_price*.9).toFixed(2)));
 assert.ok(r.calculated_result>=r.target_result);
});
test('missing principal cost, freight, confirmation and conflicting rules block pricing',()=>{
 assert.throws(()=>calculate({...p,unit_cost:null},t,null,params,fees,[],0,null),/custo/);
 assert.throws(()=>calculate(p,t,null,params.map(x=>({...x,confirmed_at:null})),fees,[],0,null),/Confirme/);
 assert.throws(()=>calculate(p,{...t,channel:'Mercado Livre'},'classic',params,fees,[],0,null),/Frete/);
 assert.throws(()=>calculate(p,t,null,params,[...fees,{...fees[2],commission_percent:15}],[],0,null),/conflitantes/);
});
test('no cent rounding deficit at a tariff discontinuity',()=>{
 for(let cost=1;cost<220;cost+=.71){const r=calculate({...p,unit_cost:Number(cost.toFixed(2))},t,null,params,fees,[],0,null);assert.ok(r.calculated_result>=r.target_result);assert.equal(Math.round(r.calculated_price*100),Math.round(r.calculated_price*10000)/100);}
});
test('worker requires authentication before reading or writing the database',async()=>{
 const r=await pricing(new Request('https://example.test/api/pricing/recalculate',{method:'POST',body:'{}'}),{SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test'});
 assert.equal(r.status,401);
});

test('individual calculation processes only the selected product and never requests an external quote',async()=>{
 const id='11111111-1111-4111-8111-111111111111',jobId='22222222-2222-4222-8222-222222222222';
 const originalFetch=globalThis.fetch;let job;const saved=[];
 globalThis.fetch=async(input,options={})=>{
   const url=new URL(input);assert.equal(url.origin,'https://database.test');
   const body=options.body?JSON.parse(options.body):null;
   let result=[];
   if(url.pathname==='/auth/v1/user')result={id};
   else switch(url.pathname.split('/').at(-1)){
     case 'products':assert.equal(url.searchParams.get('id'),`in.(${id})`);result=[{...p,id}];break;
     case 'pricing_tables':result=[t];break;
     case 'pricing_parameters':result=params;break;
     case 'pricing_engine_fee_rules':result=fees;break;
     case 'pricing_recalculation_requests':
       if(options.method==='POST')job={...body,id:jobId,status:'pending'};
       if(options.method==='PATCH')job={...job,...body};
       result=[job];break;
     case 'pricing_calculations':saved.push(...body);result=body;break;
   }
   return Response.json(result);
 };
 try{
   const env={SUPABASE_URL:'https://database.test',SUPABASE_SERVICE_ROLE_KEY:'test'};
   const request=body=>new Request('https://app.test/api/pricing/recalculate',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(body)});
   const initialized=await (await pricing(request({product_id:id}),env)).json();
   assert.equal(initialized.scope.mode,'single');assert.deepEqual(initialized.scope.product_ids,[id]);
   const completed=await (await pricing(request({job_id:jobId}),env)).json();
   assert.equal(completed.status,'completed');assert.equal(completed.scope.processed,1);
   assert.equal(saved.length,1);assert.equal(saved[0].product_id,id);assert.equal(saved[0].calculated_price,153.64);
 }finally{globalThis.fetch=originalFetch;}
});
test('generated results pass the real database snapshot guard for both marketplaces',async()=>{
 const db=new PGlite();
 try{
   await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
   const dir=new URL('../supabase/migrations/',import.meta.url);
   for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile(new URL(file,dir),'utf8')).replace('create extension if not exists "pgcrypto";',''));
   const product=(await db.query("insert into products(name,family_id,unit_cost,target_margin) values('Teste',1,86.25,30) returning *")).rows[0];
   const tables=(await db.query("select * from pricing_tables where channel in ('Shopee','Mercado Livre')")).rows;
   const realFees=(await db.query('select * from pricing_engine_fee_rules')).rows;
   const realFixed=(await db.query('select * from pricing_fixed_fee_rules')).rows;
   const logistics={weight_kg:1.1,width_cm:7,length_cm:7,height_cm:28,model:'test',source:'test',cubic_weight_kg:null,freight_table_value:15,freight_discount_value:0,freight_discount_percent:0,freight_net_value:15};
   for(const table of tables){for(const modality of table.channel==='Mercado Livre'?['classic','premium']:[null]){
     const r=calculate(product,table,modality,params,realFees,realFixed,0,table.channel==='Mercado Livre'?logistics:null);
     await db.query('insert into pricing_calculations(product_id,pricing_table_id,channel,listing_type,calculated_price,effective_price,target_result,calculated_result,calculation_details,engine_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[r.product_id,r.pricing_table_id,r.channel,r.listing_type,r.calculated_price,r.effective_price,r.target_result,r.calculated_result,JSON.stringify(r.calculation_details),r.engine_version]);
   }}
   assert.equal((await db.query('select * from pricing_current_calculations')).rows.length,6);
 }finally{await db.close();}
});

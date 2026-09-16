import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const moduleURL=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=async path=>ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const client=moduleURL(await compile('../worker/mlClient.ts'));
const dataURL=moduleURL((await compile('../worker/listingData.ts')).replace("'./mlClient'",JSON.stringify(client)));
const {buildListingPayload,assertCurrentPrice}=await import(dataURL);
const {listings}=await import(moduleURL((await compile('../worker/listings.ts')).replace("'./mlClient'",JSON.stringify(client)).replace("'./listingData'",JSON.stringify(dataURL))));
const product={id:'11111111-1111-4111-8111-111111111111',family_id:1,name:'Vinho de teste',short_title:'Vinho teste',sku:'SKU',ean:'123',is_active:true,unit_cost:50,target_margin:30,weight_kg:1.1,width_cm:7,length_cm:7,height_cm:28,image_1_url:'/images/test.jpg'};
const table={id:'22222222-2222-4222-8222-222222222222',channel:'Mercado Livre',discount_percent:0,additional_commission_percent:0,markup_percent:0,additional_fixed_cost:0};
const group={id:'33333333-3333-4333-8333-333333333333',confirmed_at:'2026-09-16',freight_revision:1,freight_net_value:22.5};
const parameters=['tax_percent','safety_reserve_percent','operational_cost'].map(code=>({code,value:0,confirmed_at:'2026-09-16'}));
const calculation={id:'44444444-4444-4444-8444-444444444444',calculated_price:100.17,calculation_details:{product,pricing_table:table,global_parameters:Object.fromEntries(parameters.map(p=>[p.code,p.value])),packaging_unit_cost:0,logistics:{group_id:group.id,revision:1},freight_value:22.5,fee_rules:[],fixed_fee_rules:[]}};
const category={id:'MLB123',children_categories:[],settings:{max_title_length:60}};
test('payload uses saved price, exact modality, catalogue images and explicit test stock 1',()=>{
 const options={category_id:'MLB123',modality:'premium',attributes:[],price:1,available_quantity:99};
 const payload=buildListingPayload(product,calculation,options,category,{tags:[]},'https://gestor.test');
 assert.equal(payload.price,100.17);assert.equal(payload.available_quantity,1);assert.equal(payload.listing_type_id,'gold_pro');assert.equal(payload.title,'Vinho teste');assert.equal(payload.pictures[0].source,'https://gestor.test/images/test.jpg');
 const up=buildListingPayload(product,calculation,{...options,modality:'classic'},category,{tags:['user_product_seller']},'https://gestor.test');assert.equal(up.family_name,'Vinho teste');assert.equal(up.title,undefined);assert.equal(up.listing_type_id,'gold_special');
 assert.throws(()=>buildListingPayload({...product,image_1_url:null},calculation,options,category,{},'https://gestor.test'),/imagem/);
});
test('stale costs, margin, table or freight block publication',()=>{
 assertCurrentPrice(product,table,calculation,parameters,{packaging_unit_cost:0},group,[],[]);
 assert.throws(()=>assertCurrentPrice({...product,target_margin:35},table,calculation,parameters,{},group,[],[]),/Recalcule/);
 assert.throws(()=>assertCurrentPrice(product,{...table,discount_percent:10},calculation,parameters,{},group,[],[]),/Recalcule/);
 assert.throws(()=>assertCurrentPrice(product,table,calculation,parameters,{}, {...group,freight_revision:2},[],[]),/Recalcule/);
});
test('prepare never publishes; publication is reserved once and uncertain sends cannot be retried',async()=>{
 const original=globalThis.fetch;const account={id:'55555555-5555-4555-8555-555555555555',channel:'mercadolivre',is_active:true,external_account_id:'12345'};
 let stored,creates=0,uncertain=false;
 globalThis.fetch=async(input,options={})=>{
   const u=new URL(input),body=options.body?JSON.parse(options.body):null;
   if(u.hostname==='api.mercadolibre.com'){
     if(u.pathname==='/items'){creates++;assert.equal(body.price,100.17);if(uncertain)throw new Error('network timeout');return Response.json({id:'MLB456',status:'active',available_quantity:1,permalink:'https://produto.mercadolivre.com.br/MLB-456-test'});}
     if(u.pathname==='/items/validate')return new Response(null,{status:204});
     if(u.pathname==='/categories/MLB123')return Response.json(category);
     if(u.pathname==='/users/12345')return Response.json({tags:[]});
     throw new Error('Unexpected external call '+u.pathname);
   }
   assert.equal(u.hostname,'db.test');if(u.pathname==='/auth/v1/user')return Response.json({id:product.id});
   let rows=[];switch(u.pathname.split('/').at(-1)){
     case 'profiles':rows=[{is_admin:true}];break;
     case 'marketplace_accounts':rows=[account];break;
     case 'ml_connections':rows=[{access_token:'test',expires_at:'2099-01-01'}];break;
     case 'products':rows=[product];break;
     case 'pricing_account_settings':rows=[{pricing_table_id:table.id}];break;
     case 'pricing_tables':rows=[table];break;
     case 'pricing_current_calculations':rows=[calculation];break;
     case 'pricing_product_logistic_groups':rows=[{group_id:group.id}];break;
     case 'pricing_logistic_models':rows=[group];break;
     case 'pricing_parameters':rows=parameters;break;
     case 'pricing_family_parameters':rows=[{packaging_unit_cost:0}];break;
     case 'listings':
       if(u.searchParams.get('listing_type')==='is.null'){rows=[];break;}
       if(options.method==='POST')stored={...body,id:'66666666-6666-4666-8666-666666666666'};
       if(options.method==='PATCH')stored={...stored,...body};
       rows=stored?[stored]:[];break;
   }return Response.json(rows);
 };
 const env={SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'test'};
 const call=(action,body)=>listings(new Request('https://gestor.test/api/listings/'+action,{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(body)}),env);
 try{
   const prepared=await call('prepare',{account_id:account.id,product_id:product.id,modality:'classic',category_id:'MLB123',attributes:[],price:.01});assert.equal(prepared.status,200);assert.equal(creates,0);
   const first=await call('publish',{listing_id:stored.id});assert.equal(first.status,200);assert.equal(creates,1);assert.equal(stored.external_listing_id,'MLB456');
   assert.equal((await call('publish',{listing_id:stored.id})).status,200);assert.equal(creates,1);
   stored=undefined;uncertain=true;await call('prepare',{account_id:account.id,product_id:product.id,modality:'classic',category_id:'MLB123',attributes:[]});
   assert.equal((await call('publish',{listing_id:stored.id})).status,502);assert.equal(stored.publication_state,'uncertain');assert.equal(creates,2);
   assert.equal((await call('publish',{listing_id:stored.id})).status,409);assert.equal(creates,2);
 }finally{globalThis.fetch=original;}
});
test('migration preserves account table and allows classic plus premium without duplicate modality',async()=>{
 const db=new PGlite();try{
   await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
   const dir=new URL('../supabase/migrations/',import.meta.url);
   for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile(new URL(f,dir),'utf8')).replace('create extension if not exists "pgcrypto";',''));
   const p=(await db.query("insert into products(name) values('Teste') returning id")).rows[0];
   const a=(await db.query("insert into marketplace_accounts(channel,name,external_account_id) values('mercadolivre','Teste','123') returning id")).rows[0];
   for(const type of ['classic','premium'])await db.query("insert into listings(entity_type,product_id,account_id,listing_type) values('product',$1,$2,$3)",[p.id,a.id,type]);
   await assert.rejects(db.query("insert into listings(entity_type,product_id,account_id,listing_type) values('product',$1,$2,'classic')",[p.id,a.id]),/unique/);
   const tables=(await db.query("select id from pricing_tables where channel='Mercado Livre'")).rows;
   await db.query('insert into pricing_account_settings(account_id,pricing_table_id) values($1,$2)',[a.id,tables[0].id]);
   await assert.rejects(db.query('insert into pricing_account_settings(account_id,pricing_table_id) values($1,$2)',[a.id,tables[1].id]),/unique/);
   await db.exec('set role authenticated');await assert.rejects(db.query("update listings set publication_state='published'"),/permission denied/);
 }finally{await db.close();}
});

import type {Env} from './index';
import {ApiError,authorize,database,sellerClient,type Row} from './mlClient';
import {assertCurrentPrice,buildListingPayload,modalities} from './listingData';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const id=(value:unknown)=>{if(typeof value!=='string'||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(value))throw new ApiError('Identificador inválido.');return value;};
const message=(data:Row)=>Array.isArray(data.cause)?data.cause.filter((c:Row)=>c.type!=='warning').map((c:Row)=>c.message||c.code).join('; ')||data.message:data.message||data.error||'O Mercado Livre recusou os dados.';
export async function listings(request:Request,env:Env){
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return reply({error:'Banco não configurado.'},503);
 try{
   const url=new URL(request.url),action=url.pathname.split('/').at(-1);
   const user=await authorize(request,env,action==='assign-table'?'pricing.edit':action==='account-tables'?'pricing.view':'listings.create');
   const db=(path:string,method='GET',body?:unknown)=>database(env,path,method,body);
   const read=(path:string)=>database(env,path,'GET',undefined,user.bearer);
   const all=async(table:string,filter='',caller=true)=>{const rows:Row[]=[];for(let n=0;;n+=500){const page=await (caller?read:db)(`${table}?select=*&order=id&limit=500&offset=${n}${filter}`);rows.push(...page);if(page.length<500)return rows;}};
   const account=async(accountId:string)=>{const [a]=await read(`marketplace_accounts?id=eq.${id(accountId)}&is_active=eq.true&channel=eq.mercadolivre`);if(!a)throw new ApiError('Conta não autorizada.',403);return a;};
   if(action==='account-tables'&&request.method==='GET'){
     const [accounts,tables,settings,connections]=await Promise.all([all('marketplace_accounts','&channel=eq.mercadolivre&is_active=eq.true'),all('pricing_tables','&channel=eq.Mercado%20Livre'),read('pricing_account_settings?select=*'),db('ml_connections?select=seller_id')]);
     return reply({accounts:accounts.filter(a=>connections.some(c=>c.seller_id===a.external_account_id)),tables,settings});
   }
   if(action==='bootstrap'&&request.method==='GET'){
     const [products,accounts,tables,settings,records,connections]=await Promise.all([all('products','&is_active=eq.true'),all('marketplace_accounts','&channel=eq.mercadolivre&is_active=eq.true'),all('pricing_tables',"&channel=eq.Mercado%20Livre"),read('pricing_account_settings?select=*'),all('listings'),db('ml_connections?select=seller_id')]);
     return reply({products,accounts:accounts.filter(a=>connections.some(c=>c.seller_id===a.external_account_id)),tables,settings,listings:records.map(({publication_payload,publication_context,...r})=>r)});
   }
   if(request.method!=='POST')throw new ApiError('Método inválido.',405);
   const body=await request.json() as Row;
   if(action==='assign-table'){
     if(!user.admin)throw new ApiError('Somente administradores podem definir a tabela da conta.',403);
     const a=await account(body.account_id);const [table]=await db(`pricing_tables?id=eq.${id(body.pricing_table_id)}&channel=eq.Mercado%20Livre`);if(!table)throw new ApiError('Tabela inválida.');
     const existing=await db(`pricing_account_settings?account_id=eq.${a.id}`);
     await db(existing.length?`pricing_account_settings?account_id=eq.${a.id}`:'pricing_account_settings',existing.length?'PATCH':'POST',{account_id:a.id,pricing_table_id:table.id,updated_by:user.id,updated_at:new Date().toISOString()});return reply({ok:true});
   }
   if(action==='category'){
     const a=await account(body.account_id),ml=await sellerClient(env,a);
     const [product]=await read(`products?id=eq.${id(body.product_id)}`);if(!product)throw new ApiError('Produto não encontrado.');
     let categoryId=body.category_id,suggestions:Row[]=[];
     if(!categoryId){const r=await ml('/sites/MLB/domain_discovery/search?limit=3&q='+encodeURIComponent(product.name));if(!r.ok)throw new ApiError(message(r.data));suggestions=r.data as unknown as Row[];categoryId=suggestions[0]?.category_id;}
     if(!/^MLB\d+$/.test(categoryId||''))throw new ApiError('Informe a categoria Mercado Livre do produto.');
     const [category,attributes]=await Promise.all([ml('/categories/'+categoryId),ml('/categories/'+categoryId+'/attributes')]);if(!category.ok||!attributes.ok)throw new ApiError('Não foi possível carregar a categoria.');
     const defaults:Row={BRAND:product.brand,GTIN:product.ean,WINERY:product.winery,WINE_VARIETAL:product.varietal,NET_VOLUME:product.size,SELLER_SKU:product.sku};
     return reply({category:category.data,suggestions,attributes:(attributes.data as unknown as Row[]).filter(a=>!a.tags?.read_only).map(a=>({...a,suggested_value:defaults[a.id]||''}))});
   }
   async function priceData(a:Row,productId:string,modality:string){
     if(!Object.hasOwn(modalities,modality))throw new ApiError('Modalidade inválida.');
     const [setting]=await db(`pricing_account_settings?account_id=eq.${a.id}`);if(!setting)throw new ApiError('Associe uma tabela de preços à conta.');
     const [product]=await read(`products?id=eq.${id(productId)}&is_active=eq.true`);if(!product)throw new ApiError('Produto indisponível.');
     const [table]=await db(`pricing_tables?id=eq.${setting.pricing_table_id}&channel=eq.Mercado%20Livre`);if(!table)throw new ApiError('Tabela da conta incompatível.');
     const [calculation]=await db(`pricing_current_calculations?product_id=eq.${product.id}&pricing_table_id=eq.${table.id}&channel=eq.Mercado%20Livre&listing_type=eq.${modality}`);
     const [mapping]=await db(`pricing_product_logistic_groups?product_id=eq.${product.id}`);
     const [parameters,families,groups,fees,fixed]=await Promise.all([db('pricing_parameters?scope=eq.global'),db(`pricing_family_parameters?family_id=eq.${product.family_id}`),mapping?.group_id?db(`pricing_logistic_models?id=eq.${mapping.group_id}`):Promise.resolve([]),db(`pricing_engine_fee_rules?family_id=eq.${product.family_id}&listing_type=eq.${modality}`),db(`pricing_fixed_fee_rules?family_id=eq.${product.family_id}&active=eq.true`)]);
     assertCurrentPrice(product,table,calculation,parameters,families[0],groups[0],fees,fixed);
     return {product,table,calculation,context:{product,table,calculation_id:calculation.id,group_revision:groups[0]?.freight_revision,stock_policy:'test_one_until_inventory'}};
   }
   if(action==='prepare'){
     const a=await account(body.account_id),{product,table,calculation,context}=await priceData(a,body.product_id,body.modality);
     const legacy=await db(`listings?account_id=eq.${a.id}&product_id=eq.${product.id}&listing_type=is.null&external_listing_id=not.is.null`);
     if(legacy.length)throw new ApiError('Existe um anúncio legado vinculado. Confira sua modalidade antes de criar outro.',409);
     const existing=(await db(`listings?account_id=eq.${a.id}&product_id=eq.${product.id}&listing_type=eq.${body.modality}`))[0];
     if(existing&&(existing.external_listing_id||['publishing','uncertain','published'].includes(existing.publication_state)))throw new ApiError('Já existe anúncio ou envio em conferência para este produto, conta e modalidade.',409);
     const ml=await sellerClient(env,a);
     if(!/^MLB\d+$/.test(body.category_id||''))throw new ApiError('Categoria inválida.');
     const [cat,seller]=await Promise.all([ml('/categories/'+body.category_id),ml('/users/'+a.external_account_id)]);if(!cat.ok||!seller.ok)throw new ApiError('Não foi possível validar conta e categoria no Mercado Livre.');
     const payload=buildListingPayload(product,calculation,body,cat.data,seller.data,url.origin);
     const validation=await ml('/items/validate','POST',payload);
     const valid=validation.ok&&!(validation.data.cause||[]).some((e:Row)=>e.type==='error');
     const data={entity_type:'product',product_id:product.id,account_id:a.id,listing_type:body.modality,title:payload.title||payload.family_name,price:payload.price,published_stock:1,status:'draft',pricing_table_id:table.id,calculation_id:calculation.id,category_id:body.category_id,publication_payload:payload,publication_context:context,validation_result:validation.data,validated_at:valid?new Date().toISOString():null,publication_state:valid?'validated':'error',last_error:valid?null:message(validation.data),requested_by:user.id,updated_at:new Date().toISOString()};
     const [saved]=await db(existing?`listings?id=eq.${existing.id}&publication_state=in.(draft,validated,error)&external_listing_id=is.null`:'listings',existing?'PATCH':'POST',data);
     if(!saved)throw new ApiError('Este anúncio mudou durante a preparação. Atualize a lista.',409);
     return reply({id:saved.id,title:saved.title,price:saved.price,listing_type:saved.listing_type,publication_state:saved.publication_state,last_error:saved.last_error,stock:1,table_name:table.name,validation:validation.data});
   }
   if(action==='publish'){
     const [draft]=await read(`listings?id=eq.${id(body.listing_id)}`);if(!draft)throw new ApiError('Anúncio não autorizado.',403);
     const a=await account(draft.account_id);
     if(draft.external_listing_id)return reply({id:draft.id,external_listing_id:draft.external_listing_id,external_url:draft.external_url,status:draft.status});
     if(draft.publication_state!=='validated')throw new ApiError('Valide o anúncio novamente. Envios em conferência não serão repetidos.',409);
     if(Date.now()-Date.parse(draft.validated_at)>900000)throw new ApiError('A validação expirou. Revise e valide novamente.');
     const fresh=await priceData(a,draft.product_id,draft.listing_type);
     if(JSON.stringify(fresh.context)!==JSON.stringify(draft.publication_context)){
       // jsonb reorders object keys; compare canonical JSON rather than insertion order.
       const canonical=(x:any):string=>x&&typeof x==='object'?Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
       if(canonical(fresh.context)!==canonical(draft.publication_context))throw new ApiError('Os dados mudaram. Revise e valide novamente antes de criar.');
     }
     const ml=await sellerClient(env,a);
     const claimed=await db(`listings?id=eq.${draft.id}&publication_state=eq.validated&validated_at=eq.${encodeURIComponent(draft.validated_at)}`,'PATCH',{publication_state:'publishing',updated_at:new Date().toISOString()});
     if(!claimed.length)throw new ApiError('Envio já iniciado. Não repita a publicação.',409);
     let external:Row|undefined;
     try{
       const result=await ml('/items','POST',draft.publication_payload);
       if(!result.ok){const uncertain=result.status>=500||result.status===408;await db(`listings?id=eq.${draft.id}`,'PATCH',{publication_state:uncertain?'uncertain':'error',status:'error',last_error:message(result.data)});return reply({error:message(result.data),uncertain},400);}
       external=result.data;
       if(!/^MLB\d+$/.test(external.id||''))throw new Error('Resposta de criação sem identificação.');
       const status=['active','paused','closed'].includes(external.status)?external.status:'draft';
       const permalink=typeof external.permalink==='string'&&/^https:\/\/([\w-]+\.)?mercadolivre\.com\.br\//.test(external.permalink)?external.permalink:null;
       await db(`listings?id=eq.${draft.id}`,'PATCH',{external_listing_id:external.id,external_url:permalink,user_product_id:external.user_product_id||null,publication_state:'published',status,published_stock:external.available_quantity??0,last_synced_at:new Date().toISOString(),last_error:null});
       let warning='';
       if(fresh.product.description){try{const description=await ml('/items/'+external.id+'/description','POST',{plain_text:fresh.product.description});if(!description.ok)warning='Anúncio criado; descrição pendente: '+message(description.data);}catch{warning='Anúncio criado; falha ao enviar a descrição.';}if(warning)await db(`listings?id=eq.${draft.id}`,'PATCH',{last_error:warning});}
       return reply({id:draft.id,external_listing_id:external.id,external_url:permalink,status,warning});
     }catch{
       await db(`listings?id=eq.${draft.id}`,'PATCH',{publication_state:'uncertain',status:'error',last_error:'Resposta de publicação inconclusiva. Confira no Mercado Livre antes de tentar novamente.',...(external?.id?{external_listing_id:external.id}:{})}).catch(()=>{});
       return reply({error:'Envio em conferência. Não repita para evitar anúncios duplicados.',external_listing_id:external?.id,uncertain:true},502);
     }
   }
   throw new ApiError('Rota inválida.',404);
 }catch(e){return reply({error:e instanceof Error?e.message:'Falha ao preparar anúncios.'},e instanceof ApiError?e.status:500);}
}

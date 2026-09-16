import type {Env} from './index';
import {mercadoLivre} from './mercadolivre';

const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
/** Explicit single-group quote. This endpoint never replaces validated freight. */
export async function quoteFreightGroup(request:Request,env:Env){
  if(request.method!=='POST')return reply({error:'Método inválido.'},405);
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return reply({error:'Banco não configurado.'},503);
  const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Entre novamente.'},401);
  try{
    const body=await request.json() as {group_id:string;quote_price:number};
    if(!/^[0-9a-f-]{36}$/i.test(body.group_id)||!Number.isFinite(body.quote_price)||body.quote_price<=0)return reply({error:'Informe grupo e preço de referência válido para a cotação.'},400);
    const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:authorization,'Content-Type':'application/json'};
    const url=`${env.SUPABASE_URL}/rest/v1/pricing_logistic_models?id=eq.${body.group_id}`;
    const found=await fetch(url,{headers});
    if(!found.ok)return reply({error:'Não foi possível acessar o grupo.'},403);
    const [g]=await found.json() as Record<string,any>[];
    if(!g?.group_key||['weight_kg','width_cm','length_cm','height_cm'].some(k=>!(Number(g[k])>0)))return reply({error:'Grupo sem peso ou dimensões válidos.'},400);
    // Volume bands are an operational grouping rule, not a replacement for the
    // physical dimensions required by ML. Use an envelope of the current SKUs.
    const reference=[Number(g.width_cm),Number(g.length_cm),Number(g.height_cm)].sort((a,b)=>a-b);
    if(g.package_units===1){
      for(let offset=0;;offset+=500){
        const members=await fetch(`${env.SUPABASE_URL}/rest/v1/products?select=weight_kg,width_cm,length_cm,height_cm&is_active=eq.true&family_id=eq.${g.family_id}&order=id&limit=500&offset=${offset}`,{headers});
        if(!members.ok)return reply({error:'Não foi possível conferir as dimensões do grupo.'},400);
        const products=await members.json() as Record<string,any>[];
        for(const p of products){if(Number(p.weight_kg)!==Number(g.weight_kg)||Math.floor(Number(p.width_cm)*Number(p.length_cm)*Number(p.height_cm)/100)/10!==Number(g.volume_liters))continue;
          [Number(p.width_cm),Number(p.length_cm),Number(p.height_cm)].sort((a,b)=>a-b).forEach((d,i)=>{reference[i]=Math.max(reference[i],d);});
        }
        if(products.length<500)break;
      }
    }
    const quoted=await mercadoLivre(new Request(new URL('/api/marketplaces/mercadolivre/shipping-quote',request.url),{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({dimensions:`${Math.ceil(reference[2])}x${Math.ceil(reference[0])}x${Math.ceil(reference[1])},${Math.ceil(g.weight_kg*1000)}`,item_price:body.quote_price,listing_type_id:g.quote_listing_type,logistic_type:g.quote_logistic_type})}),env);
    const data=await quoted.json() as Record<string,any>;
    if(!quoted.ok)return reply({error:data.error||'Falha ao cotar o grupo.'},quoted.status);
    const country=data.quote?.coverage?.all_country;
    if(country?.currency_id!=='BRL'||country.list_cost==null||!Number.isFinite(Number(country.list_cost))||Number(country.list_cost)<0)return reply({error:'Cotação sem valor válido em BRL.'},502);
    const discount=data.quote.coverage.discount;
    const pending={freight_net_value:Number(country.list_cost),freight_table_value:Number(discount?.promoted_amount??country.list_cost),freight_discount_percent:Number(discount?.rate??0)*100,freight_discount_value:Number(discount?.promoted_amount??country.list_cost)-Number(country.list_cost),raw_quote:data.quote,seller_id:data.seller_id,quote_price:body.quote_price,listing_type:g.quote_listing_type,logistic_type:g.quote_logistic_type,reference_dimensions:{width_cm:reference[0],length_cm:reference[1],height_cm:reference[2],weight_kg:Number(g.weight_kg)}};
    const saved=await fetch(`${url}&freight_revision=eq.${g.freight_revision}`,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({pending_quote:pending,pending_quote_at:new Date().toISOString(),quote_price:body.quote_price,freight_revision:g.freight_revision+1})});
    if(!saved.ok)return reply({error:'Não foi possível guardar a cotação.'},400);
    const rows=await saved.json() as unknown[];
    if(!rows.length)return reply({error:'O grupo foi alterado durante a consulta. O frete validado foi preservado.'},409);
    return reply(rows[0]);
  }catch{return reply({error:'Falha de comunicação ao consultar o frete do grupo.'},502);}
}

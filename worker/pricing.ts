import type { Env } from './index';
import { solvePricing, effectivePriceAfterDiscount } from '../src/lib/pricingEngine';


type Row = Record<string, any>;
const response = (data: unknown, status=200) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const required = (value: unknown, label: string) => {
  if(value===null || value===undefined || value==='' || !Number.isFinite(Number(value)) || Number(value)<0) throw new Error(`Falta informar ${label}.`);
  return Number(value);
};
const round = (n:number, digits=4) => Number(n.toFixed(digits));
const band = (r:Row, price:number) => price>=Number(r.min_price) && (r.max_price==null || price<=Number(r.max_price));
const unique = (rows:Row[], fields:string[], label:string) => {
  if(!rows.length) throw new Error(`Não há regra de ${label} para essa faixa.`);
  if(new Set(rows.map(r=>JSON.stringify(fields.map(f=>r[f])))).size!==1) throw new Error(`Há regras conflitantes de ${label}.`);
  return rows[0];
};
function globalCosts(parameters:Row[]) {
  const globals:Row={};
  for(const code of ['tax_percent','safety_reserve_percent','operational_cost']) {
    const row=parameters.find(r=>r.code===code);
    if(!row?.confirmed_at) throw new Error(`Confirme ${code==='tax_percent'?'imposto':code==='safety_reserve_percent'?'reserva de segurança':'custo operacional'} em Parâmetros e salve.`);
    globals[code]=required(row.value,code);
  }
  return globals;
}

/** Select a consistent price band, including discontinuous fixed fees. */
export function calculate(p:Row,t:Row,modality:string|null,parameters:Row[],fees:Row[],fixed:Row[],packaging:number,logistics:Row|null) {
  const globals=globalCosts(parameters);
  if(!p.family_id) throw new Error('Produto sem família.');
  if(required(p.unit_cost,'custo do produto')<=0) throw new Error('O custo do produto deve ser maior que zero.');
  const applicable=fees.filter(r=>r.channel===t.channel && (t.channel==='Shopee'?r.family_id==null:r.family_id===p.family_id && r.listing_type===modality));
  const ff=fixed.filter(r=>r.channel===t.channel && r.family_id===p.family_id && r.active);
  if(t.channel==='Mercado Livre' && !logistics) throw new Error('Frete Mercado Livre ainda não cotado.');
  if(t.channel==='Mercado Livre' && !ff.length) throw new Error('Taxa fixa da família não cadastrada.');
  const candidates:Row[]=[];
  const markup=required(t.markup_percent,'acréscimo da tabela');
  for(const fee of applicable) {
    const fixedBands=t.channel==='Mercado Livre'?[...ff,{min_price:Math.max(...ff.map(r=>Number(r.max_price_exclusive??Infinity))),fixed_fee:0,max_price_exclusive:null}]:[{min_price:0,fixed_fee:0,max_price_exclusive:null}];
    for(const f of fixedBands) {
      if(!Number.isFinite(Number(f.min_price))) continue;
      const input={quantity:1,unitCost:Number(p.unit_cost),targetMarginPercent:required(p.target_margin,'margem do produto'),taxPercent:globals.tax_percent,safetyReservePercent:globals.safety_reserve_percent,operationalCost:globals.operational_cost,packagingUnitCost:packaging,commissionPercent:required(fee.commission_percent,'comissão'),additionalCommissionPercent:required(t.additional_commission_percent,'comissão adicional'),fixedFee:required(fee.fixed_fee,'taxa fixa')+required(f.fixed_fee,'taxa fixa por família'),freightValue:logistics?required(logistics.freight_net_value,'frete'):0,discountPercent:required(t.discount_percent,'desconto'),additionalFixedCost:required(t.additional_fixed_cost,'custo adicional'),otherCosts:0};
      const base=solvePricing(input);
      const discount=1-input.discountPercent/100;
      let announced=Math.max(Math.ceil(base.announcedPrice*(1+markup/100)*100)/100,Math.ceil(Math.max(Number(fee.min_price),Number(f.min_price))/discount*100)/100);
      let effective=effectivePriceAfterDiscount(announced,input.discountPercent);
      const resultAt=(v:number)=>v*(1-(input.taxPercent+input.commissionPercent+input.additionalCommissionPercent)/100)-base.adjustedCost-input.fixedFee-input.freightValue-input.packagingUnitCost-input.operationalCost-input.additionalFixedCost;
      while(resultAt(effective)<base.targetResult && announced<1e9){announced=round(announced+0.01,2);effective=effectivePriceAfterDiscount(announced,input.discountPercent);}
      if(!band(fee,effective) || effective<Number(f.min_price) || (f.max_price_exclusive!=null && effective>=Number(f.max_price_exclusive)))continue;
      unique(applicable.filter(r=>band(r,effective)),['commission_percent','fixed_fee'],'comissão');
      const selectedFixed=ff.filter(r=>effective>=Number(r.min_price)&&(r.max_price_exclusive==null||effective<Number(r.max_price_exclusive)));
      if(selectedFixed.length) unique(selectedFixed,['fixed_fee','per_unit'],'taxa fixa');
      const details={quantity:1,original_unit_cost:input.unitCost,original_cost:base.originalCost,target_margin_percent:input.targetMarginPercent,safety_reserve_percent:input.safetyReservePercent,safety_reserve_value:round(base.adjustedCost-base.originalCost),adjusted_cost:round(base.adjustedCost),packaging_unit_cost:packaging,packaging_total:packaging,operational_cost:input.operationalCost,tax_percent:input.taxPercent,tax_value:round(effective*input.taxPercent/100),commission_percent:input.commissionPercent,commission_value:round(effective*input.commissionPercent/100),fixed_fee:input.fixedFee,freight_value:input.freightValue,discount_percent:input.discountPercent,discount_value:round(announced-effective),additional_commission_percent:input.additionalCommissionPercent,additional_commission_value:round(effective*input.additionalCommissionPercent/100),markup_percent:markup,markup_value:round(announced-base.announcedPrice),additional_fixed_cost:input.additionalFixedCost,other_costs:0,announced_price:announced,effective_price:effective,target_result:round(base.targetResult),calculated_result:0,product:p,family:{id:p.family_id},pricing_table:t,global_parameters:globals,fee_rules:[fee],fixed_fee_rules:selectedFixed,logistics};
      details.calculated_result=round(effective-details.tax_value-details.commission_value-details.additional_commission_value-details.fixed_fee-details.freight_value-details.adjusted_cost-packaging-details.operational_cost-details.additional_fixed_cost);
      if(details.calculated_result<details.target_result)continue;
      candidates.push({product_id:p.id,pricing_table_id:t.id,channel:t.channel,listing_type:modality,calculated_price:announced,effective_price:effective,target_result:details.target_result,calculated_result:details.calculated_result,calculation_details:details,engine_version:'1.1.0'});
    }
  }
  if(!candidates.length)throw new Error('Nenhuma faixa de tarifa permite atingir o resultado alvo.');
  return candidates.sort((a,b)=>a.calculated_price-b.calculated_price)[0];
}

export function groupSnapshot(group:Row|undefined):Row|null {
  if(!group || !group.group_key || !['api','manual'].includes(group.freight_origin) || !group.confirmed_at || group.freight_net_value==null)return null;
  if(['weight_kg','width_cm','length_cm','height_cm'].some(k=>!Number.isFinite(Number(group[k]))||Number(group[k])<=0))return null;
  const freight=required(group.freight_net_value,'frete validado');
  return {group_id:group.id,group_number:group.group_number,family_id:group.family_id,quantity:group.package_units,model:group.name,
    weight_kg:Number(group.weight_kg),width_cm:Number(group.width_cm),length_cm:Number(group.length_cm),height_cm:Number(group.height_cm),
    volume_cm3:round(Number(group.width_cm)*Number(group.length_cm)*Number(group.height_cm)),volume_band_liters:Number(group.volume_liters),cubic_weight_kg:group.cubic_weight_kg,
    freight_net_value:freight,freight_table_value:required(group.freight_table_value,'frete bruto'),freight_discount_percent:required(group.freight_discount_percent,'desconto do frete'),freight_discount_value:required(group.freight_discount_value,'desconto do frete'),
    source:group.freight_origin,updated_at:group.freight_updated_at,revision:group.freight_revision,
    quote_context:group.freight_origin==='api'?group.accepted_quote:null};
}

export async function pricing(request:Request,env:Env):Promise<Response>{
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return response({error:'Banco não configurado no Worker.'},503);
  const authorization=request.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return response({error:'Entre novamente no sistema.'},401);
  const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:authorization,'Content-Type':'application/json'};
  async function db(path:string,method='GET',body?:unknown):Promise<Row[]> {
    const res=await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`,{method,headers:{...headers,Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
    if(!res.ok){const err=await res.json() as Row;throw new Error(err.message||`Erro no banco (${res.status}).`);}
    return res.status===204?[]:await res.json() as Row[];
  }
  async function all(table:string,filter='',order='id'){
    const rows:Row[]=[];
    for(let offset=0;;offset+=500){const page=await db(`${table}?select=*&order=${order}&limit=500&offset=${offset}${filter}`);rows.push(...page);if(page.length<500)return rows;}
  }
  const uuid=(id:unknown)=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id);
  try{
    const auth=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers});
    if(!auth.ok)return response({error:'Sessão expirada.'},401);
    const user=await auth.json() as Row;
    if(request.method!=='POST')return response({error:'Método inválido.'},405);
    const body=await request.json() as Row;
    if(body.product_id&&!uuid(body.product_id))return response({error:'Produto inválido.'},400);
    if(body.job_id&&!uuid(body.job_id))return response({error:'Solicitação inválida.'},400);
    let job:Row|undefined;
    const jobPath=`pricing_recalculation_requests?id=eq.${body.job_id}&requested_by=eq.${user.id}`;
    if(body.job_id){
      [job]=await db(jobPath);if(!job)return response({error:'Solicitação não encontrada.'},404);
      if(job.scope.version!==2)return response({error:'Solicitação antiga. Inicie um novo cálculo.'},409);
      if(job.status==='running'&&Date.now()-Date.parse(job.scope.started_at)>180000){await db(`${jobPath}&status=eq.running`,'PATCH',{status:'pending'});job.status='pending';}
      if(job.status!=='pending')return response(job);
    }
    const ids=job?job.scope.product_ids.slice(job.scope.processed,job.scope.processed+5):body.product_id?[body.product_id]:null;
    if(ids&&ids.some((id:unknown)=>!uuid(id)))throw new Error('Identificador inválido na solicitação.');
    const [products,tables,parameters,fees,fixed,family,groups,mapping]=await Promise.all([
      all('products',`&is_active=eq.true${ids?`&id=in.(${ids.join(',')})`:''}`),all('pricing_tables'),db('pricing_parameters?scope=eq.global'),
      all('pricing_engine_fee_rules'),all('pricing_fixed_fee_rules','&active=eq.true'),db('pricing_family_parameters?select=*'),
      all('pricing_logistic_models','&group_key=not.is.null'),all('pricing_product_logistic_groups','', 'product_id')
    ]);
    globalCosts(parameters);
    const activeTables=tables.filter(t=>['Mercado Livre','Shopee'].includes(t.channel));
    const logistics=new Map(products.map(p=>[p.id,groupSnapshot(groups.find(g=>g.id===mapping.find(m=>m.product_id===p.id)?.group_id))]));
    const missing=activeTables.some(t=>t.channel==='Mercado Livre')?products.filter(p=>!logistics.get(p.id)):[];
    if(missing.length)return response({code:'FREIGHT_PENDING',error:'Existem fretes a serem definidos',product_ids:missing.map(p=>p.id),group_ids:[...new Set(missing.map(p=>mapping.find(m=>m.product_id===p.id)?.group_id).filter(Boolean))]},409);
    if(!job){
      if(!products.length)return response({error:'Nenhum produto ativo encontrado.'},400);
      const [created]=await db('pricing_recalculation_requests','POST',{reason:'manual_all',requested_by:user.id,scope:{version:2,mode:body.product_id?'single':'general',product_ids:products.map(p=>p.id),total:products.length,processed:0,generated:0,blocked:[],requested_from:'/precificador'}});
      return response(created);
    }
    const scope={...job.scope,started_at:new Date().toISOString()};
    if(!(await db(`${jobPath}&status=eq.pending`,'PATCH',{status:'running',scope})).length)return response({error:'Cálculo já em processamento.'},409);
    try{
      const results:Row[]=[];
      for(const id of ids){
        const p=products.find(p=>p.id===id);
        try{
          if(!p)throw new Error('Produto removido ou inativo.');
          const productResults=activeTables.flatMap(t=>(t.channel==='Mercado Livre'?['classic','premium']:[null]).map(modality=>calculate(p,t,modality,parameters,fees,fixed,required(family.find(r=>r.family_id===p.family_id)?.packaging_unit_cost??0,'embalagem'),t.channel==='Mercado Livre'?logistics.get(p.id)!:null)));
          results.push(...productResults.map(result=>({...result,engine_version:'2.0.0',calculated_by:user.id})));
        }catch(error){scope.blocked.push({product:id,message:error instanceof Error?error.message:'Falha no cálculo.'});}
      }
      // One atomic database write per bounded batch, never one freight request per SKU.
      if(results.length)await db('pricing_calculations','POST',results);
      scope.generated+=results.length;scope.processed+=ids.length;
      const done=scope.processed>=scope.total;
      const [updated]=await db(jobPath,'PATCH',{scope,status:done?'completed':'pending',completed_at:done?new Date().toISOString():null});
      return response(updated);
    }catch(error){await db(jobPath,'PATCH',{status:'failed',error_message:error instanceof Error?error.message:'Falha no processamento.'});throw error;}
  }catch(error){return response({error:error instanceof Error?error.message:'Não foi possível executar o cálculo.'},400);}
}

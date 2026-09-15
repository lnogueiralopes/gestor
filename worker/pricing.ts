import type { Env } from './index';
import { solvePricing } from '../src/lib/pricingEngine';
import { mercadoLivre } from './mercadolivre';

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
      let effective=round(announced*discount,2);
      const resultAt=(v:number)=>v*(1-(input.taxPercent+input.commissionPercent+input.additionalCommissionPercent)/100)-base.adjustedCost-input.fixedFee-input.freightValue-input.packagingUnitCost-input.operationalCost-input.additionalFixedCost;
      while(resultAt(effective)<base.targetResult && announced<1e9){announced=round(announced+0.01,2);effective=round(announced*discount,2);}
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
  async function all(table:string,filter=''){
    const rows:Row[]=[];
    for(let offset=0;;offset+=500){const page=await db(`${table}?select=*&order=id&limit=500&offset=${offset}${filter}`);rows.push(...page);if(page.length<500)return rows;}
  }
  try{
    const auth=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers});
    if(!auth.ok)return response({error:'Sessão expirada.'},401);
    const user=await auth.json() as Row;
    if(request.method!=='POST')return response({error:'Método inválido.'},405);
    const body=await request.json() as Row;
    if(!body.job_id){
      globalCosts(await db('pricing_parameters?scope=eq.global'));
      const products=await all('products','&is_active=eq.true');
      const tables=await all('pricing_tables');
      const tasks=products.flatMap(p=>tables.filter(t=>['Mercado Livre','Shopee'].includes(t.channel)).flatMap(t=>(t.channel==='Mercado Livre'?['classic','premium']:[null]).map(m=>({product:p.id,table:t.id,modality:m}))));
      const jobs=await db('pricing_recalculation_requests','POST',{reason:body.reason==='freight_rules'?'freight_rules':'manual_all',requested_by:user.id,scope:{tasks,total:tasks.length,processed:0,generated:0,blocked:[],requested_from:'/precificador'}});
      return response(jobs[0]);
    }
    if(!/^[0-9a-f-]{36}$/i.test(body.job_id))return response({error:'Solicitação inválida.'},400);
    const path=`pricing_recalculation_requests?id=eq.${body.job_id}&requested_by=eq.${user.id}`;
    const [job]=await db(path);
    if(!job)return response({error:'Solicitação não encontrada.'},404);
    // A disconnected browser can resume a persisted job. Recover only expired leases.
    if(job.status==='running' && Date.now()-Date.parse(job.scope.started_at||job.requested_at)>180000){
      await db(`${path}&status=eq.running`,'PATCH',{status:'pending'});job.status='pending';
    }
    if(job.status!=='pending')return response(job);
    job.scope.started_at=new Date().toISOString();
    const claimed=await db(`${path}&status=eq.pending`,'PATCH',{status:'running',scope:job.scope});
    if(!claimed.length)return response({error:'Cálculo já está em processamento.'},409);
    const scope=job.scope;
    try{
      const task=scope.tasks?.[scope.processed];
      if(task){
        try{
          if(![task.product,task.table].every(id=>/^[0-9a-f-]{36}$/i.test(id)))throw new Error('Identificador de produto ou tabela inválido.');
          const [[p],[t],parameters,fees,fixed,family]=await Promise.all([db(`products?id=eq.${task.product}&is_active=eq.true`),db(`pricing_tables?id=eq.${task.table}`),db('pricing_parameters?scope=eq.global'),all('pricing_engine_fee_rules'),all('pricing_fixed_fee_rules','&active=eq.true'),db('pricing_family_parameters?select=*')]);
          if(!p||!t)throw new Error('Produto ou tabela removido ou inativo.');
          globalCosts(parameters);
          const packaging=required(family.find(r=>r.family_id===p.family_id)?.packaging_unit_cost??0,'embalagem');
          let logistics:Row|null=null;
          if(t.channel==='Mercado Livre'){
            const dims=Object.fromEntries(['weight_kg','width_cm','length_cm','height_cm'].map(k=>{const n=required(p[k],k);if(n<=0)throw new Error('Preencha peso e dimensões do produto.');return [k,n];}));
            const previous=await db(`pricing_current_calculations?product_id=eq.${p.id}&pricing_table_id=eq.${t.id}&listing_type=eq.${task.modality}`);
            const cached=previous[0]?.calculation_details?.logistics;
            if(job.reason!=='freight_rules' && cached?.source==='mercadolivre.shipping_options' && Object.keys(dims).every(k=>dims[k]===cached[k])){
              const check=calculate(p,t,task.modality,parameters,fees,fixed,packaging,cached);
              if(check.effective_price===cached.quoted_price)logistics=cached;
            }
            if(!logistics) {
              // Start with the last effective price or a conservative cost-based probe; converge below.
              let probe=Number(previous[0]?.effective_price)||Math.max(79,Number(p.unit_cost)*2);
              for(let attempt=0;attempt<6;attempt++){
                const quoted=await mercadoLivre(new Request(new URL('/api/marketplaces/mercadolivre/shipping-quote',request.url),{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({dimensions:`${Math.ceil(dims.height_cm)}x${Math.ceil(dims.width_cm)}x${Math.ceil(dims.length_cm)},${Math.ceil(dims.weight_kg*1000)}`,item_price:probe,listing_type_id:task.modality==='premium'?'gold_pro':'gold_special'})}),env);
                const quote=await quoted.json() as Row;
                if(!quoted.ok)throw new Error(quote.error||'Falha na cotação de frete.');
                const coverage=quote.quote?.coverage;
                if(coverage?.all_country?.currency_id!=='BRL')throw new Error('Cotação de frete sem moeda BRL.');
                const net=required(coverage.all_country.list_cost,'valor da cotação');
                const discount=coverage.discount;
                logistics={...dims,model:'Cadastro do produto — 1 unidade',cubic_weight_kg:null,source:quote.source,seller_id:quote.seller_id,quoted_at:new Date().toISOString(),quoted_price:probe,freight_net_value:net,freight_table_value:discount?.promoted_amount??net,freight_discount_percent:(discount?.rate??0)*100,freight_discount_value:round((discount?.promoted_amount??net)-net),raw_quote:quote.quote};
                const candidate=calculate(p,t,task.modality,parameters,fees,fixed,packaging,logistics);
                if(candidate.effective_price===probe)break;
                probe=candidate.effective_price;
                if(attempt===5)throw new Error('Cotação e preço não convergiram. Atualize o frete e tente novamente.');
              }
            }
          }
          const result=calculate(p,t,task.modality,parameters,fees,fixed,packaging,logistics);
          await db('pricing_calculations','POST',{...result,calculated_by:user.id});
          scope.generated++;
        }catch(error){scope.blocked.push({...task,message:error instanceof Error?error.message:'Falha no cálculo.'});}
        scope.processed++;
      }
      const done=scope.processed>=scope.total;
      const [updated]=await db(path,'PATCH',{scope,status:done?'completed':'pending',completed_at:done?new Date().toISOString():null});
      return response(updated);
    }catch(error){await db(path,'PATCH',{status:'failed',error_message:error instanceof Error?error.message:'Falha no processamento.'});throw error;}
  }catch(error){return response({error:error instanceof Error?error.message:'Não foi possível executar o cálculo.'},400);}
}

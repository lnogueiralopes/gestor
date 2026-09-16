import {ApiError,type Row} from './mlClient';
export const modalities={classic:'gold_special',premium:'gold_pro'} as const;
export function assertCurrentPrice(product:Row,table:Row,calculation:Row,parameters:Row[],family:Row,group:Row,fees:Row[],fixed:Row[]){
 const d=calculation?.calculation_details;
 if(!d||!(Number(calculation.calculated_price)>0))throw new ApiError('Preço não calculado para a tabela e modalidade. Recalcule o produto.');
 const same=(a:unknown,b:unknown)=>a!=null&&b!=null&&Number(a)===Number(b);
 if(['unit_cost','target_margin','weight_kg','width_cm','length_cm','height_cm','family_id'].some(k=>!same(product[k],d.product?.[k])))throw new ApiError('Cadastro alterado após o cálculo. Recalcule o produto.');
 if(['discount_percent','additional_commission_percent','markup_percent','additional_fixed_cost'].some(k=>!same(table[k],d.pricing_table?.[k])))throw new ApiError('Tabela alterada após o cálculo. Recalcule o produto.');
 if(['tax_percent','safety_reserve_percent','operational_cost'].some(k=>!parameters.find(p=>p.code===k)?.confirmed_at||!same(parameters.find(p=>p.code===k)?.value,d.global_parameters?.[k])))throw new ApiError('Parâmetros alterados após o cálculo. Recalcule o produto.');
 if(!same(family?.packaging_unit_cost??0,d.packaging_unit_cost))throw new ApiError('Embalagem alterada. Recalcule o produto.');
 if(!group?.confirmed_at||group.id!==d.logistics?.group_id||!same(group.freight_revision,d.logistics?.revision)||!same(group.freight_net_value,d.freight_value))throw new ApiError('Frete sem validação atual no cálculo. Recalcule o produto.');
 const effective=Number(calculation.effective_price);
 const feeIds=fees.filter(f=>effective>=Number(f.min_price)&&(f.max_price==null||effective<=Number(f.max_price))).map(f=>f.id).sort();
 const fixedIds=fixed.filter(f=>effective>=Number(f.min_price)&&(f.max_price_exclusive==null||effective<Number(f.max_price_exclusive))).map(f=>f.id).sort();
 if(JSON.stringify(feeIds)!==JSON.stringify((d.fee_rules||[]).map((f:Row)=>f.id).sort())||JSON.stringify(fixedIds)!==JSON.stringify((d.fixed_fee_rules||[]).map((f:Row)=>f.id).sort()))throw new ApiError('As faixas de tarifas mudaram. Recalcule o produto.');
 for(const rule of d.fee_rules||[]){const current=fees.find(f=>f.id===rule.id);if(!current||['commission_percent','fixed_fee','min_price','max_price'].some(k=>String(current[k]??'')!==String(rule[k]??'')))throw new ApiError('Tarifa alterada. Recalcule o produto.');}
 for(const rule of d.fixed_fee_rules||[]){const current=fixed.find(f=>f.id===rule.id);if(!current||['fixed_fee','min_price','max_price_exclusive'].some(k=>String(current[k]??'')!==String(rule[k]??'')))throw new ApiError('Taxa fixa alterada. Recalcule o produto.');}
}
export function buildListingPayload(product:Row,calculation:Row,options:Row,category:Row,seller:Row,origin:string){
 if(!product.is_active)throw new ApiError('Produto inativo.');
 if(!Object.hasOwn(modalities,options.modality))throw new ApiError('Modalidade inválida.');
 if(!/^MLB\d+$/.test(options.category_id||'')||category.id!==options.category_id||category.children_categories?.length)throw new ApiError('Selecione uma categoria final do Mercado Livre.');
 const title=String(options.title||product.short_title||product.name||'').trim();
 const limit=Number(category.settings?.max_title_length)||60;
 if(!title||title.length>limit)throw new ApiError(`O título deve ter entre 1 e ${limit} caracteres.`);
 const pictures=Array.from({length:6},(_,i)=>product[`image_${i+1}_url`]).filter(Boolean).map(value=>{
   const url=new URL(String(value).replace(/^\/image\//,'/images/'),origin);
   if(url.protocol!=='https:')throw new ApiError('A imagem precisa de endereço HTTPS público.');
   return {source:url.href};
 });
 if(!pictures.length)throw new ApiError('Cadastre pelo menos uma imagem do produto.');
 const attributes=Array.isArray(options.attributes)?options.attributes:[];
 if(attributes.length>100||attributes.some(a=>!a.id||typeof a.value_name!=='string'||a.value_name.length>255))throw new ApiError('Atributos inválidos.');
 const payload:Row={site_id:'MLB',category_id:options.category_id,price:Number(calculation.calculated_price),currency_id:'BRL',available_quantity:1,buying_mode:'buy_it_now',listing_type_id:modalities[options.modality as keyof typeof modalities],condition:'new',pictures,attributes:attributes.filter(a=>a.value_name.trim()).map(a=>({id:a.id,value_name:a.value_name.trim()})),seller_custom_field:product.sku||product.ean,shipping:{mode:'me2',free_shipping:true,local_pick_up:false}};
 if(seller.tags?.includes('user_product_seller'))payload.family_name=title;else payload.title=title;
 return payload;
}

import {useState} from 'react';
import {families} from './ProductFamilies';

type Row=Record<string,any>;
const fields=[['ean','EAN / SKU'],['winery','Vinícola'],['brand','Marca'],['product_type','Tipo'],['varietal','Variedade']] as const;
const integer=(value:number)=>Math.trunc(value).toLocaleString('pt-BR',{maximumFractionDigits:0});
const exact=(value:number)=>value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4});

export default function PricingMatrix({rows,tables,blocked,onDetail,onCalculate,busyProducts,generalBusy,errors}:{rows:Row[];tables:Row[];blocked:Row[];onDetail:(row:Row)=>void;onCalculate:(id:string)=>void;busyProducts:string[];generalBusy:boolean;errors:Record<string,string>}){
  const [family,setFamily]=useState('1');
  const [filters,setFilters]=useState<Record<string,string>>({});
  const [sort,setSort]=useState({key:'winery',ascending:true});
  const familyProducts:Row[]=Array.from(new Map(rows.filter(r=>String(r.family_id)===family).map(r=>[r.product_id,r])).values()).map(p=>({...p,last_calculated:Math.max(0,...rows.filter(r=>r.product_id===p.product_id&&r.calculated_at).map(r=>Date.parse(r.calculated_at)))}));
  const products=familyProducts.filter(p=>Object.entries(filters).every(([key,value])=>!value||String(p[key]??'')===value)).sort((a:Row,b:Row)=>(sort.key==='last_calculated'?a.last_calculated-b.last_calculated:String(a[sort.key]??'').localeCompare(String(b[sort.key]??''),'pt-BR',{numeric:true}))*(sort.ascending?1:-1));
  const priceColumns=tables.filter(t=>['Mercado Livre','Shopee'].includes(t.channel)).flatMap(table=>(table.channel==='Mercado Livre'?['classic','premium']:[null]).map(modality=>({table,modality,label:[table.channel,modality==='classic'?'Clássico':modality==='premium'?'Premium':null,table.name].filter(Boolean).join(' / ')})));
  return <>
    <div className="card pricingMatrixControls">
      <label>Família de produto<select aria-label="Família da matriz" value={family} onChange={e=>{setFamily(e.target.value);setFilters({});}}>{families.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <span>{products.length} de {familyProducts.length} produtos</span>
      <div className="pricingMatrixLegend" aria-label="Legenda das tabelas de preço">{priceColumns.map((c,i)=><span key={c.table.id+String(c.modality)}><b>{i+1}</b> {c.label}</span>)}</div>
    </div>
    <div className="card tableWrap"><table className="pricingMatrixTable"><thead><tr>
      {fields.map(([key,label])=><th key={key} aria-sort={sort.key===key?(sort.ascending?'ascending':'descending'):'none'}><button className="sortColumn" onClick={()=>setSort({key,ascending:sort.key===key?!sort.ascending:true})}>{label} <span aria-hidden="true">{sort.key===key?(sort.ascending?'↑':'↓'):'↕'}</span></button><select className="columnFilter" aria-label={'Filtrar matriz por '+label} title={filters[key]||'Filtrar por '+label} value={filters[key]||''} onChange={e=>setFilters({...filters,[key]:e.target.value})}><option value="">Todos</option>{Array.from(new Set(familyProducts.map(p=>String(p[key]??'')).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true})).map(value=><option key={value} value={value}>{value}</option>)}</select></th>)}
      <th>Custo</th><th>Margem</th>{priceColumns.map((c,i)=><th key={c.table.id+String(c.modality)} title={c.label}>{i+1}</th>)}
      <th className="lastCalculation" aria-sort={sort.key==='last_calculated'?(sort.ascending?'ascending':'descending'):'none'}><button className="sortColumn" title="Ordenar nunca calculados / mais antigos ou mais recentes" onClick={()=>setSort({key:'last_calculated',ascending:sort.key==='last_calculated'?!sort.ascending:true})}>Último cálculo {sort.key==='last_calculated'?(sort.ascending?'↑':'↓'):'↕'}</button></th><th className="calculateAction">Ações</th>
    </tr></thead><tbody>{products.map(p=><tr key={p.product_id}>
      {fields.map(([key])=><td key={key}><span className="matrixText" title={key==='ean'?p.name:String(p[key]??'')}>{String(p[key]??'')||'—'}</span></td>)}
      <td title={exact(Number(p.unit_cost))}>{integer(Number(p.unit_cost))}</td><td title={String(p.target_margin)+'%'}>{integer(Number(p.target_margin))}%</td>
      {priceColumns.map(c=>{
        const row=rows.find(r=>r.product_id===p.product_id&&r.pricing_table_id===c.table.id&&r.listing_type===c.modality);
        const issue=blocked.find(b=>b.product===p.product_id&&(!b.table||(b.table===c.table.id&&b.modality===c.modality)));
        return <td key={c.table.id+String(c.modality)}>{issue?<span title={issue.message} aria-label={issue.message}>—</span>:row?.calculated_price!=null?<button className="matrixPrice" title={exact(Number(row.calculated_price))+' — '+c.label} aria-label={'Ver cálculo de '+p.name+' / '+c.label} onClick={()=>onDetail(row)}>{integer(Number(row.calculated_price))}</button>:'—'}</td>;
      })}
      <td className="lastCalculation">{p.last_calculated?new Date(p.last_calculated).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',', ''):'Nunca'}</td><td className="calculateAction"><button className="roundAction" title={busyProducts.includes(p.product_id)?'Calculando...':'Calcular'} aria-label={'Calcular '+p.name} disabled={generalBusy||busyProducts.includes(p.product_id)} onClick={()=>onCalculate(p.product_id)}>↻</button>{busyProducts.includes(p.product_id)&&<small>Calculando...</small>}{errors[p.product_id]&&<small role="alert">{errors[p.product_id]}</small>}</td>
    </tr>)}</tbody></table>{!products.length&&<p>Nenhum produto nesta família com os filtros selecionados.</p>}</div>
  </>;
}

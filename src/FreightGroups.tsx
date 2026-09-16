import {useEffect,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {supabase} from './lib/supabase';
import {families} from './ProductFamilies';
type Row=Record<string,any>;
const money=(v:any)=>v==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function FreightGroups(){
  const location=useLocation();
  const [rows,setRows]=useState<Row[]>([]),[mapping,setMapping]=useState<Row[]>([]);
  const [pendingOnly,setPendingOnly]=useState(location.search.includes('pending=1'));
  const [values,setValues]=useState<Record<string,string>>({}),[prices,setPrices]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string[]>([]),[error,setError]=useState('');
  const [accept,setAccept]=useState<Row|null>(null);
  const [quoteGroup,setQuoteGroup]=useState<Row|null>(null);
  const load=async()=>{
    if(!supabase)return;
    const read=async(table:string,order:string)=>{const result:Row[]=[];for(let from=0;;from+=500){const {data,error}=await supabase!.from(table).select('*').order(order).range(from,from+499);if(error)throw error;result.push(...data||[]);if(!data||data.length<500)return result;}};
    try{const [groups,links]=await Promise.all([read('pricing_logistic_models','group_number'),read('pricing_product_logistic_groups','product_id')]);setRows(groups.filter(g=>g.group_key));setMapping(links);}catch(e){setError(e instanceof Error?e.message:String((e as Row)?.message||e));}
  };
  useEffect(()=>{void load();},[]);
  const update=(g:Row)=>setRows(old=>old.map(row=>row.id===g.id?g:row));
  const operation=async(id:string,fn:()=>Promise<void>)=>{if(busy.includes(id))return;setBusy(old=>[...old,id]);setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:String((e as Row)?.message||e));}finally{setBusy(old=>old.filter(x=>x!==id));}};
  const save=(g:Row,api=false)=>operation(g.id,async()=>{
    const value=Number((values[g.id]??String(g.freight_net_value??'')).replace(',','.'));
    if(!api&&((values[g.id]??String(g.freight_net_value??''))===''||!Number.isFinite(value)||value<0))throw new Error('Informe um frete válido.');
    const {data,error}=await supabase!.rpc('save_group_freight',{p_group:g.id,p_revision:g.freight_revision,p_value:value,p_accept_quote:api});if(error)throw error;
    update(data);setValues(old=>{const next={...old};delete next[g.id];return next;});setAccept(null);
  });
  const quote=(g:Row)=>operation(g.id,async()=>{
    const price=Number((prices[g.id]??String(g.quote_price??'')).replace(',','.'));
    if(!Number.isFinite(price)||price<=0)throw new Error('Informe o preço de referência do grupo para consultar o Mercado Livre.');
    const {data}=await supabase!.auth.getSession();
    const res=await fetch('/api/pricing/freight-group/quote',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session?.access_token},body:JSON.stringify({group_id:g.id,quote_price:price})});
    const result=await res.json();if(!res.ok)throw new Error(result.error);update(result);setQuoteGroup(null);setAccept(result);
  });
  const missing=mapping.filter(m=>!m.group_id).length;
  return <div className="card tableWrap freightGroups"><h3>Grupos logísticos / Fretes</h3>
    <label><input type="checkbox" checked={pendingOnly} onChange={e=>setPendingOnly(e.target.checked)}/> Apenas pendentes</label>
    {missing>0&&<p role="alert">{missing} produto(s) sem grupo: complete família, peso e dimensões no cadastro.</p>}
    {error&&<p role="alert">{error}<button onClick={()=>setError('')} aria-label="Dispensar erro">×</button></p>}
    <table><thead><tr>{['Grupo','Família','Unidades','SKUs','Peso (kg)','Dimensões de referência (cm)','Volume (L)','Frete ML','Origem / atualização','Ações'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
    {rows.filter(g=>!pendingOnly||g.freight_origin==='pending'||!g.confirmed_at).map(g=><tr key={g.id} className={g.freight_origin==='pending'?'pendingFreight':''}>
      <td>G{String(g.group_number).padStart(3,'0')}</td><td>{families.find(f=>f.id===g.family_id)?.name}</td><td>{g.package_units}</td><td>{mapping.filter(m=>m.group_id===g.id).length}</td><td>{g.weight_kg}</td><td>{g.width_cm} × {g.length_cm} × {g.height_cm}</td><td title="Faixa de 0,1 litro, sem arredondar para cima">{Number(g.volume_liters).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}</td>
      <td><input aria-label={'Frete do grupo '+g.group_number} inputMode="decimal" value={values[g.id]??String(g.freight_net_value??'')} onChange={e=>setValues({...values,[g.id]:e.target.value})}/></td>
      <td>{g.freight_origin==='manual'?'Manual':g.freight_origin==='api'?'API':'Pendente'}<small>{g.freight_updated_at?new Date(g.freight_updated_at).toLocaleString('pt-BR'):'Nunca atualizado'}</small></td>
      <td><button className="roundAction" disabled={busy.includes(g.id)} title="Salvar frete manual" aria-label={'Salvar frete do grupo '+g.group_number} onClick={()=>void save(g)}>✓</button><button className="roundAction" disabled={busy.includes(g.id)} title="Calcular frete" aria-label={'Calcular frete do grupo '+g.group_number} onClick={()=>setQuoteGroup(g)}>↻</button></td>
    </tr>)}</tbody></table>
    {quoteGroup&&<div className="calcModalBackdrop"><div className="calcModal" role="dialog" aria-modal="true" aria-label="Consultar frete"><h3>Consultar frete do grupo {quoteGroup.group_number}</h3><label>Preço do item para consulta ao Mercado Livre<input inputMode="decimal" value={prices[quoteGroup.id]??String(quoteGroup.quote_price??'')} onChange={e=>setPrices({...prices,[quoteGroup.id]:e.target.value})}/></label><button onClick={()=>setQuoteGroup(null)}>Cancelar</button><button disabled={busy.includes(quoteGroup.id)} onClick={()=>void quote(quoteGroup)}>Consultar</button>{error&&<p role="alert">{error}</p>}</div></div>}
    {accept&&<div className="calcModalBackdrop"><div className="calcModal" role="dialog" aria-modal="true" aria-label="Confirmar cotação"><h3>Substituir frete validado?</h3><p>Atual: {money(accept.freight_net_value)} ({accept.freight_origin==='manual'?'Manual':accept.freight_origin}). Nova cotação: {money(accept.pending_quote.freight_net_value)}.</p><button onClick={()=>setAccept(null)}>Cancelar</button><button disabled={busy.includes(accept.id)} onClick={()=>void save(accept,true)}>Confirmar substituição</button></div></div>}
  </div>;
}

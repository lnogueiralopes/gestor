import {parseCostCsv,saveCostRow} from './lib/costImport';
import TopNavigation from './TopNavigation';
import PricingMatrix from './PricingMatrix';
import FreightGroups from './FreightGroups';
import { useEffect, useState, useRef } from "react";
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { accounts, kits, kitMatrix, kitRules, pricingParameters, products, productMatrix, priceTables, type ChannelCell } from "./demo";
import { supabase } from './lib/supabase';
import { solvePricing } from './lib/pricingEngine';

type MatrixProps = {
  kind: "products" | "kits";
};

function StatusBadge({ cell }: { cell: ChannelCell }) {
  const labels = {
    active: "Ativo",
    paused: "Pausado",
    draft: "Rascunho",
    error: "Erro",
    none: "Não publicado",
  };
  return (
    <div className={`status status-${cell.status}`}>
      <strong>{labels[cell.status]}</strong>
      {cell.price ? <span>R$ {cell.price.toFixed(2).replace(".", ",")}</span> : null}
    </div>
  );
}

function Sidebar() { return <TopNavigation />; }

function NavIcon({ path }: { path: string }) {
  const paths: Record<string, string> = {
    "/": "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    "/produtos": "M12 3 3 7.5v9L12 21l9-4.5v-9L12 3z M3 7.5l9 4.5 9-4.5 M12 12v9 M7.5 5.25l9 4.5",
    "/kits": "M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8H8a3 3 0 1 1 3-3l1 3z M12 8h4a3 3 0 1 0-3-3l-1 3z",
    "/precificador": "M5 2h14v20H5z M8 6h8 M8 11h1 M15 11h1 M8 15h1 M15 15h1 M8 19h1 M15 19h1",
    "/anuncios": "M3 10h5l12-5v14L8 14H3z M8 14l2 7H6l-2-7",
    "/pedidos": "M6 3h12v18l-3-2-3 2-3-2-3 2V3z M9 7h6 M9 11h6 M9 15h3",
    "/contas": "M3 21h18 M4 9h16L12 3 4 9z M6 12v6 M12 12v6 M18 12v6",
    "/usuarios": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M18 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.87",
    "/configuracoes": "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
  };
  return <svg className="navIcon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[path]} /></svg>;
}

function PageHeader({ action }: { title: string; subtitle: string; action?: string }) {
  return (
    <div className="pageHeader" hidden={!action}>

      {action && <div className="actionPanel"><button className="roundAction addAction" disabled title={`${action} — em preparação`} aria-label={action}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>}
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão central da operação da Ruta Directa." />
      <div className="cards">
        <div className="card metric"><span>Produtos reais</span><strong>3</strong><small>Base central</small></div>
        <div className="card metric"><span>Kits</span><strong>3</strong><small>Composição virtual</small></div>
        <div className="card metric"><span>Canais</span><strong>3</strong><small>ML, Shopee e Shop</small></div>
        <div className="card metric"><span>Anúncios ativos</span><strong>9</strong><small>Demo</small></div>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Arquitetura central</h3>
          <div className="flow">
            <div>Produtos reais</div><span>→</span><div>Kits</div><span>→</span><div>Precificador</div><span>→</span><div>Canais</div>
          </div>
        </div>
        <div className="card">
          <h3>Próximas integrações</h3>
          <p className="muted">As operações reais serão implementadas na próxima etapa.</p>
          <div className="chips"><span>Mercado Livre</span><span>Shopee</span><span>Mercado Pago</span></div>
        </div>
      </div>
    </>
  );
}

function Matrix({ kind }: MatrixProps) {
  const rows = kind === "products" ? products : kits;
  const matrix = kind === "products" ? productMatrix : kitMatrix;
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const visibleRows = rows.filter(row => `${row.sku} ${row.ean} ${row.name}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));

  const allChecked = visibleRows.length > 0 && visibleRows.every(row => selected.includes(row.id));
  const toggleAll = () => setSelected(current => allChecked ? current.filter(id => !visibleRows.some(row => row.id === id)) : [...new Set([...current, ...visibleRows.map(row => row.id)])]);
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <>
      <PageHeader
        title={kind === "products" ? "Produtos" : "Kits"}
        subtitle={kind === "products" ? "Produtos físicos reais e cobertura por canal." : "Kits virtuais e cobertura por canal."}
        action={kind === "products" ? "Importar produtos" : "Criar kit"}
      />
      <div className="toolbar">
        <button disabled>Preparar publicação ({selected.length})</button>
        <button disabled>Atualizar preços</button>
        <button disabled>Sincronizar estoque</button>
        <span className="spacer" />
        <input aria-label="Buscar SKU, EAN ou produto" placeholder="Buscar SKU, EAN ou produto..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="tableWrap card">
        <table>
          <thead>
            <tr>
              <th><input aria-label="Selecionar todos os resultados" type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              <th>SKU</th>
              <th>EAN / código interno</th>
              <th>{kind === "products" ? "Produto" : "Kit"}</th>
              {kind === "products" ? <><th>Estoque</th><th>Margem</th></> : <><th>Composição</th><th>Disponível</th></>}
              {accounts.map(a => <th key={a.id}>{a.name}<small>{a.channel}</small></th>)}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row: any) => (
              <tr key={row.id}>
                <td><input aria-label={`Selecionar ${row.sku}`} type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /></td>
                <td><strong>{row.sku}</strong></td>
                <td><span className="barcodeNumber">{row.ean}</span>{row.eanIsInternal && <small className="internalCode" title="Código de uso interno; não é GTIN oficial para marketplaces">Uso interno</small>}</td>
                <td>{row.name}</td>
                {kind === "products" ? <><td>{row.stock}</td><td>{row.margin}%</td></> : <><td>{row.components}</td><td>{row.available}</td></>}
                {accounts.map(a => <td key={a.id}><StatusBadge cell={(matrix as any)[row.id][a.id]} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Pricing() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useState(pricingParameters.filter(p=>p.key!=='packaging'));
  const [rules, setRules] = useState(kitRules);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showKitRules, setShowKitRules] = useState(false);
  const [costFile, setCostFile] = useState('');
  const [costFamily, setCostFamily] = useState('Todas');
  const [accountTables, setAccountTables] = useState(() => Object.fromEntries(accounts.map(account => [account.id, account.priceTable])));
  const [matrixRows,setMatrixRows]=useState<any[]>([]);
  const [dbTables,setDbTables]=useState<any[]>([]);
  const [costProducts,setCostProducts]=useState<any[]>([]);
  const [costProductsLoaded,setCostProductsLoaded]=useState(false);
  const [costDownloadMessage,setCostDownloadMessage]=useState('');
  const [uploadProgress,setUploadProgress]=useState(0);
  const [uploadStatus,setUploadStatus]=useState('');
  const [uploadActivities,setUploadActivities]=useState<string[]>([]);
  const [paramStatus,setParamStatus]=useState('');
  const [recalcStatus,setRecalcStatus]=useState('');
  const [recalcBusy,setRecalcBusy]=useState(false);
  const [individualBusy,setIndividualBusy]=useState<string[]>([]);
  const [individualErrors,setIndividualErrors]=useState<Record<string,string>>({});
  const [freightPending,setFreightPending]=useState(false);
  const processing=useRef(new Set<string>());
  const [recalcJob,setRecalcJob]=useState<any>(null);
  const [pricingLogs,setPricingLogs]=useState<any[]>([]);
  const [logUserNames,setLogUserNames]=useState<Record<string,string>>({});
  const [freightRows,setFreightRows]=useState<any[]>([]);
  const [feeRows,setFeeRows]=useState<any[]>([]);
  const [connectedAccounts,setConnectedAccounts]=useState<any[]>([]);
  useEffect(()=>{if(supabase)supabase.from('pricing_tables').select('*').order('channel').order('name').then(({data})=>{if(data)setDbTables(data.map(t=>({...t,adjustment:Number(t.adjustment_percent||0)})));});},[]);
  useEffect(()=>{if(!supabase)return; supabase.from('pricing_parameters').select('code,value,unit').in('code',['tax_percent','safety_reserve_percent','operational_cost']).then(({data})=>{if(!data)return;setParams(current=>current.map(p=>{const code=p.key==='tax'?'tax_percent':p.key==='safety'?'safety_reserve_percent':'operational_cost';const row=data.find((x:any)=>x.code===code);return row?{...p,value:Number(row.value).toFixed(2).replace('.',',')}:p;}));});},[]);
  useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(async({data})=>{if(!data.session)return;const response=await fetch('/api/marketplaces/mercadolivre/status',{headers:{Authorization:'Bearer '+data.session.access_token}});const result=await response.json();if(Array.isArray(result.connections))setConnectedAccounts(result.connections.map((c:any)=>({id:'ml-'+c.seller_id,name:c.account_name||c.seller_id,channel:'Mercado Livre',priceTable:'ml-classic'})));});},[]);
  const accountList = connectedAccounts.length ? connectedAccounts : accounts.filter(a=>a.channel==='Mercado Livre');
  const activeTables = dbTables.length ? dbTables : priceTables;
  const loadMatrix=async(productId?:string)=>{
    if(!supabase)return;
    const rows:any[]=[];
    for(let offset=0;;offset+=500){
      let query=supabase.from('pricing_engine_matrix').select('*').order('product_id').order('pricing_table_id').order('listing_type').range(offset,offset+499);
      if(productId)query=query.eq('product_id',productId);
      const {data,error}=await query;
      if(error){setRecalcStatus(error.message);return;}
      rows.push(...(data||[]));if(!data||data.length<500)break;
    }
    const products:any[]=[];
    for(let offset=0;;offset+=500){let query=supabase.from('products').select('*').order('id').range(offset,offset+499);if(productId)query=query.eq('id',productId);const {data,error}=await query;if(error){setRecalcStatus(error.message);return;}products.push(...(data||[]));if(!data||data.length<500)break;}
    const updated=rows.map(row=>({...products.find(p=>p.id===row.product_id),...row,id:row.product_id}));
    setMatrixRows(old=>productId?[...old.filter(r=>r.product_id!==productId),...updated]:updated);
  };
  useEffect(()=>{void loadMatrix();if(supabase)supabase.from('pricing_recalculation_requests').select('*').contains('scope',{requested_from:'/precificador'}).not('scope->total','is',null).order('requested_at',{ascending:false}).limit(1).then(({data})=>{if(data?.[0]?.scope?.tasks)setRecalcJob(data[0]);});},[]);
  useEffect(()=>{const client=supabase;if(!client){setCostProductsLoaded(true);return;} client.from('products').select('*').order('name').then(({data})=>{if(data)setCostProducts(data);setCostProductsLoaded(true);});},[]);
  useEffect(()=>{const client=supabase;if(client)client.from('pricing_logs').select('*').order('created_at',{ascending:false}).limit(50).then(async({data})=>{if(data){setPricingLogs(data);const ids=[...new Set(data.map((l:any)=>l.user_id).filter(Boolean))];if(ids.length){const {data:profiles}=await client.from('profiles').select('id,full_name').in('id',ids);if(profiles)setLogUserNames(Object.fromEntries(profiles.map((p:any)=>[p.id,p.full_name||'Usuário'])));}}});},[]);
  useEffect(()=>{if(!supabase)return; supabase.from('pricing_engine_freight_rules').select('*,product_families(name)').eq('channel','Mercado Livre').order('max_weight_kg').then(({data})=>{if(data)setFreightRows(data);}); supabase.from('marketplace_fee_rules').select('*,product_families(name)').eq('active',true).order('channel').order('min_price').then(({data})=>{if(data)setFeeRows(data);});},[]);
  const section = location.pathname === '/precificador/calculo' ? 'calc' : location.pathname.includes('tabelas-conta') ? 'accounts' : location.pathname.includes('tabelas-preco') ? 'tables' : location.pathname.includes('parametros') ? 'params' : location.pathname.includes('custos') ? 'costs' : location.pathname.includes('frete') ? 'freight' : location.pathname.includes('tarifas') ? 'tariffs' : location.pathname.includes('matriz') ? 'matrix' : 'log';
  const calcModule = location.pathname.endsWith('/calculo/frete') ? 'freight' : location.pathname.endsWith('/calculo/tarifas') ? 'tariffs' : location.pathname.endsWith('/calculo/matriz') ? 'matrix' : '';
  const isCalcModule = section === 'calc' || section === 'freight' || section === 'tariffs' || section === 'matrix';
  const topSection = isCalcModule ? 'calc' : section;
  const [logPeriod, setLogPeriod] = useState('7'); const [calcDetail,setCalcDetail]=useState('');
  const tableFor = (account: any) => activeTables.filter(table => table.channel === account.channel);
  const recordPricingLog = async (action:string, count:number, details:any) => {
    if (!supabase) return;
    const {data:userData}=await supabase.auth.getUser();
    if(!userData.user) return;
    const {data:log,error}=await supabase.from('pricing_logs').insert({user_id:userData.user.id,action,affected_count:count,details:{...details,user_email:userData.user.email||null}}).select().single();
    if(error){setUploadStatus('Ação concluída, mas o log não pôde ser salvo.');return;}
    if(log)setPricingLogs(current=>[log,...current]);
  };
  const downloadCostModel = async () => {
    const familyId = costFamily === 'Bebidas' ? 1 : costFamily === 'Suplementos' ? 2 : costFamily === 'Fertilizantes' ? 3 : null;
    const rows = (costProductsLoaded ? costProducts : []).filter((p:any)=>familyId===null || Number(p.family_id??1)===familyId);
    if (!rows.length) { setCostDownloadMessage('Nenhum produto encontrado para esta família.'); return; }
    const headers = ['EAN','SKU','Produto','Família','Custo atual','Margem atual (%)','Novo custo','Nova margem (%)'];
    const familyName = (id:any) => ({1:'Bebidas',2:'Suplementos',3:'Fertilizantes'} as any)[Number(id)] || '';
    const csv = [headers,...rows.map((p:any)=>[`="${p.ean||''}"`,`="${p.sku||p.ean||''}"`,p.name||'',familyName(p.family_id),Number(p.unit_cost??p.cost??0).toFixed(2).replace('.',','),Math.round(Number(p.target_margin??p.margin??0)).toString(),'',''])].map(row=>row.map((v:any)=>String(v).replace(/\t|\r?\n/g,' ')).join(';')).join('\r\n');
    const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href=url; link.download=`modelo-atualizacao-custos-${costFamily.toLowerCase().replace(/\s+/g,'-')}.csv`; link.style.display='none'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); setCostDownloadMessage(`${rows.length} produto(s) incluído(s) na planilha.`);
  };
  const processCostFile = async (file?: File) => {
    if (!file) return;
    setCostFile(file.name);setUploadProgress(0);setUploadActivities([]);setUploadStatus('Lendo arquivo…');
    try{
      if(!supabase)throw new Error('Entre no sistema para importar.');
      if(!/\.csv$/i.test(file.name))throw new Error('Salve a planilha como CSV separado por ponto e vírgula.');
      const rows=parseCostCsv(await file.text());
      let updated=0,skipped=0;const failures:string[]=[],changes:any[]=[];
      for(const [index,row] of rows.entries()){
        try{
          if(row.error)throw new Error(row.error);
          if(!Object.keys(row.payload).length){skipped++;continue;}
          const {before,after}=await saveCostRow(supabase,row.ean,row.payload);
          updated++;changes.push({ean:row.ean,old_cost:before.unit_cost,new_cost:after.unit_cost,old_margin:before.target_margin,new_margin:after.target_margin});
          setCostProducts(old=>old.map(p=>p.id===after.id?{...p,...after}:p));
        }catch(error){failures.push('Linha '+row.line+' / '+row.ean+': '+(error instanceof Error?error.message:'Falha ao salvar'));}
        finally{setUploadProgress(Math.round((index+1)/rows.length*100));}
      }
      setUploadProgress(100);setUploadActivities(failures);
      setUploadStatus('Processamento concluído. Total: '+rows.length+' | Atualizações confirmadas: '+updated+' | Sem novos valores: '+skipped+' | Erros: '+failures.length+'.');
      if(updated||failures.length)await recordPricingLog('Atualização de custos e margens por planilha',updated,{file:file.name,updated,errors:failures.length,failures,changes});
      if(updated)await loadMatrix();
    }catch(error){setUploadStatus(error instanceof Error?error.message:'Não foi possível importar o arquivo.');}
  };

  const updateParam = (i: number, value: string) =>
    setParams(p => p.map((x, idx) => idx === i ? { ...x, value } : x));

  const updateRule = (i: number, value: string) => {
    if (/^\d{0,6}([,.]\d{0,2})?$/.test(value))
      setRules(r => r.map((x, idx) => idx === i ? { ...x, reduction: value } : x));
  };
  const formatRule = (i: number) => setRules(r => r.map((x, idx) => {
    if (idx !== i) return x;
    const value = Number(x.reduction.replace(",", "."));
    return { ...x, reduction: (Number.isFinite(value) ? value : 0).toFixed(2).replace(".", ",") };
  }));
  const saveAssumptions = async () => {
    if(!supabase){setParamStatus('Parâmetros prontos para salvar quando o banco estiver conectado.');return;}
    const codeFor=(key:string)=>key==='tax'?'tax_percent':key==='safety'?'safety_reserve_percent':'operational_cost';
    const payload=params.filter(p=>['tax','safety','operational'].includes(p.key)).map(p=>({code:codeFor(p.key),value:Number(p.value.replace(',','.')),updated_at:new Date().toISOString(),confirmed_at:new Date().toISOString()}));
    if(payload.some(p=>!Number.isFinite(p.value)||p.value<0||(p.code==='tax_percent'&&p.value>=100))){setParamStatus('Informe parâmetros válidos.');return;}
    const results=await Promise.all(payload.map(({code,...values})=>supabase!.from('pricing_parameters').update(values).eq('code',code).select('code')));
    const error=results.find(r=>r.error||!r.data?.length);
    setParamStatus(error?'Não foi possível salvar os parâmetros.':'Parâmetros salvos.');
  };
  const requestRecalculation = async (productId?:string) => {
    const key=productId||'general';
    if(!supabase||processing.current.has(key)||processing.current.has('general')||(!productId&&processing.current.size))return;
    processing.current.add(key);
    if(productId){setIndividualBusy(old=>[...old,productId]);setIndividualErrors(old=>({...old,[productId]:''}));}else{setRecalcBusy(true);setRecalcJob(null);setRecalcStatus('');}
    try{
      const call=async(body:any)=>{
        const {data}=await supabase!.auth.getSession();
        if(!data.session)throw new Error('Entre novamente no sistema.');
        const res=await fetch('/api/pricing/recalculate',{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
        const result=await res.json();if(!res.ok){if(result.code==='FREIGHT_PENDING')setFreightPending(true);throw new Error(result.error||'Falha no processamento.');}return result;
      };
      let job=await call(productId?{product_id:productId}:{});
      if(!productId)setRecalcJob(job);
      while(['pending','running'].includes(job.status)){
        job=await call({job_id:job.id});if(!productId)setRecalcJob(job);
        if(job.status==='running')await new Promise(resolve=>window.setTimeout(resolve,5000));
      }
      if(job.status==='failed')throw new Error(job.error_message);
      if(job.scope.blocked.length)throw new Error(job.scope.blocked.map((b:any)=>(matrixRows.find(r=>r.product_id===b.product)?.name||b.product)+': '+b.message).join('\n'));
      if(productId)setRecalcJob((old:any)=>old?{...old,scope:{...old.scope,blocked:(old.scope.blocked||[]).filter((b:any)=>b.product!==productId)}}:old);
    }catch(error){const message=error instanceof Error?error.message:'Falha no processamento.';if(productId)setIndividualErrors(old=>({...old,[productId]:message}));else setRecalcStatus(message);}
    finally{try{await loadMatrix(productId);}finally{processing.current.delete(key);if(productId)setIndividualBusy(old=>old.filter(id=>id!==productId));else setRecalcBusy(false);}}
  };
  const calculationTicket = (row:any) => {
    const d=row.calculation_details;
    if(!d)return 'Preço indisponível. Execute o recálculo e confira as pendências.';
    const money=(value:any)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
    const lines=[row.channel+' / '+(row.listing_type==='premium'?'Premium':row.listing_type==='classic'?'Clássico':'Sem modalidade')+' / Tabela: '+row.pricing_table_name,d.product?.name||row.name,'',
      'Custo original: '+money(d.original_cost),
      'Margem alvo: '+d.target_margin_percent+'% → '+money(d.target_result),
      'Reserva: '+d.safety_reserve_percent+'% → '+money(d.safety_reserve_value),
      'Custo ajustado: '+money(d.adjusted_cost),
      'Embalagem: '+money(d.packaging_total),'Operacional: '+money(d.operational_cost),
      'Imposto: '+d.tax_percent+'% → '+money(d.tax_value),
      'Comissão: '+d.commission_percent+'% → '+money(d.commission_value),
      'Comissão adicional: '+d.additional_commission_percent+'% → '+money(d.additional_commission_value),
      'Taxa fixa: '+money(d.fixed_fee),'Frete: '+money(d.freight_value),
      'Custo adicional: '+money(d.additional_fixed_cost),'Outros custos: '+money(d.other_costs),
      'Acréscimo: '+d.markup_percent+'% → '+money(d.markup_value),
      'Desconto: '+d.discount_percent+'% → '+money(d.discount_value),'',
      'Preço anunciado: '+money(d.announced_price),'Preço efetivo: '+money(d.effective_price),
      'Resultado alvo: '+money(d.target_result),'Resultado calculado: '+money(d.calculated_result)];
    if(d.logistics)lines.push('','PACOTE / LOGÍSTICA',d.logistics.width_cm+' × '+d.logistics.length_cm+' × '+d.logistics.height_cm+' cm | '+d.logistics.weight_kg+' kg','Modelo: '+d.logistics.model,'Grupo: '+(d.logistics.group_number!=null?'G'+String(d.logistics.group_number).padStart(3,'0'):'Legado'),'Família: '+(d.logistics.family_id??d.family?.id),'Quantidade: '+(d.logistics.quantity??d.quantity),'Volume (cm³): '+(d.logistics.volume_cm3??'—'),'Origem: '+d.logistics.source,'Atualização do frete: '+(d.logistics.updated_at||d.logistics.quoted_at),'Frete bruto: '+money(d.logistics.freight_table_value),'Desconto do frete: '+money(d.logistics.freight_discount_value),'Frete líquido: '+money(d.logistics.freight_net_value));
    return lines.join('\n');
  };
  const shopeeUniqueFees = feeRows.filter(r=>r.channel==='Shopee').filter((r,i,a)=>i===a.findIndex(x=>Number(x.min_price)===Number(r.min_price)&&Number(x.max_price||-1)===Number(r.max_price||-1)&&Number(x.commission_percent)===Number(r.commission_percent)&&Number(x.fixed_fee)===Number(r.fixed_fee)));

  return (
    <>
      <PageHeader title="Precificador" subtitle="Margens por produto, premissas e regras editáveis para kits." />
      <div className="pricingMenu" aria-label="Seções do precificador">
        {([['log','Log','≡'],['calc','Cálculo','∑'],['accounts','Tabelas por conta','◎'],['tables','Tabelas de preços','▤'],['params','Parâmetros','⚙'],['costs','Custos de produtos','▣']] as const).map(([id,label,icon])=><button key={id} type="button" className={`roundAction ${topSection===id?'addAction':''}`} title={label} aria-label={label} onClick={()=>navigate({log:'/precificador',calc:'/precificador/calculo',accounts:'/precificador/tabelas-conta',tables:'/precificador/tabelas-preco',params:'/precificador/parametros',costs:'/precificador/custos'}[id])}>{icon}</button>)}
      </div>
      {isCalcModule && <div className="pricingEditorButtons calculationButtons"><div className="pricingSubmenu" aria-label="Módulos do cálculo"><button type="button" className={`roundAction ${calcModule==='freight'?'addAction':''}`} title="Tabela de frete" aria-label="Tabela de frete" onClick={()=>navigate('/precificador/calculo/frete')}>▥</button><button type="button" className={`roundAction ${calcModule==='matrix'?'addAction':''}`} title="Matriz de preços" aria-label="Matriz de preços" onClick={()=>navigate('/precificador/calculo/matriz')}>▦</button><button type="button" className={`roundAction ${calcModule==='tariffs'?'addAction':''}`} title="Parâmetros de tarifas por marketplace" aria-label="Parâmetros de tarifas por marketplace" onClick={()=>navigate('/precificador/calculo/tarifas')}>%</button><button type="button" className="roundAction" title="Recalcular todos os preços" aria-label="Recalcular todos os preços" disabled={recalcBusy} onClick={()=>void requestRecalculation()}>↻</button><button type="button" className="roundAction" title="Atualizar cotações de frete do Mercado Livre" aria-label="Atualizar cotações de frete do Mercado Livre" disabled={recalcBusy} onClick={()=>navigate('/precificador/calculo/frete')}>⇄</button></div></div>}
      {section==='matrix'&&recalcBusy&&recalcJob?.scope?.mode==='general'&&<div className="calculationStatus" role="status"><span>{recalcJob.scope.processed} de {recalcJob.scope.total} produtos calculados</span><progress aria-label="Progresso do cálculo geral" max={recalcJob.scope.total||1} value={recalcJob.scope.processed||0}/></div>}
      {section==='matrix'&&recalcStatus&&<div className="calculationStatus calculationStatusError" role="alert"><span>{recalcStatus}</span><button className="roundAction" title="Dispensar mensagem" aria-label="Dispensar mensagem" onClick={()=>setRecalcStatus('')}>×</button></div>}
      {freightPending&&<div className="calcModalBackdrop"><div className="calcModal" role="dialog" aria-modal="true" aria-label="Existem fretes a serem definidos"><h3>Existem fretes a serem definidos</h3><p>Um ou mais grupos logísticos necessários ainda não possuem frete definido e validado. Complete os fretes antes de calcular os preços.</p><button onClick={()=>setFreightPending(false)}>Fechar</button><button onClick={()=>{setFreightPending(false);navigate('/precificador/calculo/frete?pending=1');}}>Ir para Tabela de Fretes</button></div></div>}
      {section==='log' && <div className="card tableWrap"><div className="sectionHeading"><label className="logPeriod">Período<select value={logPeriod} onChange={e=>setLogPeriod(e.target.value)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="all">Todo o histórico</option></select></label></div><table><thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody>{pricingLogs.length?pricingLogs.map(log=><tr key={log.id}><td>{new Date(log.created_at).toLocaleString('pt-BR')}</td><td>{log.details?.user_email||logUserNames[log.user_id]||'Usuário atual'}</td><td>{log.action} ({log.affected_count} itens)</td><td><button type="button" className="infoButton" title="Baixar detalhes em TXT" onClick={()=>{const blob=new Blob([JSON.stringify(log.details,null,2)],{type:'text/plain;charset=utf-8'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=`log-${log.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);}}>⇩</button></td></tr>):<tr><td>—</td><td>—</td><td>Nenhuma alteração registrada</td><td>Os próximos uploads e cadastros aparecerão aqui.</td></tr>}</tbody></table></div>}
      {section==='costs' && <div className="card spreadsheetActions">
        <div className="spreadsheetButtons"><label className="familySelect">Família<select value={costFamily} onChange={e=>{setCostFamily(e.target.value);setCostDownloadMessage('')}}><option>Todas</option><option>Bebidas</option><option>Suplementos</option><option>Fertilizantes</option></select></label><button type="button" className="roundAction spreadsheetIcon" onClick={downloadCostModel} title="Baixar cadastro completo para atualização no Excel" aria-label="Baixar cadastro completo para atualização no Excel">⇩</button><label className="roundAction spreadsheetIcon fileButton" title="Selecionar planilha" aria-label="Selecionar planilha">⇧<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>processCostFile(e.target.files?.[0])} /></label></div>
        {costDownloadMessage&&<p className="fileSelected" role="status">{costDownloadMessage}</p>}
        {uploadStatus&&<div className="uploadStatus" role="status"><div className="uploadStatusText">{uploadStatus} {uploadProgress>0&&<strong>{uploadProgress}%</strong>}</div><div className="uploadProgress"><span style={{width:`${uploadProgress}%`}} /></div><ul className="uploadActivities">{uploadActivities.map((activity,i)=><li key={i}>{activity}</li>)}</ul><small>{costFile}</small></div>}
        {costFile&&<p className="fileSelected" role="status">Arquivo selecionado: {costFile}. O processamento será feito após a validação por EAN.</p>}
      </div>}
      {section==='freight' && <FreightGroups/>}
      {section==='tariffs' && <div className="marketplaceRuleGroups"><div className="card tableWrap marketplaceRuleGroup"><div className="ruleIntro"><h3>Shopee</h3><p className="muted">A comissão é única para todas as famílias; as faixas abaixo são aplicadas conforme o preço do item.</p></div><table><thead><tr><th>Faixa de preço</th><th>Comissão</th><th>Taxa fixa por item</th></tr></thead><tbody>{shopeeUniqueFees.map(r=><tr key={r.id}><td>{r.max_price?`R$ ${Number(r.min_price||0).toFixed(2).replace('.',',')} a R$ ${Number(r.max_price).toFixed(2).replace('.',',')}`:`Acima de R$ ${Number(r.min_price||0).toFixed(2).replace('.',',')}`}</td><td>{Number(r.commission_percent||0).toFixed(2)}%</td><td>R$ {Number(r.fixed_fee||0).toFixed(2).replace('.',',')}</td></tr>)}</tbody></table></div><div className="card tableWrap marketplaceRuleGroup"><div className="ruleIntro"><h3>Mercado Livre</h3><p className="muted">O frete abaixo de R$ 79 usa a tarifa fixa da família; acima desse valor aplica-se o frete calculado.</p></div><table><thead><tr><th>Família</th><th>Faixa</th><th>Clássico</th><th>Premium</th><th>Taxa fixa</th><th>Frete</th></tr></thead><tbody>{Array.from(new Set(feeRows.filter(r=>r.channel==='Mercado Livre').map(r=>`${r.family_id}-${r.min_price}-${r.max_price}`))).map(key=>{const r=feeRows.find(x=>x.channel==='Mercado Livre'&&`${x.family_id}-${x.min_price}-${x.max_price}`===key);const fr=freightRows.find(x=>x.channel==='Mercado Livre'&&x.family_id===r?.family_id&&((r?.max_price||0)<79.01));return <tr key={key}><td>{r?.product_families?.name||'Todas'}</td><td>{r?.max_price?`Até R$ ${Number(r.max_price).toFixed(2).replace('.',',')}`:`A partir de R$ ${Number(r?.min_price||0).toFixed(2).replace('.',',')}`}</td><td>{Number(feeRows.find(x=>x.channel==='Mercado Livre'&&x.family_id===r?.family_id&&/class/i.test(x.listing_type||''))?.commission_percent||r?.commission_percent||0).toFixed(2)}%</td><td>{Number(feeRows.find(x=>x.channel==='Mercado Livre'&&x.family_id===r?.family_id&&/premium/i.test(x.listing_type||''))?.commission_percent||0).toFixed(2)}%</td><td>R$ {Number(freightRows.find(x=>x.channel==='Mercado Livre'&&x.family_id===r?.family_id&&x.max_order_value)?.freight_value||0).toFixed(2).replace('.',',')}</td><td>{fr?`R$ ${Number(fr.freight_value||0).toFixed(2).replace('.',',')}`:'Calculado'}</td></tr>})}</tbody></table></div></div>}
      {section==='params' && <div className="pricingEditorButtons"><button type="button" className="roundAction" title="Premissas gerais" aria-label="Premissas gerais" onClick={() => { setShowAssumptions(value => !value); setShowKitRules(false); }}>⚙</button><button type="button" className="roundAction" title="Desconto progressivo e kit" aria-label="Desconto progressivo e kit" onClick={() => { setShowKitRules(value => !value); setShowAssumptions(false); }}>▦</button></div>}
      {section==='params' && (showAssumptions || showKitRules) && <div className="grid2">
        {showAssumptions && <div className="card">
          
          <div className="formRows">
            {params.map((p, i) => (
              <label key={p.key}><span>{p.label}</span><div><input value={p.value} onChange={e => updateParam(i, e.target.value)} /><b>{p.suffix}</b></div></label>
            ))}
          </div>
          <button className="primary" onClick={saveAssumptions}>Salvar premissas</button>{paramStatus&&<p role="status" className="muted">{paramStatus}</p>}
        </div>}
        {showKitRules && <div className="card">
          <h3>Desconto progressivo / kit</h3>
          <table className="compact horizontalRules"><tbody><tr><th>Quantidade</th>{rules.map(r=><th key={r.qty}>{r.qty}</th>)}</tr><tr><th>Redução (p.p.)</th>{rules.map((r,i)=><td key={r.qty}><input aria-label={`Redução para ${r.qty} unidades`} inputMode="decimal" value={r.reduction} onChange={e=>updateRule(i,e.target.value)} onBlur={()=>formatRule(i)} /></td>)}</tr></tbody></table>
          <button className="primary" disabled>Salvar regras</button>
        </div>}
      </div>}
      {section==='accounts' && <div className="accountTableGroups">{Array.from(new Set(accountList.map(a=>a.channel))).map(channel=>{const channelAccounts=accountList.filter(a=>a.channel===channel);return <div className="card accountTableGroup" key={channel}><div className="sectionHeading"><h3>{channel}</h3></div>{channelAccounts.map(account=><div className="accountTableRow" key={account.id}><strong>{account.name}</strong><select aria-label={`Tabela da conta ${account.name}`} value={accountTables[account.id]||''} onChange={e=>setAccountTables(current=>({...current,[account.id]:e.target.value}))}>{tableFor(account).map(table=><option key={table.id} value={table.id}>{table.name}</option>)}</select></div>)}</div>})}</div>}
      {section==='matrix' && <PricingMatrix rows={matrixRows} tables={dbTables} blocked={recalcJob?.scope?.blocked||[]} onDetail={row=>setCalcDetail(calculationTicket(row))} onCalculate={id=>void requestRecalculation(id)} busyProducts={individualBusy} generalBusy={recalcBusy} errors={individualErrors}/>}
      {calcDetail&&<div className="calcModalBackdrop" onClick={()=>setCalcDetail('')}><div className="calcModal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="calcModalClose" onClick={()=>setCalcDetail('')}>×</button><h3>Memória de cálculo</h3><pre className="calculationTicket">{calcDetail}</pre></div></div>}
      {section==='tables' && <div className="priceTableGroups">{['Mercado Livre','Shopee','Ruta Direct Shop'].map(channel=>{const ts=activeTables.filter(t=>t.channel===channel);return <div className="card priceTableGroup" key={channel}><div className="sectionHeading"><h3>{channel}</h3><button className="roundAction addAction" type="button" title="Cadastrar tabela" aria-label="Cadastrar tabela" disabled>+</button></div><table><tbody>{ts.map(t=><tr key={t.id}><td>{t.name}</td><td><button className="infoButton" type="button" title={t.adjustment?'Preço com gordura para compensar 10% de desconto e preservar o resultado planejado.':'Preço calculado com custo, margem e premissas para entregar o resultado planejado.'} aria-label="Detalhes do cálculo">ⓘ</button></td></tr>)}</tbody></table></div>})}</div>}</>
  );
}

function Accounts() {
  return (
    <>
      <PageHeader title="Contas" subtitle="Contas conectadas e canais de venda." action="Adicionar conta" />
      <div className="cards">
        {accounts.map(a => (
          <div className="card account" key={a.id}>
            <span className="channel">{a.channel}</span>
            <h3>{a.name}</h3>
            <p><span className="dot" /> Conta de demonstração</p>
            <button disabled>Configurar</button>
          </div>
        ))}
      </div>
    </>
  );
}

function Users() {
  return (
    <>
      <PageHeader title="Usuários" subtitle="Permissões funcionais e acesso por conta." action="Criar usuário" />
      <div className="card tableWrap">
        <table>
          <thead><tr><th>Usuário</th><th>Perfil</th><th>Contas</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr><td>Administrador</td><td>Admin</td><td>Todas</td><td><span className="pill green">Ativo</span></td><td><button disabled>Editar</button></td></tr>
            <tr><td>Operador Demo</td><td>Operacional</td><td>ML Principal, Shopee Principal</td><td><span className="pill green">Ativo</span></td><td><button disabled>Editar</button></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function Placeholder({ title, description }: { title: string; description: string }) {
  return <><PageHeader title={title} subtitle={description} /><div className="card empty">Módulo preparado para a próxima etapa da V1.</div></>;
}

function AppShell() {
  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <p className="demoNotice" role="status">Demonstração — dados fictícios. Alterações não são salvas e nenhuma ação é enviada aos canais.</p>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/produtos" element={<Matrix key="products" kind="products" />} />
          <Route path="/kits" element={<Matrix key="kits" kind="kits" />} />
          <Route path="/precificador/*" element={<Pricing />} />
          <Route path="/anuncios" element={<Placeholder title="Anúncios" description="Fila de preparação, validação, publicação e sincronização." />} />
          <Route path="/pedidos" element={<Placeholder title="Pedidos" description="Pedidos centralizados por canal e impacto no estoque físico." />} />
          <Route path="/contas" element={<Accounts />} />
          <Route path="/usuarios" element={<Users />} />
          <Route path="/configuracoes" element={<Placeholder title="Configurações" description="Premissas gerais, canais, integrações e auditoria." />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
export { Sidebar, Dashboard, Matrix, Pricing, Accounts, Users, Placeholder };
















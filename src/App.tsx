import TopNavigation from './TopNavigation';
import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { accounts, kits, kitMatrix, kitRules, pricingParameters, products, productMatrix, priceTables, type ChannelCell } from "./demo";
import { supabase } from './lib/supabase';

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
  const [params, setParams] = useState(pricingParameters);
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
  const [pricingLogs,setPricingLogs]=useState<any[]>([]);
  const [logUserNames,setLogUserNames]=useState<Record<string,string>>({});
  const [freightRows,setFreightRows]=useState<any[]>([]);
  const [feeRows,setFeeRows]=useState<any[]>([]);
  const [connectedAccounts,setConnectedAccounts]=useState<any[]>([]);
  useEffect(()=>{if(supabase)supabase.from('pricing_tables').select('*').order('channel').order('name').then(({data})=>{if(data)setDbTables(data.map(t=>({...t,adjustment:Number(t.adjustment_percent||0)})));});},[]);
  useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(async({data})=>{if(!data.session)return;const response=await fetch('/api/marketplaces/mercadolivre/status',{headers:{Authorization:'Bearer '+data.session.access_token}});const result=await response.json();if(Array.isArray(result.connections))setConnectedAccounts(result.connections.map((c:any)=>({id:'ml-'+c.seller_id,name:c.account_name||c.seller_id,channel:'Mercado Livre',priceTable:'ml-classic'})));});},[]);
  const accountList = connectedAccounts.length ? connectedAccounts : accounts.filter(a=>a.channel==='Mercado Livre');
  const activeTables = dbTables.length ? dbTables : priceTables;
  useEffect(()=>{if(supabase)supabase.from('pricing_product_matrix').select('*').order('name').then(({data})=>{if(data)setMatrixRows(data);});},[]);
  useEffect(()=>{if(!supabase){setCostProductsLoaded(true);return;} supabase.from('products').select('*').order('name').then(({data})=>{if(data)setCostProducts(data);}).finally(()=>setCostProductsLoaded(true));},[]);
  useEffect(()=>{if(supabase)supabase.from('pricing_logs').select('*').order('created_at',{ascending:false}).limit(50).then(async({data})=>{if(data){setPricingLogs(data);const ids=[...new Set(data.map((l:any)=>l.user_id).filter(Boolean))];if(ids.length){const {data:profiles}=await supabase.from('profiles').select('id,full_name').in('id',ids);if(profiles)setLogUserNames(Object.fromEntries(profiles.map((p:any)=>[p.id,p.full_name||'Usuário'])));}}});},[]);
  useEffect(()=>{if(!supabase)return; supabase.from('marketplace_freight_rules').select('*,product_families(name)').eq('active',true).order('channel').order('max_weight_kg').then(({data})=>{if(data)setFreightRows(data);}); supabase.from('marketplace_fee_rules').select('*,product_families(name)').eq('active',true).order('channel').order('min_price').then(({data})=>{if(data)setFeeRows(data);});},[]);
  const section = location.pathname === '/precificador/calculo' ? 'calc' : location.pathname.includes('tabelas-conta') ? 'accounts' : location.pathname.includes('tabelas-preco') ? 'tables' : location.pathname.includes('parametros') ? 'params' : location.pathname.includes('custos') ? 'costs' : location.pathname.includes('frete') ? 'freight' : location.pathname.includes('tarifas') ? 'tariffs' : location.pathname.includes('matriz') ? 'matrix' : 'log';
  const calcModule = location.pathname.includes('/calculo/frete') ? 'freight' : location.pathname.includes('/calculo/tarifas') ? 'tariffs' : 'matrix';
  const isCalcModule = section === 'calc' || section === 'freight' || section === 'tariffs' || section === 'matrix';
  const topSection = isCalcModule ? 'calc' : section;
  const [logPeriod, setLogPeriod] = useState('7');
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
    const csv = [headers,...rows.map((p:any)=>[`="${p.ean||''}"`,`="${p.sku||p.ean||''}"`,p.name||'',familyName(p.family_id),Number(p.unit_cost??p.cost??0).toFixed(2).replace('.',','),String(Number(p.target_margin??p.margin??0)/100).replace('.',','),'',''])].map(row=>row.map((v:any)=>String(v).replace(/\t|\r?\n/g,' ')).join(';')).join('\r\n');
    const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href=url; link.download=`modelo-atualizacao-custos-${costFamily.toLowerCase().replace(/\s+/g,'-')}.csv`; link.style.display='none'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); setCostDownloadMessage(`${rows.length} produto(s) incluído(s) na planilha.`);
  };
  const processCostFile = (file?: File) => {
    if (!file) return;
    setCostFile(file.name); setUploadActivities(['1/4 Arquivo recebido']); setUploadProgress(5); setUploadStatus('Iniciando leitura…');
    if (/\.xlsx?$/i.test(file.name)) { setUploadProgress(100); setUploadActivities(['1/2 Arquivo recebido','2/2 Não foi possível ler XLSX diretamente no navegador','Salve a planilha como CSV (separado por ponto e vírgula) e envie novamente.']); setUploadStatus('Processamento interrompido: formato XLSX não suportado nesta etapa.'); return; }
    const reader = new FileReader();
    reader.onprogress = event => { if (event.lengthComputable) { const pct=Math.max(5, Math.round(event.loaded / event.total * 45)); setUploadProgress(pct); setUploadActivities(current=>current.length<2?[...current,'2/4 Leitura do arquivo concluída']:current); } };
    reader.onload = () => {
      setUploadProgress(45); setUploadActivities(current=>[...current,'2/4 Leitura do arquivo concluída']); setUploadStatus('Validando colunas EAN, custo e margem…');
      window.setTimeout(()=>{setUploadProgress(65);setUploadActivities(current=>[...current,'3/4 Colunas conferidas; validando EANs…']);setUploadStatus('Conferindo os EANs com o cadastro de produtos…');},1200);
      window.setTimeout(async()=>{const text=String(reader.result||'').replace(/^\ufeff/,''); const lines=text.split(/\r?\n/).filter(Boolean); const dataLines=lines.slice(1); let updated=0; let errors=0; const changes:any[]=[]; const normalizeEAN=(value:string)=>{const s=value.trim().replace(/^"|"$/g,''); if(/e\+?/i.test(s)){const n=Number(s); return Number.isFinite(n)?n.toLocaleString('fullwide',{useGrouping:false}):s;} return s.replace(/\D/g,'');}; const parseNumber=(value:string)=>{const s=value.replace(/R\$|%/gi,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.'); const n=Number(s); return Number.isFinite(n)?(n>=0&&n<=1?n*100:n):NaN;}; if(supabase){for(const line of dataLines){const cols=line.split(';').map(v=>v.replace(/^"|"$/g,'').replace(/""/g,'"')); const ean=normalizeEAN(cols[0]||''); const cost=parseNumber(cols[6]||''); const margin=parseNumber(cols[7]||''); if(!ean||(!Number.isFinite(cost)&&!Number.isFinite(margin)))continue; const current=costProducts.find(p=>normalizeEAN(String(p.ean))===ean); if(!current)continue; const payload:any={}; if(Number.isFinite(cost))payload.unit_cost=cost; if(Number.isFinite(margin))payload.target_margin=margin; const result=await supabase.from('products').update(payload).eq('ean',current?.ean||ean); if(result.error)errors++; else {updated++; changes.push({ean,old_cost:current?.unit_cost??null,new_cost:payload.unit_cost??current?.unit_cost??null,old_margin:current?.target_margin??null,new_margin:payload.target_margin??current?.target_margin??null});} }} setUploadProgress(100); setUploadActivities(current=>[...current,`4/4 ${updated} produto(s) atualizado(s)${errors?`; ${errors} erro(s)`:''}`]); setUploadStatus(errors?`Processamento concluído. Total: ${dataLines.length} | Sucesso: ${updated} | Erros: ${errors}.`:`Processamento concluído. Total: ${dataLines.length} | Sucesso: ${updated} produto(s) | Erros: ${errors}.`); if(updated||errors)await recordPricingLog('Atualização de custos por planilha',updated,{file:file.name,updated,errors,changes});},5000);
    };
    reader.onerror = () => { setUploadProgress(0); setUploadStatus('Não foi possível ler o arquivo. Tente novamente.'); };
    reader.readAsText(file);
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

  return (
    <>
      <PageHeader title="Precificador" subtitle="Margens por produto, premissas e regras editáveis para kits." />
      <div className="pricingMenu" aria-label="Seções do precificador">
        {([['log','Log','≡'],['calc','Cálculo','∑'],['accounts','Tabelas por conta','◎'],['tables','Tabelas de preços','▤'],['params','Parâmetros','⚙'],['costs','Custos de produtos','▣']] as const).map(([id,label,icon])=><button key={id} type="button" className={`roundAction ${topSection===id?'addAction':''}`} title={label} aria-label={label} onClick={()=>navigate({log:'/precificador',calc:'/precificador/calculo',accounts:'/precificador/tabelas-conta',tables:'/precificador/tabelas-preco',params:'/precificador/parametros',costs:'/precificador/custos'}[id])}>{icon}</button>)}
      </div>
      {isCalcModule && <div className="calcModulePanel"><div className="pricingSubmenu" aria-label="Módulos do cálculo"><button type="button" className={`roundAction ${calcModule==='freight'?'addAction':''}`} title="Tabela de frete" aria-label="Tabela de frete" onClick={()=>navigate('/precificador/calculo/frete')}>▥</button><button type="button" className={`roundAction ${calcModule==='matrix'?'addAction':''}`} title="Matriz de preços" aria-label="Matriz de preços" onClick={()=>navigate('/precificador/calculo/matriz')}>▦</button><button type="button" className={`roundAction ${calcModule==='tariffs'?'addAction':''}`} title="Parâmetros de tarifas por marketplace" aria-label="Parâmetros de tarifas por marketplace" onClick={()=>navigate('/precificador/calculo/tarifas')}>%</button></div></div>}
      {section==='log' && <div className="card tableWrap"><div className="sectionHeading"><label className="logPeriod">Período<select value={logPeriod} onChange={e=>setLogPeriod(e.target.value)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="all">Todo o histórico</option></select></label></div><table><thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody>{pricingLogs.length?pricingLogs.map(log=><tr key={log.id}><td>{new Date(log.created_at).toLocaleString('pt-BR')}</td><td>{log.details?.user_email||logUserNames[log.user_id]||'Usuário atual'}</td><td>{log.action} ({log.affected_count} itens)</td><td><button type="button" className="infoButton" title="Baixar detalhes em TXT" onClick={()=>{const blob=new Blob([JSON.stringify(log.details,null,2)],{type:'text/plain;charset=utf-8'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=`log-${log.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);}}>⇩</button></td></tr>):<tr><td>—</td><td>—</td><td>Nenhuma alteração registrada</td><td>Os próximos uploads e cadastros aparecerão aqui.</td></tr>}</tbody></table></div>}
      {section==='costs' && <div className="card spreadsheetActions">
        <div className="spreadsheetButtons"><label className="familySelect">Família<select value={costFamily} onChange={e=>{setCostFamily(e.target.value);setCostDownloadMessage('')}}><option>Todas</option><option>Bebidas</option><option>Suplementos</option><option>Fertilizantes</option></select></label><button type="button" className="roundAction spreadsheetIcon" onClick={downloadCostModel} title="Baixar cadastro completo para atualização no Excel" aria-label="Baixar cadastro completo para atualização no Excel">⇩</button><label className="roundAction spreadsheetIcon fileButton" title="Selecionar planilha" aria-label="Selecionar planilha">⇧<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>processCostFile(e.target.files?.[0])} /></label></div>
        {costDownloadMessage&&<p className="fileSelected" role="status">{costDownloadMessage}</p>}
        {uploadStatus&&<div className="uploadStatus" role="status"><div className="uploadStatusText">{uploadStatus} {uploadProgress>0&&<strong>{uploadProgress}%</strong>}</div><div className="uploadProgress"><span style={{width:`${uploadProgress}%`}} /></div><ul className="uploadActivities">{uploadActivities.map((activity,i)=><li key={i}>{activity}</li>)}</ul><small>{costFile}</small></div>}
        {costFile&&<p className="fileSelected" role="status">Arquivo selecionado: {costFile}. O processamento será feito após a validação por EAN.</p>}
      </div>}
      {section==='freight' && <div className="marketplaceRuleGroups">{Array.from(new Set(freightRows.map(r=>r.channel))).map(channel=><div className="card tableWrap marketplaceRuleGroup" key={channel}><div className="ruleIntro"><h3>{channel}</h3><p className="muted">Valores de frete usados pelo cálculo local, conforme peso, família e faixa cadastrada.</p></div><table><thead><tr><th>Família</th><th>Até peso (kg)</th><th>Faixa do pedido</th><th>Frete aplicado</th><th>Premissa</th></tr></thead><tbody>{freightRows.filter(r=>r.channel===channel).map(r=><tr key={r.id}><td>{r.product_families?.name||'Todas'}</td><td>{r.max_weight_kg??'—'}</td><td>{r.max_order_value?`Até R$ ${Number(r.max_order_value).toFixed(2).replace('.',',')}`:'Acima do limite'}</td><td>R$ {Number(r.freight_value||0).toFixed(2).replace('.',',')}</td><td>{r.notes||'Frete conforme tabela do canal.'}</td></tr>)}</tbody></table>{!freightRows.filter(r=>r.channel===channel).length&&<p className="muted">Nenhuma regra cadastrada.</p>}</div>)}{!freightRows.length&&<div className="card"><p className="muted">Carregando as premissas de frete…</p></div>}</div>}
      {section==='tariffs' && <div className="marketplaceRuleGroups"><div className="card tableWrap marketplaceRuleGroup"><div className="ruleIntro"><h3>Shopee</h3><p className="muted">A comissão é única para todas as famílias; as faixas abaixo são aplicadas conforme o preço do item.</p></div><table><thead><tr><th>Faixa de preço</th><th>Comissão</th><th>Taxa fixa por item</th></tr></thead><tbody>{feeRows.filter(r=>r.channel==='Shopee').map(r=><tr key={r.id}><td>{r.max_price?`R$ ${Number(r.min_price||0).toFixed(2).replace('.',',')} a R$ ${Number(r.max_price).toFixed(2).replace('.',',')}`:`Acima de R$ ${Number(r.min_price||0).toFixed(2).replace('.',',')}`}</td><td>{Number(r.commission_percent||0).toFixed(2)}%</td><td>R$ {Number(r.fixed_fee||0).toFixed(2).replace('.',',')}</td></tr>)}</tbody></table></div><div className="card tableWrap marketplaceRuleGroup"><div className="ruleIntro"><h3>Mercado Livre</h3><p className="muted">O frete abaixo de R$ 79 usa a tarifa fixa da família; acima desse valor aplica-se o frete calculado.</p></div><table><thead><tr><th>Família</th><th>Faixa</th><th>Clássico</th><th>Premium</th><th>Frete</th></tr></thead><tbody>{Array.from(new Set(feeRows.filter(r=>r.channel==='Mercado Livre').map(r=>`${r.family_id}-${r.min_price}-${r.max_price}`))).map(key=>{const r=feeRows.find(x=>x.channel==='Mercado Livre'&&`${x.family_id}-${x.min_price}-${x.max_price}`===key);const fr=freightRows.find(x=>x.channel==='Mercado Livre'&&x.family_id===r?.family_id&&((r?.max_price||0)<79.01));return <tr key={key}><td>{r?.product_families?.name||'Todas'}</td><td>{r?.max_price?`Até R$ ${Number(r.max_price).toFixed(2).replace('.',',')}`:`A partir de R$ ${Number(r?.min_price||0).toFixed(2).replace('.',',')}`}</td><td>{Number(feeRows.find(x=>x.channel==='Mercado Livre'&&x.family_id===r?.family_id&&/class/i.test(x.listing_type||''))?.commission_percent||r?.commission_percent||0).toFixed(2)}%</td><td>{Number(feeRows.find(x=>x.channel==='Mercado Livre'&&x.family_id===r?.family_id&&/premium/i.test(x.listing_type||''))?.commission_percent||0).toFixed(2)}%</td><td>{fr?`R$ ${Number(fr.freight_value||0).toFixed(2).replace('.',',')}`:'Calculado'}</td></tr>})}</tbody></table></div></div>}
      {section==='params' && <div className="pricingEditorButtons"><button type="button" className="roundAction" title="Premissas gerais" aria-label="Premissas gerais" onClick={() => { setShowAssumptions(value => !value); setShowKitRules(false); }}>⚙</button><button type="button" className="roundAction" title="Desconto progressivo e kit" aria-label="Desconto progressivo e kit" onClick={() => { setShowKitRules(value => !value); setShowAssumptions(false); }}>▦</button></div>}
      {section==='params' && (showAssumptions || showKitRules) && <div className="grid2">
        {showAssumptions && <div className="card">
          
          <div className="formRows">
            {params.map((p, i) => (
              <label key={p.key}><span>{p.label}</span><div><input value={p.value} onChange={e => updateParam(i, e.target.value)} /><b>{p.suffix}</b></div></label>
            ))}
          </div>
          <button className="primary" disabled>Salvar premissas</button>
        </div>}
        {showKitRules && <div className="card">
          <h3>Desconto progressivo / kit</h3>
          <table className="compact horizontalRules"><tbody><tr><th>Quantidade</th>{rules.map(r=><th key={r.qty}>{r.qty}</th>)}</tr><tr><th>Redução (p.p.)</th>{rules.map((r,i)=><td key={r.qty}><input aria-label={`Redução para ${r.qty} unidades`} inputMode="decimal" value={r.reduction} onChange={e=>updateRule(i,e.target.value)} onBlur={()=>formatRule(i)} /></td>)}</tr></tbody></table>
          <button className="primary" disabled>Salvar regras</button>
        </div>}
      </div>}
      {section==='accounts' && <div className="accountTableGroups">{Array.from(new Set(accountList.map(a=>a.channel))).map(channel=>{const channelAccounts=accountList.filter(a=>a.channel===channel);return <div className="card accountTableGroup" key={channel}><div className="sectionHeading"><h3>{channel}</h3></div>{channelAccounts.map(account=><div className="accountTableRow" key={account.id}><strong>{account.name}</strong><select aria-label={`Tabela da conta ${account.name}`} value={accountTables[account.id]||''} onChange={e=>setAccountTables(current=>({...current,[account.id]:e.target.value}))}>{tableFor(account).map(table=><option key={table.id} value={table.id}>{table.name}</option>)}</select></div>)}</div>})}</div>}
      {section==='matrix' && <div className="card tableWrap"><div className="matrixLegend"><span><b>1</b> ML Clássico Padrão</span><span><b>2</b> ML Premium Padrão</span><span><b>3</b> ML Clássico Campanha +10%</span><span><b>4</b> ML Premium Campanha +10%</span><span><b>5</b> Shopee Padrão</span><span><b>6</b> Shopee Campanha +10%</span></div><table><thead><tr><th>EAN</th><th>Produto</th><th>Família</th><th>Custo</th><th>Margem</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th></tr></thead><tbody>{Array.from(new Map(matrixRows.map(row=>[row.id,row])).values()).map(product=>{const rows=matrixRows.filter(row=>row.id===product.id);const price=(name:string)=>{const campaign=/campanha/i.test(name);const channel=/shopee/i.test(name)?'Shopee':'Mercado Livre';return rows.find(row=>row.channel===channel&&((campaign&&Number(row.adjustment_percent)>0)||(!campaign&&!Number(row.adjustment_percent))))?.calculated_price;};return <tr key={product.id}><td>{product.ean}</td><td>{product.name}</td><td>{product.family_name}</td><td>R$ {Number(product.unit_cost||0).toFixed(2).replace('.',',')}</td><td>{Number(product.target_margin||0).toFixed(2).replace('.',',')}%</td>{['Preço Clássico','Preço Premium','Clássico + 10% campanha','Premium + 10% campanha','Preço normal','Normal + 10% campanha'].map(name=><td key={name} title={price(name)!=null ? ("Custo R$ " + Number(product.unit_cost).toFixed(2) + " | Margem " + product.target_margin + "% | Comissão " + product.commission_percent + "% | Taxa fixa R$ " + Number(product.commission_fixed_fee).toFixed(2) + " | Frete R$ " + Number(product.freight_value).toFixed(2) + " | Lucro líquido R$ " + (Number(price(name))-Number(product.unit_cost)-(Number(price(name))*Number(product.commission_percent)/100)-Number(product.commission_fixed_fee)-Number(product.freight_value)).toFixed(2)) : "Preço indisponível"}>{price(name)!=null?'R$ '+Number(price(name)).toFixed(2).replace('.',','):'—'}</td>)}</tr>})}</tbody></table>{!matrixRows.length&&<p className="muted">Nenhum produto calculado.</p>}</div>}
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











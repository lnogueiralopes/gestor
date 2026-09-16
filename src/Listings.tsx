import {useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase';
import {families} from './ProductFamilies';
type Row=Record<string,any>;
const money=(v:unknown)=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export async function listingCall(action:string,body?:unknown){
 const {data}=await supabase!.auth.getSession();if(!data.session)throw new Error('Entre novamente no Gestor.');
 const r=await fetch('/api/listings/'+action,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const result=await r.json();if(!r.ok)throw new Error(result.error||'Não foi possível concluir a operação.');return result;
}
export default function Listings(){
 const [data,setData]=useState<Row>({products:[],accounts:[],settings:[],tables:[],listings:[]});
 const [step,setStep]=useState(0),[selected,setSelected]=useState<string[]>([]),[accountId,setAccountId]=useState(''),[tableId,setTableId]=useState('');
 const [mode,setMode]=useState('classic'),[filter,setFilter]=useState(''),[family,setFamily]=useState('');
 const [forms,setForms]=useState<Record<string,Row>>({}),[prepared,setPrepared]=useState<Row[]>([]),[results,setResults]=useState<Row[]>([]);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
 const lock=useRef(false);
 const run=async(fn:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Falha na operação.');}finally{lock.current=false;setBusy(false);setStatus('');}};
 const load=async()=>setData(await listingCall('bootstrap'));
 useEffect(()=>{void run(load);},[]);
 const products:Row[]=data.products.filter((p:Row)=>selected.includes(p.id));
 const visible:Row[]=data.products.filter((p:Row)=>(!family||String(p.family_id)===family)&&(!filter||[p.name,p.ean,p.sku,p.brand].some(v=>String(v||'').toLowerCase().includes(filter.toLowerCase()))));
 const modes=mode==='both'?['classic','premium']:[mode];
 const account=data.accounts.find((a:Row)=>a.id===accountId),table=data.tables.find((t:Row)=>t.id===tableId);
 const update=(id:string,patch:Row)=>setForms(old=>({...old,[id]:{...old[id],...patch}}));
 const category=async(p:Row,categoryId?:string)=>{
   setStatus('Consultando categoria: '+p.name);
   const info=await listingCall('category',{account_id:accountId,product_id:p.id,category_id:categoryId||undefined});
   setForms(old=>({...old,[p.id]:{...info,title:old[p.id]?.title||p.short_title||p.name,category_id:info.category.id,values:Object.fromEntries(info.attributes.map((a:Row)=>[a.id,old[p.id]?.values?.[a.id]||a.suggested_value||'']))}}));
 };
 const validate=async()=>{
   const output:Row[]=[];
   for(const p of products)for(const modality of modes){
     setStatus('Validando '+(output.length+1)+' de '+products.length*modes.length+' anúncios');
     const form=forms[p.id];
     try{if(!form?.category_id)throw new Error('Selecione e carregue a categoria.');
       const result=await listingCall('prepare',{account_id:accountId,product_id:p.id,modality,title:form.title,category_id:form.category_id,attributes:Object.entries(form.values||{}).filter(([,v])=>v).map(([id,value_name])=>({id,value_name}))});output.push({...result,product_id:p.id,name:p.name,modality});
     }catch(e){output.push({product_id:p.id,name:p.name,modality,publication_state:'error',last_error:e instanceof Error?e.message:'Falha na validação.'});}
     setPrepared([...output]);
   }
   setStep(5);setConfirm(false);
 };
 const publish=async()=>{
   setStep(6);const output:Row[]=[];
   for(const draft of prepared){
     setStatus('Criando '+(output.length+1)+' de '+prepared.length+' anúncios');
     try{const result=await listingCall('publish',{listing_id:draft.id});output.push({...draft,...result,ok:true});}
     catch(e){output.push({...draft,ok:false,last_error:e instanceof Error?e.message:'Falha no envio.'});}
     setResults([...output]);
   }
   await load();
 };
 const start=()=>{setSelected([]);setPrepared([]);setResults([]);setForms({});setConfirm(false);setError('');setStep(1);};
 return <section className="listingPage">
   <div className="actionPanel"><button className="roundAction addAction" title="Criar anúncios" aria-label="Criar anúncios" disabled={busy} onClick={start}>+</button><button className="roundAction" title="Atualizar anúncios" aria-label="Atualizar anúncios" disabled={busy} onClick={()=>void run(load)}>↻</button></div>
   {error&&<div className="calculationStatus calculationStatusError" role="alert"><span>{error}</span><button className="roundAction" aria-label="Fechar mensagem" onClick={()=>setError('')}>×</button></div>}
   {busy&&<div className="calculationStatus" role="status">{status||'Carregando…'}</div>}
   {step>0&&<div className="card listingWizard">
     <ol className="listingSteps">{['Produtos','Conta','Modalidade','Dados','Revisão','Resultado'].map((s,i)=><li key={s} aria-current={step===i+1?'step':undefined}>{i+1}. {s}</li>)}</ol>
     {step===1&&<><h3>Selecione os produtos</h3><div className="listingFilters"><input aria-label="Buscar produto" placeholder="Nome, EAN ou marca" value={filter} onChange={e=>setFilter(e.target.value)}/><select aria-label="Família" value={family} onChange={e=>setFamily(e.target.value)}><option value="">Todas as famílias</option>{families.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div><label><input type="checkbox" checked={visible.length>0&&visible.every(p=>selected.includes(p.id))} onChange={e=>setSelected(e.target.checked?[...new Set([...selected,...visible.map(p=>p.id)])]:selected.filter(id=>!visible.some(p=>p.id===id)))}/> Selecionar produtos filtrados</label><div className="listingProducts">{visible.map(p=><label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>setSelected(e.target.checked?[...selected,p.id]:selected.filter(id=>id!==p.id))}/><span>{p.name}<small>{p.ean}</small></span></label>)}</div><p>{selected.length} produto(s) selecionado(s)</p></>}
     {step===2&&<><h3>Conta Mercado Livre</h3><label>Conta<select value={accountId} onChange={e=>{setAccountId(e.target.value);setTableId(data.settings.find((s:Row)=>s.account_id===e.target.value)?.pricing_table_id||'');setForms({});}}><option value="">Selecione</option>{data.accounts.map((a:Row)=><option key={a.id} value={a.id}>{a.name} · {a.external_account_id}</option>)}</select></label>{!data.accounts.length&&<p>Conecte uma conta em <a href="/contas">Marketplace</a>.</p>}{accountId&&<><label>Tabela de preços da conta<select value={tableId} onChange={e=>setTableId(e.target.value)}><option value="">Selecione</option>{data.tables.map((t:Row)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><p>A conta utiliza uma única tabela. Ao continuar, esta associação será salva para os próximos anúncios.</p></>}</>}
     {step===3&&<><h3>Modalidade dos anúncios</h3>{[['classic','Clássico'],['premium','Premium'],['both','Clássico e Premium']].map(([v,label])=><label className="listingChoice" key={v}><input type="radio" name="modality" checked={mode===v} onChange={()=>setMode(v)}/>{label}</label>)}<p>{products.length*modes.length} anúncio(s), com o preço de cada modalidade na tabela <strong>{table?.name}</strong>.</p><p>Quantidade de teste: <strong>1 por anúncio</strong>. Os anúncios poderão ficar disponíveis para venda após a confirmação final.</p></>}
     {step===4&&<><h3>Dados dos anúncios</h3><p>Revise título, imagens e atributos. Categoria e obrigatoriedades são consultadas no Mercado Livre.</p><button disabled={busy} onClick={()=>void run(async()=>{for(const p of products)if(!forms[p.id]?.category)await category(p);})}>Carregar categorias dos produtos</button>{products.map(p=>{const form=forms[p.id]||{};return <details key={p.id} className="listingProductDetails" open={products.length===1||undefined}><summary>{p.name} · {form.category?.name||'Categoria pendente'}</summary><label>Título / nome do produto<input value={form.title??p.short_title??p.name} onChange={e=>update(p.id,{title:e.target.value})}/></label><div className="listingPictures">{Array.from({length:6},(_,i)=>p['image_'+(i+1)+'_url']).filter(Boolean).map((src,i)=><img key={i} src={String(src).replace(/^\/image\//,'/images/')} alt={'Imagem '+(i+1)+' de '+p.name}/>)}</div><label>Categoria Mercado Livre<input value={form.category_id||''} placeholder="MLB…" onChange={e=>update(p.id,{category_id:e.target.value,category:null})}/></label>{form.suggestions?.length>1&&<select aria-label={'Sugestão de categoria para '+p.name} value={form.category_id} onChange={e=>void run(()=>category(p,e.target.value))}>{form.suggestions.map((c:Row)=><option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}</select>}<button disabled={busy} onClick={()=>void run(()=>category(p,form.category_id))}>Carregar categoria e atributos</button>{form.category&&<div className="listingAttributes">{(form.attributes||[]).filter((a:Row)=>a.tags?.required||a.tags?.catalog_required||a.tags?.conditional_required||form.values?.[a.id]).map((a:Row)=><label key={a.id}>{a.name}{a.tags?.required?' *':''}<input list={'attr-'+p.id+'-'+a.id} value={form.values?.[a.id]||''} onChange={e=>update(p.id,{values:{...form.values,[a.id]:e.target.value}})}/><datalist id={'attr-'+p.id+'-'+a.id}>{(a.values||[]).map((v:Row)=><option key={v.id} value={v.name}/>)}</datalist></label>)}</div>}<details><summary>Outros atributos da categoria</summary>{(form.attributes||[]).filter((a:Row)=>!a.tags?.required&&!a.tags?.catalog_required&&!a.tags?.conditional_required&&!a.suggested_value).map((a:Row)=><label key={a.id}>{a.name}<input value={form.values?.[a.id]||''} onChange={e=>update(p.id,{values:{...form.values,[a.id]:e.target.value}})}/></label>)}</details><p>Descrição do cadastro: {p.description||'Não informada'}</p></details>;})}</>}
     {step===5&&<><h3>Revisar antes de criar</h3><p>Conta: <strong>{account?.name}</strong> · Tabela: <strong>{table?.name}</strong></p><div className="tableWrap"><table><thead><tr><th>Produto</th><th>Modalidade</th><th>Preço</th><th>Quantidade</th><th>Validação</th></tr></thead><tbody>{prepared.map((p,i)=><tr key={i}><td>{p.title||p.name}</td><td>{p.modality==='classic'?'Clássico':'Premium'}</td><td>{p.price?money(p.price):'—'}</td><td>1</td><td className="listingMessage">{p.last_error||'Pronto para criar'}</td></tr>)}</tbody></table></div><label className="listingChoice"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> Confirmo criar estes anúncios no Mercado Livre com quantidade 1 por anúncio, disponíveis para venda.</label><button className="primary" disabled={busy||!confirm||!prepared.length||prepared.some(p=>p.publication_state!=='validated')} onClick={()=>void run(publish)}>Criar {prepared.length} anúncio(s) no Mercado Livre</button></>}
     {step===6&&<><h3>Resultado da criação</h3>{results.map((r,i)=><p key={i}>{r.name} · {r.modality==='classic'?'Clássico':'Premium'}: {r.ok?<>{r.external_listing_id} · {r.status}{r.external_url&&<> · <a href={r.external_url} target="_blank" rel="noreferrer">Abrir anúncio</a></>}{r.warning&&<span role="alert"> {r.warning}</span>}</>:<span role="alert">{r.last_error}</span>}</p>)}{!busy&&<button onClick={()=>setStep(0)}>Concluir</button>}</>}
     <div className="listingNavigation">{step>1&&step<6&&<button disabled={busy} onClick={()=>{setStep(step-1);setPrepared([]);setConfirm(false);}}>Voltar</button>}{step<4&&<button className="primary" disabled={busy||(step===1&&!selected.length)||(step===2&&(!accountId||!tableId))} onClick={()=>void run(async()=>{if(step===2){const saved=data.settings.find((s:Row)=>s.account_id===accountId)?.pricing_table_id;if(saved!==tableId){await listingCall('assign-table',{account_id:accountId,pricing_table_id:tableId});await load();}}setStep(step+1);})}>Continuar</button>}{step===4&&<button className="primary" disabled={busy||products.some(p=>!forms[p.id]?.category)} onClick={()=>void run(validate)}>Validar e revisar preços</button>}{step<6&&<button disabled={busy} onClick={()=>setStep(0)}>Cancelar</button>}</div>
   </div>}
   <div className="card tableWrap"><h3>Anúncios vinculados</h3><table><thead><tr><th>Produto</th><th>Conta</th><th>Modalidade</th><th>Preço enviado</th><th>Quantidade enviada</th><th>Situação</th><th>Mercado Livre</th></tr></thead><tbody>{data.listings.map((r:Row)=><tr key={r.id}><td>{r.title||data.products.find((p:Row)=>p.id===r.product_id)?.name}</td><td>{data.accounts.find((a:Row)=>a.id===r.account_id)?.name}</td><td>{r.listing_type==='classic'?'Clássico':r.listing_type==='premium'?'Premium':'Legado'}</td><td>{r.price?money(r.price):'—'}</td><td>{r.published_stock??'—'}</td><td className="listingMessage">{r.publication_state==='published'?r.status:r.publication_state==='validated'?'Pronto para criar':r.publication_state==='publishing'||r.publication_state==='uncertain'?'Em conferência':r.publication_state==='error'?'Pendência':'Preparação'}{r.last_error&&<small>{r.last_error}</small>}</td><td>{r.external_url?<a href={r.external_url} target="_blank" rel="noreferrer">{r.external_listing_id}</a>:r.external_listing_id||'Ainda não criado'}</td></tr>)}</tbody></table>{!data.listings.length&&<p>Nenhum anúncio vinculado. Use + para preparar os primeiros.</p>}</div>
 </section>;
}

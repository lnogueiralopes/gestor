import { families, FamilyIcon } from './ProductFamilies';
import RegisteredUsers from './RegisteredUsers';
import Marketplace from './Marketplace';
import Breadcrumbs from './Breadcrumbs';
import ActionPanel from './ActionPanel';
import ImageField from './ImageField';
import ProductImages from './ProductImages';
import AccountSettings from './AccountSettings';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { Sidebar, Dashboard, Matrix, Pricing, Accounts, Placeholder } from './App';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type Product = { id: string; ean: string; name: string; brand: string | null; vintage: string | null; stock_on_hand: number; quantity_per_box?: number; [key: string]: unknown };
export default function LiveApp() {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Product[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ family_id: '1', ean: '', sku: '', id_produto: '', name: '', short_title: '', brand: '', origin: '', winery: '', vintage: '', size: '', varietal: '', product_type: '', summary: '', description: '', unit_cost: '0.00', target_margin: '0.00', stock_on_hand: '0', quantity_per_box: '1', width_cm:'7', length_cm:'7', height_cm:'28', weight_kg:'1.1', is_active: true });
  const [imageFields, setImageFields] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filters,setFilters]=useState<Record<string,string>>({});
  const [sort,setSort]=useState({key:'winery',ascending:true});
  const columns=[['winery','Vinícola'],['brand','Marca'],['product_type','Tipo'],['size','Tamanho']] as const;
  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data, error }) => { setSession(data.session); setReady(true); if(error) setMessage('Não foi possível recuperar a sessão.'); });
    const { data } = supabase.auth.onAuthStateChange((_event, value) => { setSession(value); setReady(true); setRows([]); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session || !supabase) return;
    let active = true;
    setBusy(true); setMessage('');
    (async () => {
      const profile = await supabase!.from('profiles').select('is_active').eq('id',session.user.id).maybeSingle();
      if (!active) return;
      if (profile.error || !profile.data?.is_active) { setMessage('Seu acesso ainda precisa ser liberado pelo administrador.'); setBusy(false); return; }
      const result = await supabase!.from('products').select('*').order('name');
      if (!active) return;
      if (result.error) setMessage('Não foi possível carregar o catálogo. Atualize a página para tentar novamente.');
      else setRows(result.data as Product[]);
      setBusy(false);
    })();
    return () => { active = false; };
  }, [session?.user.id]);
  if (!ready) return <main className="card">Carregando…</main>;
  if (!supabase) return <main className="card">A conexão com o catálogo está sendo configurada.</main>;
  if (!session) return <div className="rocketLoginPage"><section className="rocketLoginIntro"><span className="loginRSymbol" role="img" aria-label="Símbolo Rocket" /><h2>Sua operação.<br/><em>Um só lugar.</em></h2></section><main className="card rocketLogin">
    <div className="rocketLogoPanel"><span className="loginWordmark" role="img" aria-label="Rocket" /></div>
    
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(''); try { if (!login.includes('@')) { setMessage('O login por usuário curto será ativado na próxima atualização. Use o e-mail cadastrado por enquanto.'); setBusy(false); return; } const {error} = await supabase!.auth.signInWithPassword({email:login.trim(),password}); if(error) setMessage('Não foi possível entrar. Confira seu usuário e senha.'); else setPassword(''); } catch { setMessage('Falha de conexão. Tente novamente.'); } finally {setBusy(false);} }}>
      <label>Usuário<input style={{display:'block',width:'100%',margin:'8px 0 16px'}} type="text" autoComplete="username" required value={login} onChange={e=>setLogin(e.target.value)} /></label>
      <label>Senha<input style={{display:'block',width:'100%',margin:'8px 0 16px'}} type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
      <button className="primary" disabled={busy}>{busy?'Entrando…':'Entrar'}</button>
      <a className="loginContact" href="https://wa.me/5516981035244" target="_blank" rel="noopener noreferrer" aria-label="Fale conosco pelo WhatsApp (abre em nova aba)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 11.7a8.6 8.6 0 0 1-12.8 7.5L3 20.5l1.3-4.6a8.6 8.6 0 1 1 16.2-4.2Z"/><path d="m8 7 1.5-.3 1.2 2.7-1 1.1c.8 1.6 1.7 2.5 3.3 3.2l1.1-1 2.6 1.3-.3 1.5c-.3 1.4-2.3 1.6-4.6.4-2.4-1.2-4.8-3.6-5.1-6C6.5 8.4 7.1 7.4 8 7Z"/></svg><span>Fale conosco</span></a>
      <p role="status">{message}</p>
    </form>
  </main></div>;
  const visible = rows.filter(p => (!filters.family_id||String(p.family_id??1)===filters.family_id) && [p.name,p.ean,p.winery,p.brand,p.product_type,p.size].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && columns.every(([key])=>!filters[key] || String(p[key]??'')===filters[key])).sort((a,b)=>String(a[sort.key]??'').localeCompare(String(b[sort.key]??''),'pt-BR',{numeric:true,sensitivity:'base'})*(sort.ascending?1:-1));
const openForm = (product?: Product) => { setImageFields(Array.from({length:6},(_,i)=>String(product?.[`image_${i+1}_url`]??'').replace(/^\/image\//,'/images/'))); setFormOpen(true); setEditing(product ?? null); setForm({ family_id: String(product?.family_id ?? 1), ean: String(product?.ean ?? ''), sku: String(product?.sku ?? product?.ean ?? ''), id_produto: String(product?.id_produto ?? ''), name: String(product?.name ?? ''), short_title: String(product?.short_title ?? ''), brand: String(product?.brand ?? ''), origin: String(product?.origin ?? ''), winery: String(product?.winery ?? ''), vintage: String(product?.vintage ?? ''), size: String(product?.size ?? ''), varietal: String(product?.varietal ?? ''), product_type: String(product?.product_type ?? ''), summary: String(product?.summary ?? ''), description: String(product?.description ?? ''), unit_cost: String(product?.unit_cost ?? '0.00'), target_margin: String(product?.target_margin ?? '0.00'), stock_on_hand: String(product?.stock_on_hand ?? 0), quantity_per_box: String(product?.quantity_per_box ?? 1), width_cm:String(product?.width_cm ?? 7), length_cm:String(product?.length_cm ?? 7), height_cm:String(product?.height_cm ?? 28), weight_kg:String(product?.weight_kg ?? 1.1), is_active: product?.is_active !== false }); };
  const saveProduct = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setMessage(''); const payload={family_id:Number(form.family_id),ean:form.ean.trim(),sku:form.ean.trim(),name:form.name.trim(),short_title:form.short_title.trim()||null,brand:form.brand.trim()||null,origin:form.origin.trim()||null,winery:form.winery.trim()||null,vintage:form.vintage.trim()||null,size:form.size.trim()||null,varietal:form.varietal.trim()||null,product_type:form.product_type.trim()||null,summary:form.summary.trim()||null,description:form.description.trim()||null,unit_cost:Number(form.unit_cost)||0,target_margin:Number(form.target_margin)||0,stock_on_hand:Number(form.stock_on_hand)||0,quantity_per_box:Math.max(1,Number(form.quantity_per_box)||1),width_cm:Number(form.width_cm)||7,length_cm:Number(form.length_cm)||7,height_cm:Number(form.height_cm)||28,weight_kg:Number(form.weight_kg)||1.1,is_active:form.is_active,...Object.fromEntries(imageFields.map((url,i)=>[`image_${i+1}_url`,url.trim()||null]))}; const result=editing ? await supabase!.from('products').update(payload).eq('id',editing.id).select().single() : await supabase!.from('products').insert(payload).select().single(); if(result.error) setMessage(result.error.message.includes('duplicate')?'Esse EAN ou SKU já está cadastrado.':'Não foi possível salvar o produto.'); else { setRows(current=>editing?current.map(p=>p.id===editing.id?result.data as Product:p):[...current,result.data as Product]); setEditing(null); setFormOpen(false); } setBusy(false); };
  const modules: Record<string, React.ReactNode> = {"/estoque/cadastro":<Placeholder title="Cadastro de estoque" description="Identificação dos estoques por ID_Estoque. Em preparação." />, "/estoque/movimentacoes":<Placeholder title="Movimentações de estoque" description="Entradas, saídas e transferências. Em preparação." />, "/estoque/inventario":<Placeholder title="Inventário" description="Contagem e conferência de estoque. Em preparação." />,"/minha-conta":<AccountSettings />,"/dashboard":<Dashboard />, "/kits":<Matrix kind="kits" />, "/precificador":<Pricing />, "/contas":<Marketplace />, "/usuarios":<RegisteredUsers />, "/anuncios":<Placeholder title="Anúncios" description="Integração com canais em preparação." />, "/pedidos":<Placeholder title="Pedidos" description="Sincronização em preparação." />, "/configuracoes":<Placeholder title="Configurações" description="Configurações em preparação." />, "/automacoes":<Placeholder title="Automações" description="Agendamentos em preparação." />};
  if(location.pathname !== "/" && location.pathname !== "/produtos") return <div className="app"><Sidebar /><main className="content rocketWorkspace"><Breadcrumbs/>{location.pathname !== "/minha-conta" && location.pathname !== "/contas" && location.pathname !== "/usuarios" && !location.pathname.startsWith('/precificador') && <p className="demoNotice">Este módulo ainda é demonstrativo. O catálogo real está em Produtos.</p>}{modules[location.pathname] ?? (location.pathname.startsWith('/precificador') ? <Pricing /> : <Navigate to="/produtos" replace />)}</main></div>;
  return <div className="app"><Sidebar /><main className="rocketWorkspace"><Breadcrumbs action={formOpen?(editing?"Editar produto":"Novo produto"):undefined} onBack={()=>setFormOpen(false)}/>
    <header className="pageHeader" hidden={formOpen}><ActionPanel onAdd={()=>openForm()} addLabel="Novo produto" search={search} onSearch={formOpen?undefined:setSearch}/></header>
    {formOpen && <form className="card productForm" onSubmit={saveProduct}>
      
      <div className="formGrid"><label>Família<select value={form.family_id} onChange={e=>setForm({...form,family_id:e.target.value})}>{families.map(f=><option key={f.id} value={f.id}>{f.id} — {f.name}</option>)}</select></label>{form.family_id!=='1'&&<p className="wideField">Premissas específicas desta família ainda não configuradas.</p>}
      {Object.entries({id_produto:'ID Produto',ean:'EAN',sku:'SKU (igual ao EAN)',name:'Nome',short_title:'Título curto',brand:'Marca',origin:'Origem',winery:'Vinícola',vintage:'Safra',size:'Volume / tamanho',varietal:'Variedade',product_type:'Tipo',unit_cost:'Custo unitário',target_margin:'Margem alvo',stock_on_hand:'Estoque',quantity_per_box:'Quantidade por caixa',width_cm:'Largura (cm)',length_cm:'Comprimento (cm)',height_cm:'Altura (cm)',weight_kg:'Peso estimado (kg)',summary:'Resumo',description:'Descrição'}).map(([key,label])=>{
        if(form.family_id!=='1'&&['winery','vintage','varietal'].includes(key))return null;
        const k=key as Exclude<keyof typeof form,'is_active'>;
        const numeric=['unit_cost','target_margin','stock_on_hand','quantity_per_box','width_cm','length_cm','height_cm','weight_kg'].includes(key);
        return <label key={key} className={['summary','description'].includes(key)?'wideField':''}>{label}{['summary','description'].includes(key)?<textarea rows={key==='description'?3:2} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>:<input type={numeric?'number':'text'} min={numeric?0:undefined} step={key==='stock_on_hand'?1:key==='target_margin'?'0.0001':'0.01'} required={['name','quantity_per_box'].includes(key)} readOnly={['id_produto','sku'].includes(key)||key==='ean'&&Boolean(editing)} placeholder={key==='id_produto'?'Automático':undefined} value={key==='sku'?form.ean:form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>}</label>;
      })}
      <label className="wideField"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Produto ativo</label>
      </div><h3>Imagens</h3><div className="imageFields">{imageFields.map((url,i)=><ImageField key={i} url={url} index={i} onChange={value=>setImageFields(current=>current.map((v,n)=>n===i?value:v))}/>)}</div>
      <p role="status">{message}</p>
      <div className="formActions"><button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar produto'}</button><button type="button" disabled={busy} onClick={()=>setFormOpen(false)}>Cancelar</button></div>
    </form>}
    {!formOpen && <>

    <p role="status">{busy?'Carregando catálogo…':message}</p>

    <p className="muted">{visible.length} de {rows.length} produtos</p>
    <div className="card tableWrap"><table><thead><tr><th aria-label="Família"><select className="columnFilter" aria-label="Filtrar por família" value={filters.family_id??''} onChange={e=>setFilters({...filters,family_id:e.target.value})}><option value="">Todas</option>{families.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></th><th>EAN / SKU</th>{columns.map(([key,label])=><th key={key} aria-sort={sort.key===key?(sort.ascending?'ascending':'descending'):'none'}><button className="sortColumn" type="button" onClick={()=>setSort({key,ascending:sort.key===key?!sort.ascending:true})}>{label} <span aria-hidden="true">{sort.key===key?(sort.ascending?'↑':'↓'):'↕'}</span></button><select className="columnFilter" aria-label={`Filtrar por ${label}`} title={filters[key]||`Filtrar por ${label}`} value={filters[key]??''} onChange={e=>setFilters({...filters,[key]:e.target.value})} style={{color:filters[key]?'#427000':undefined}}><option value="">Todos</option>{Array.from(new Set(rows.map(p=>String(p[key]??'')).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true})).map(value=><option key={value} value={value}>{value}</option>)}</select></th>)}<th>Safra</th><th>Imagens</th><th>Ações</th></tr></thead><tbody>
      {visible.map(p=><tr key={p.id}><td><FamilyIcon id={Number(p.family_id??1)}/></td><td>{p.ean}</td>{columns.map(([key])=><td key={key}>{String(p[key]??'')||'—'}</td>)}<td>{p.vintage || '—'}</td><td><ProductImages product={p}/></td><td><button type="button" className="tableAction" title="Editar produto" aria-label={`Editar produto ${p.ean}`} onClick={()=>openForm(p)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/></svg></button></td></tr>)}
    </tbody></table></div>
    {!busy && !message && !visible.length && <p>Nenhum produto encontrado.</p>}
    </>}
  </main></div>;
}





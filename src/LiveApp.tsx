import ProductImages from './ProductImages';
import AccountSettings from './AccountSettings';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { Sidebar, Dashboard, Matrix, Pricing, Accounts, Users, Placeholder } from './App';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type Product = { id: string; ean: string; name: string; brand: string | null; vintage: string | null; stock_on_hand: number; [key: string]: unknown };
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
  const [form, setForm] = useState({ ean: '', sku: '', id_produto: '', name: '', short_title: '', brand: '', origin: '', winery: '', vintage: '', size: '', varietal: '', product_type: '', summary: '', description: '', unit_cost: '0.00', target_margin: '0.00', stock_on_hand: '0', is_active: true });
  const [imageFields, setImageFields] = useState<string[]>([]);
  const [search, setSearch] = useState('');
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
  if (!session) return <div className="rocketLoginPage"><section className="rocketLoginIntro"><span className="loginEyebrow">GESTÃO E AUTOMAÇÃO</span><h2>Sua operação.<br/><em>Um só lugar.</em></h2></section><main className="card rocketLogin">
    <div className="rocketLogoPanel"><img src="/brand/rocket-ia-logo.png" alt="Rocket" /></div>
    <h1>Acesse sua conta</h1>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(''); try { if (!login.includes('@')) { setMessage('O login por usuário curto será ativado na próxima atualização. Use o e-mail cadastrado por enquanto.'); setBusy(false); return; } const {error} = await supabase!.auth.signInWithPassword({email:login.trim(),password}); if(error) setMessage('Não foi possível entrar. Confira seu usuário e senha.'); else setPassword(''); } catch { setMessage('Falha de conexão. Tente novamente.'); } finally {setBusy(false);} }}>
      <label>Usuário<input style={{display:'block',width:'100%',margin:'8px 0 16px'}} type="text" autoComplete="username" required value={login} onChange={e=>setLogin(e.target.value)} /></label>
      <label>Senha<input style={{display:'block',width:'100%',margin:'8px 0 16px'}} type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
      <button className="primary" disabled={busy}>{busy?'Entrando…':'Entrar'}</button>
      <p role="status">{message}</p>
    </form>
  </main></div>;
  const visible = rows.filter(p => `${p.name} ${p.ean} ${p.brand ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const openForm = (product?: Product) => { setImageFields(Array.from({length:6},(_,i)=>String(product?.[`image_${i+1}_url`]??'').replace(/^\/image\//,'/images/'))); setFormOpen(true); setEditing(product ?? null); setForm({ ean: String(product?.ean ?? ''), sku: String(product?.sku ?? product?.ean ?? ''), id_produto: String(product?.id_produto ?? ''), name: String(product?.name ?? ''), short_title: String(product?.short_title ?? ''), brand: String(product?.brand ?? ''), origin: String(product?.origin ?? ''), winery: String(product?.winery ?? ''), vintage: String(product?.vintage ?? ''), size: String(product?.size ?? ''), varietal: String(product?.varietal ?? ''), product_type: String(product?.product_type ?? ''), summary: String(product?.summary ?? ''), description: String(product?.description ?? ''), unit_cost: String(product?.unit_cost ?? '0.00'), target_margin: String(product?.target_margin ?? '0.00'), stock_on_hand: String(product?.stock_on_hand ?? 0), is_active: product?.is_active !== false }); };
  const saveProduct = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setMessage(''); const payload={ean:form.ean.trim(),sku:form.ean.trim(),name:form.name.trim(),short_title:form.short_title.trim()||null,brand:form.brand.trim()||null,origin:form.origin.trim()||null,winery:form.winery.trim()||null,vintage:form.vintage.trim()||null,size:form.size.trim()||null,varietal:form.varietal.trim()||null,product_type:form.product_type.trim()||null,summary:form.summary.trim()||null,description:form.description.trim()||null,unit_cost:Number(form.unit_cost)||0,target_margin:Number(form.target_margin)||0,stock_on_hand:Number(form.stock_on_hand)||0,is_active:form.is_active,...Object.fromEntries(imageFields.map((url,i)=>[`image_${i+1}_url`,url.trim()||null]))}; const result=editing ? await supabase!.from('products').update(payload).eq('id',editing.id).select().single() : await supabase!.from('products').insert(payload).select().single(); if(result.error) setMessage(result.error.message.includes('duplicate')?'Esse EAN ou SKU já está cadastrado.':'Não foi possível salvar o produto.'); else { setRows(current=>editing?current.map(p=>p.id===editing.id?result.data as Product:p):[...current,result.data as Product]); setEditing(null); setFormOpen(false); } setBusy(false); };
  const modules: Record<string, React.ReactNode> = {"/estoque/cadastro":<Placeholder title="Cadastro de estoque" description="Identificação dos estoques por ID_Estoque. Em preparação." />, "/estoque/movimentacoes":<Placeholder title="Movimentações de estoque" description="Entradas, saídas e transferências. Em preparação." />, "/estoque/inventario":<Placeholder title="Inventário" description="Contagem e conferência de estoque. Em preparação." />,"/minha-conta":<AccountSettings />,"/dashboard":<Dashboard />, "/kits":<Matrix kind="kits" />, "/precificador":<Pricing />, "/contas":<Accounts />, "/usuarios":<Users />, "/anuncios":<Placeholder title="Anúncios" description="Integração com canais em preparação." />, "/pedidos":<Placeholder title="Pedidos" description="Sincronização em preparação." />, "/configuracoes":<Placeholder title="Configurações" description="Configurações em preparação." />, "/automacoes":<Placeholder title="Automações" description="Agendamentos em preparação." />};
  if(location.pathname !== "/" && location.pathname !== "/produtos") return <div className="app"><Sidebar /><main className="content rocketWorkspace">{location.pathname !== "/minha-conta" && <p className="demoNotice">Este módulo ainda é demonstrativo. O catálogo real está em Produtos.</p>}{modules[location.pathname] ?? <Navigate to="/produtos" replace />}</main></div>;
  return <div className="app"><Sidebar /><main className="rocketWorkspace">
    <header className="pageHeader"><div><h1>Produtos</h1><p>{rows.length} produtos no catálogo</p></div><div><button className="primary" onClick={()=>openForm()}>Novo produto</button>{' '}<button onClick={async()=>{ const {error}=await supabase!.auth.signOut(); if(error) setMessage('Não foi possível sair. Tente novamente.'); }}>Sair</button></div></header>
    {formOpen && <form className="card productForm" onSubmit={saveProduct}>
      <h2>{editing?'Editar produto':'Novo produto'}</h2>
      <div className="formGrid">
      {Object.entries({id_produto:'ID Produto',ean:'EAN',sku:'SKU (igual ao EAN)',name:'Nome',short_title:'Título curto',brand:'Marca',origin:'Origem',winery:'Vinícola',vintage:'Safra',size:'Volume / tamanho',varietal:'Variedade',product_type:'Tipo',unit_cost:'Custo unitário',target_margin:'Margem alvo',stock_on_hand:'Estoque',summary:'Resumo',description:'Descrição'}).map(([key,label])=>{
        const k=key as Exclude<keyof typeof form,'is_active'>;
        const numeric=['unit_cost','target_margin','stock_on_hand'].includes(key);
        return <label key={key} className={['summary','description'].includes(key)?'wideField':''}>{label}{['summary','description'].includes(key)?<textarea rows={key==='description'?5:3} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>:<input type={numeric?'number':'text'} min={numeric?0:undefined} step={key==='stock_on_hand'?1:key==='target_margin'?'0.0001':'0.01'} required={['name'].includes(key)} readOnly={['id_produto','sku'].includes(key)||key==='ean'&&Boolean(editing)} placeholder={key==='id_produto'?'Automático':undefined} value={key==='sku'?form.ean:form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>}</label>;
      })}
      <label className="wideField"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Produto ativo</label>
      </div><h3>Imagens</h3><div className="formGrid">{imageFields.map((url,i)=><label key={i}>Imagem {i+1}<input value={url} placeholder="/images/EAN_1.jpg" onChange={e=>setImageFields(current=>current.map((v,n)=>n===i?e.target.value:v))}/></label>)}</div>
      <div className="formActions"><button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar produto'}</button><button type="button" disabled={busy} onClick={()=>setFormOpen(false)}>Cancelar</button></div>
    </form>}
    <p className="muted">Cadastre produtos, edite os detalhes e organize as imagens do catálogo.</p>
    <input aria-label="Buscar produtos" placeholder="Buscar nome, EAN ou marca" value={search} onChange={e=>setSearch(e.target.value)} />
    <p role="status">{busy?'Carregando catálogo…':message}</p>
    <div className="card tableWrap"><table><thead><tr><th>EAN / SKU</th><th>Produto</th><th>Marca</th><th>Safra</th><th>Imagens</th><th>Ações</th></tr></thead><tbody>
      {visible.map(p=><tr key={p.id}><td>{p.ean}</td><td>{p.name}</td><td>{p.brand}</td><td>{p.vintage || '—'}</td><td><ProductImages product={p}/></td><td><button onClick={()=>openForm(p)}>Editar</button></td></tr>)}
    </tbody></table></div>
    {!busy && !message && !visible.length && <p>Nenhum produto encontrado.</p>}
  </main></div>;
}

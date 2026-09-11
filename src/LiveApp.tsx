import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type Product = { id: string; ean: string; name: string; brand: string | null; vintage: string | null; stock_on_hand: number; [key: string]: unknown };
export default function LiveApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Product[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ean: '', name: '', brand: '', vintage: '', stock_on_hand: '0' });
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
  if (!session) return <div className="rocketLoginPage"><div className="rocketLoginArtwork" aria-hidden="true" /><main className="card rocketLogin">
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
  const openForm = (product?: Product) => { setFormOpen(true); setEditing(product ?? null); setForm({ ean: product?.ean ?? '', name: product?.name ?? '', brand: product?.brand ?? '', vintage: product?.vintage ?? '', stock_on_hand: String(product?.stock_on_hand ?? 0) }); };
  const saveProduct = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setMessage(''); const payload={ean:form.ean.trim(),sku:form.ean.trim(),name:form.name.trim(),brand:form.brand.trim()||null,vintage:form.vintage.trim()||null,stock_on_hand:Number(form.stock_on_hand)}; const result=editing ? await supabase!.from('products').update(payload).eq('id',editing.id).select().single() : await supabase!.from('products').insert(payload).select().single(); if(result.error) setMessage(result.error.message.includes('duplicate')?'Esse EAN já está cadastrado.':'Não foi possível salvar o produto.'); else { setRows(current=>editing?current.map(p=>p.id===editing.id?result.data as Product:p):[...current,result.data as Product]); setEditing(null); setFormOpen(false); } setBusy(false); };
  return <main className="rocketWorkspace"><div className="rocketTopbar"><img src="/brand/rocket-ia-logo.png" alt="Rocket" /><span>GESTÃO E AUTOMAÇÃO</span></div>
    <header className="pageHeader"><div><h1>Produtos</h1><p>{rows.length} produtos no catálogo</p></div><div><button className="primary" onClick={()=>openForm()}>Novo produto</button>{' '}<button onClick={async()=>{ const {error}=await supabase!.auth.signOut(); if(error) setMessage('Não foi possível sair. Tente novamente.'); }}>Sair</button></div></header>
    {formOpen && <form className="card" onSubmit={saveProduct} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}><label>EAN<input required value={form.ean} onChange={e=>setForm({...form,ean:e.target.value})} disabled={Boolean(editing?.id)} /></label><label>Nome<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></label><label>Marca<input value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})} /></label><label>Safra<input value={form.vintage} onChange={e=>setForm({...form,vintage:e.target.value})} /></label><label>Estoque<input type="number" min="0" value={form.stock_on_hand} onChange={e=>setForm({...form,stock_on_hand:e.target.value})} /></label><div><button className="primary" disabled={busy}>Salvar</button>{' '}<button type="button" onClick={()=>setFormOpen(false)}>Cancelar</button></div></form>}
    <p className="muted">Catálogo conectado. Edição, kits e precificação serão ativados nas próximas etapas.</p>
    <input aria-label="Buscar produtos" placeholder="Buscar nome, EAN ou marca" value={search} onChange={e=>setSearch(e.target.value)} />
    <p role="status">{busy?'Carregando catálogo…':message}</p>
    <div className="card tableWrap"><table><thead><tr><th>EAN / SKU</th><th>Produto</th><th>Marca</th><th>Safra</th>{[1,2,3,4,5,6].map(i=><th key={i}>Imagem {i}</th>)}</tr></thead><tbody>
      {visible.map(p=><tr key={p.id}><td>{p.ean}</td><td>{p.name}</td><td>{p.brand}</td><td>{p.vintage || '—'}</td>{[1,2,3,4,5,6].map(i=>{const url=p[`image_${i}_url`]; return <td key={i}>{typeof url==='string' && url.startsWith('/images/') ? <a href={url} target="_blank" rel="noreferrer"><img src={url} loading="lazy" width="64" height="80" style={{objectFit:'contain'}} alt={`${p.name}, imagem ${i}`} /></a>:'—'}</td>;})}<td><button onClick={()=>openForm(p)}>Editar</button></td></tr>)}
    </tbody></table></div>
    {!busy && !message && !visible.length && <p>Nenhum produto encontrado.</p>}
  </main>;
}


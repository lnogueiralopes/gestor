import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type Product = { id: string; ean: string; name: string; brand: string | null; vintage: string | null; stock_on_hand: number; [key: string]: unknown };
export default function LiveApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Product[]>([]);
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
  if (!session) return <main style={{maxWidth:420,margin:'10vh auto',padding:24}} className="card">
    <img src="/brand/ruta-directa-symbol.svg" width="64" alt="Ruta Directa" />
    <h1>Entrar no Gestor</h1>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(''); try { const {error} = await supabase!.auth.signInWithPassword({email:email.trim(),password}); if(error) setMessage('Não foi possível entrar. Confira seu e-mail e senha.'); else setPassword(''); } catch { setMessage('Falha de conexão. Tente novamente.'); } finally {setBusy(false);} }}>
      <label>E-mail<input style={{display:'block',width:'100%',margin:'8px 0 16px'}} type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
      <label>Senha<input style={{display:'block',width:'100%',margin:'8px 0 16px'}} type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
      <button className="primary" disabled={busy}>{busy?'Entrando…':'Entrar'}</button>
      <p role="status">{message}</p>
    </form>
  </main>;
  const visible = rows.filter(p => `${p.name} ${p.ean} ${p.brand ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <main style={{padding:24,maxWidth:1600,margin:'auto'}}>
    <header className="pageHeader"><div><h1>Ruta Directa · Produtos</h1><p>{rows.length} produtos no catálogo</p></div><button onClick={async()=>{ const {error}=await supabase!.auth.signOut(); if(error) setMessage('Não foi possível sair. Tente novamente.'); }}>Sair</button></header>
    <p className="muted">Catálogo conectado. Edição, kits e precificação serão ativados nas próximas etapas.</p>
    <input aria-label="Buscar produtos" placeholder="Buscar nome, EAN ou marca" value={search} onChange={e=>setSearch(e.target.value)} />
    <p role="status">{busy?'Carregando catálogo…':message}</p>
    <div className="card tableWrap"><table><thead><tr><th>EAN / SKU</th><th>Produto</th><th>Marca</th><th>Safra</th>{[1,2,3,4,5,6].map(i=><th key={i}>Imagem {i}</th>)}</tr></thead><tbody>
      {visible.map(p=><tr key={p.id}><td>{p.ean}</td><td>{p.name}</td><td>{p.brand}</td><td>{p.vintage || '—'}</td>{[1,2,3,4,5,6].map(i=>{const url=p[`image_${i}_url`]; return <td key={i}>{typeof url==='string' && url.startsWith('/images/') ? <a href={url} target="_blank" rel="noreferrer"><img src={url} loading="lazy" width="64" height="80" style={{objectFit:'contain'}} alt={`${p.name}, imagem ${i}`} /></a>:'—'}</td>;})}</tr>)}
    </tbody></table></div>
    {!busy && !message && !visible.length && <p>Nenhum produto encontrado.</p>}
  </main>;
}


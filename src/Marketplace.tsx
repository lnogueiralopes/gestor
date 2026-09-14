import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
type Connection = { seller_id: string; account_name?: string; expires_at: string; updated_at?: string };
export default function Marketplace() {
 const [connections,setConnections]=useState<Connection[]>([]);
 const [loading,setLoading]=useState(true), [connecting,setConnecting]=useState(false), [error,setError]=useState('');
 const outcome=new URLSearchParams(window.location.search).get('ml');
 async function call(path:string,method='GET') {
  const {data}=await supabase!.auth.getSession();
  if(!data.session) throw new Error('Entre novamente no Rocket.');
  const response=await fetch('/api/marketplaces/mercadolivre/'+path,{method,headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store'});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error||'Não foi possível consultar a conexão.');
  return result;
 }
 useEffect(()=>{let active=true; call('status').then(result=>{if(!Array.isArray(result.connections))throw new Error('Resposta de conexões inválida.');if(active)setConnections(result.connections);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 async function connect() {
  setConnecting(true);setError('');
  try {const result=await call('connect','POST');const target=new URL(result.url);if(target.origin!=='https://auth.mercadolivre.com.br')throw new Error('Endereço de autorização inválido.');window.location.assign(target.href);}
  catch(e){setError(e instanceof Error?e.message:'Falha de conexão.');setConnecting(false);}
 }
 return <section>
  <header className="pageHeader"><div className="actionPanel">
   <button className="roundAction" type="button" title="Atualizar conexões" aria-label="Atualizar conexões" disabled={loading||connecting} onClick={()=>window.location.reload()}>↻</button>
   <button className="roundAction addAction" type="button" title="Adicionar conta Mercado Livre" aria-label="Adicionar conta Mercado Livre" disabled={loading||connecting} onClick={connect}>+</button>
  </div></header>
  {error&&<p role="alert">{error}</p>}
  <p role="status">{loading?'Carregando conexões…':connecting?'Abrindo Mercado Livre…':outcome==='connected'&&connections.length?'Conta autorizada e salva.':outcome==='cancelled'?'Autorização cancelada.':outcome==='error'?'A autorização não foi salva. Tente conectar novamente.':''}</p>
  <div className="card tableWrap"><table><thead><tr><th>Marketplace</th><th>Nome da conta</th><th>ID vendedor</th><th>Conexão</th><th>Última autorização</th><th>Ações</th></tr></thead><tbody>
   {connections.map(account=><tr key={account.seller_id}><td>Mercado Livre</td><td><strong>{account.account_name||'Conta Mercado Livre'}</strong></td><td>{account.seller_id}</td><td>{Date.parse(account.expires_at)>Date.now()?'Conectada':'Salva · acesso expirado'}</td><td>{account.updated_at?new Date(account.updated_at).toLocaleString('pt-BR'):'—'}</td><td><button className="tableAction" type="button" title="Autorizar novamente no Mercado Livre" aria-label={'Autorizar novamente a conta '+(account.account_name||account.seller_id)} disabled={connecting} onClick={connect}>↻</button></td></tr>)}
   {!loading&&!error&&!connections.length&&<tr><td colSpan={6}>Nenhuma conexão salva. Use + para adicionar uma conta.</td></tr>}
  </tbody></table></div>
 </section>;
}

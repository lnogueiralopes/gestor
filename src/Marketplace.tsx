import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
type Connection={seller_id:string;expires_at:string};
export default function Marketplace(){
 const [connections,setConnections]=useState<Connection[]>([]);
 const [busy,setBusy]=useState(true);
 const [message,setMessage]=useState('');
 async function call(path:string,method='GET'){
  const {data}=await supabase!.auth.getSession();
  if(!data.session)throw new Error('Entre novamente no Rocket.');
  const response=await fetch(`/api/marketplaces/mercadolivre/${path}`,{method,headers:{Authorization:`Bearer ${data.session.access_token}`}});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Não foi possível conectar.');
  return result;
 }
 useEffect(()=>{let active=true;call('status').then(result=>{if(active)setConnections(result.connections);}).catch(error=>{if(active)setMessage(error.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
 const outcome=new URLSearchParams(window.location.search).get('ml');
 return <section className="card"><h3>Mercado Livre</h3>
 <p>{connections.length?`${connections.length} conta(s) autorizada(s)`:'Conecte sua conta para preparar a integração.'}</p>
 {connections.map(account=><p key={account.seller_id}>Conta {account.seller_id} · {Date.parse(account.expires_at)>Date.now()?'Autorizada':'Autorização precisa ser renovada'}</p>)}
 <button className="primary" disabled={busy} onClick={async()=>{setBusy(true);setMessage('');try{const result=await call('connect','POST');const target=new URL(result.url);if(target.origin!=='https://auth.mercadolivre.com.br')throw new Error('Endereço de autorização inválido.');window.location.assign(target.href);}catch(error){setMessage(error instanceof Error?error.message:'Falha de conexão.');setBusy(false);}}}>{busy?'Aguarde…':connections.length?'Conectar ou reautorizar conta':'Conectar Mercado Livre'}</button>
 <p role="status">{message||(outcome==='connected'?'Conta autorizada com sucesso.':outcome==='cancelled'?'Autorização cancelada.':outcome==='error'?'Não foi possível concluir a autorização. Tente novamente.':'')}</p>
 <p className="muted">Publicação, sincronização e agendamentos ainda em preparação.</p>
 </section>;
}

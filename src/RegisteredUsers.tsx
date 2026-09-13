import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
type UserRow={id:string;email:string;name:string;role:string;active:boolean;last_sign_in_at:string|null};
export default function RegisteredUsers(){
 const [rows,setRows]=useState<UserRow[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);setError('');setRows([]);
 (async()=>{try{
  const {data}=await supabase!.auth.getSession();
  if(!data.session)throw new Error('Entre novamente no Rocket.');
  const response=await fetch('/api/admin/users?page='+page,{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store'});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível carregar os usuários.');
  if(active){setRows(result.users);setHasMore(result.has_more);}
 }catch(e){if(active)setError(e instanceof Error?e.message:'Falha de conexão.');}finally{if(active)setLoading(false);}})();
 return()=>{active=false;};},[page]);
 return <section><p role="status">{loading?'Carregando usuários…':error}</p><div className="card tableWrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Último acesso</th></tr></thead><tbody>
 {rows.map(user=><tr key={user.id}><td>{user.name||'—'}</td><td>{user.email}</td><td>{user.role}</td><td>{user.active?'Ativo':'Sem acesso ativo'}</td><td>{user.last_sign_in_at?new Date(user.last_sign_in_at).toLocaleString('pt-BR'):'Ainda não acessou'}</td></tr>)}
 {!loading&&!error&&!rows.length&&<tr><td colSpan={5}>Nenhum usuário cadastrado.</td></tr>}
 </tbody></table></div><div className="formActions"><button disabled={loading||page===1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page}</span><button disabled={loading||!hasMore} onClick={()=>setPage(p=>p+1)}>Próxima</button></div></section>;
}

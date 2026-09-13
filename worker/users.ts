import type { Env } from './index';
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function listUsers(request:Request,env:Env){
 if(request.method!=='GET')return json({error:'Método inválido.'},405);
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return json({error:'Configure o Supabase no servidor.'},503);
 const authorization=request.headers.get('Authorization');
 if(!authorization?.startsWith('Bearer '))return json({error:'Entre novamente no Rocket.'},401);
 const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY};
 try{
  const auth=await fetch(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:authorization}});
  if(!auth.ok)return json({error:'Sessão inválida.'},401);
  const user=await auth.json() as {id:string};
  const access=await fetch(env.SUPABASE_URL+'/rest/v1/profiles?id=eq.'+encodeURIComponent(user.id)+'&is_active=eq.true&is_admin=eq.true&select=id',{headers});
  if(!access.ok)return json({error:'Não foi possível verificar sua permissão.'},503);
  if(!(await access.json() as unknown[]).length)return json({error:'Somente administradores podem consultar usuários.'},403);
  const page=Number(new URL(request.url).searchParams.get('page')||1);
  if(!Number.isSafeInteger(page)||page<1)return json({error:'Página inválida.'},400);
  const response=await fetch(env.SUPABASE_URL+'/auth/v1/admin/users?page='+page+'&per_page=50',{headers});
  if(!response.ok)return json({error:'Não foi possível consultar os usuários cadastrados.'},502);
  const data=await response.json() as {users:{id:string;email?:string;last_sign_in_at?:string;user_metadata?:{full_name?:string}}[]};
  if(!Array.isArray(data.users))return json({error:'Resposta de usuários inválida.'},502);
  if(!data.users.length)return json({users:[],has_more:false});
  const ids=data.users.map(u=>u.id).join(',');
  const profiles=await fetch(env.SUPABASE_URL+'/rest/v1/profiles?select=*&id=in.('+encodeURIComponent(ids)+')',{headers});
  if(!profiles.ok)return json({error:'Não foi possível consultar os perfis.'},502);
  const records=await profiles.json() as {id:string;full_name:string;is_admin:boolean;is_active:boolean;role?:string}[];
  return json({users:data.users.map(u=>{const p=records.find(p=>p.id===u.id);return {id:u.id,email:u.email||'',name:p?.full_name||u.user_metadata?.full_name||'',role:p?.is_admin?'Admin':p?.role==='viewer'?'Espectador':p?.role==='operator'?'Operador':p?'Usuário':'Sem perfil',active:Boolean(p?.is_active),last_sign_in_at:u.last_sign_in_at||null};}),has_more:data.users.length===50});
 }catch{return json({error:'Falha de comunicação. Tente novamente.'},502);}
}

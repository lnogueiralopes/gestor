import type { Env } from './index';
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function listUsers(request:Request,env:Env){
 if(!['GET','PUT'].includes(request.method))return json({error:'Método inválido.'},405);
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
  if(request.method==='PUT'){
   const body=await request.json() as {user_id?:string;family_ids?:number[]};
   if(!body.user_id||!Array.isArray(body.family_ids))return json({error:'Dados de permissão inválidos.'},400);
   const codes=[1,2,3].filter(id=>body.family_ids!.includes(id)).map(id=>'costs.edit.family.'+id);
   const permissions=await fetch(env.SUPABASE_URL+'/rest/v1/permissions?select=id,code&code=in.('+codes.map(encodeURIComponent).join(',')+')',{headers});
   if(!permissions.ok)return json({error:'Não foi possível consultar as permissões.'},502);
   const permissionRows=await permissions.json() as {id:number;code:string}[];
   // Remove only family cost permissions using one request per known permission.
   for(const id of [1,2,3]){const p=permissionRows.find(x=>x.code==='costs.edit.family.'+id);if(p)await fetch(env.SUPABASE_URL+'/rest/v1/user_permissions?user_id=eq.'+encodeURIComponent(body.user_id)+'&permission_id=eq.'+p.id,{method:'DELETE',headers});}
   if(permissionRows.length){const ins=await fetch(env.SUPABASE_URL+'/rest/v1/user_permissions',{method:'POST',headers:{...headers,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(codes.map(code=>({user_id:body.user_id,permission_id:permissionRows.find(p=>p.code===code)?.id})).filter(x=>x.permission_id))});if(!ins.ok)return json({error:'Não foi possível salvar as permissões.'},502);}
   return json({ok:true});
  }
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
  const perms=await fetch(env.SUPABASE_URL+'/rest/v1/user_permissions?select=user_id,permissions(code)&user_id=in.('+encodeURIComponent(ids)+')',{headers});
  const permRows=perms.ok?await perms.json() as {user_id:string;permissions:{code:string}|null}[]:[];
  return json({users:data.users.map(u=>{const p=records.find(p=>p.id===u.id);return {id:u.id,email:u.email||'',name:p?.full_name||u.user_metadata?.full_name||'',role:p?.is_admin?'Admin':p?.role==='viewer'?'Espectador':p?.role==='operator'?'Operador':p?'Usuário':'Sem perfil',active:Boolean(p?.is_active),last_sign_in_at:u.last_sign_in_at||null,family_cost_permissions:permRows.filter(x=>x.user_id===u.id&&x.permissions?.code.startsWith('costs.edit.family.')).map(x=>Number(x.permissions!.code.split('.').pop()))};}),has_more:data.users.length===50});
 }catch{return json({error:'Falha de comunicação. Tente novamente.'},502);}
}

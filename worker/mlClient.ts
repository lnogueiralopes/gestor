import type {Env} from './index';
export type Row=Record<string,any>;
export class ApiError extends Error{constructor(message:string,public status=400){super(message);}}
export async function database(env:Env,path:string,method='GET',body?:unknown,authorization?:string):Promise<Row[]> {
 const r=await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`,{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:authorization||`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok){const e=await r.json() as Row;throw new ApiError(e.message||'Falha no banco.',r.status===409?409:400);}
 return r.status===204?[]:await r.json() as Row[];
}
export async function authorize(request:Request,env:Env,permission='listings.create'){
 const bearer=request.headers.get('Authorization');if(!bearer?.startsWith('Bearer '))throw new ApiError('Entre novamente no Gestor.',401);
 const r=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:bearer}});
 if(!r.ok)throw new ApiError('Sessão expirada.',401);
 const user=await r.json() as Row;
 const [profile]=await database(env,`profiles?id=eq.${user.id}&is_active=eq.true`);
 if(!profile)throw new ApiError('Usuário inativo.',403);
 if(!profile.is_admin){const grants=await database(env,`user_permissions?user_id=eq.${user.id}&select=permissions(code)`);if(!grants.some(g=>g.permissions?.code===permission))throw new ApiError('Sem permissão para criar anúncios.',403);}
 return {id:user.id,bearer,admin:profile.is_admin};
}
export async function sellerClient(env:Env,account:Row){
 if(account.channel!=='mercadolivre'||!account.is_active||!/^\d+$/.test(account.external_account_id||''))throw new ApiError('Conta Mercado Livre inválida ou inativa.');
 const [connection]=await database(env,`ml_connections?seller_id=eq.${account.external_account_id}`);
 if(!connection)throw new ApiError('Conecte esta conta Mercado Livre em Marketplace.');
 let token=connection.access_token;
 if(Date.parse(connection.expires_at)<Date.now()+60000){
   const r=await fetch('https://api.mercadolibre.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:env.ML_CLIENT_ID!,client_secret:env.ML_CLIENT_SECRET!,refresh_token:connection.refresh_token})});
   const t=await r.json() as Row;if(!r.ok||!t.access_token||!t.refresh_token||!(Number(t.expires_in)>0))throw new ApiError('Reconecte a conta Mercado Livre.');
   await database(env,`ml_connections?seller_id=eq.${account.external_account_id}`,'PATCH',{access_token:t.access_token,refresh_token:t.refresh_token,expires_at:new Date(Date.now()+Number(t.expires_in)*1000).toISOString(),updated_at:new Date().toISOString()});token=t.access_token;
 }
 return async(path:string,method='GET',body?:unknown)=>{
   const r=await fetch('https://api.mercadolibre.com'+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
   const text=await r.text();
   let data:Row={};if(text){try{data=JSON.parse(text);}catch{throw new ApiError('Resposta inválida do Mercado Livre.',502);}}
   return {ok:r.ok,status:r.status,data};
 };
}

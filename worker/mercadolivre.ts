import type { Env } from './index';
const reply = (data: unknown, status=200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function database(env: Env, path: string, init: RequestInit = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {...init, headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',...init.headers}});
}
async function admin(env: Env, authorization: string | null) {
  if (!authorization?.startsWith('Bearer ')) return null;
  const auth = await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:authorization}});
  if(!auth.ok) return null;
  const user = await auth.json() as {id:string};
  const profile = await database(env,`profiles?id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&is_admin=eq.true&select=id`);
  if(!profile.ok) return null;
  return (await profile.json() as unknown[]).length ? user.id : null;
}
export async function mercadoLivre(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if(!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.ML_CLIENT_ID || !env.ML_CLIENT_SECRET || !env.ML_REDIRECT_URI) return reply({error:'A configuração da integração no servidor está incompleta.'},503);
  try {
    if(url.pathname.endsWith('/callback')) {
      if(request.method!=='GET') return reply({error:'Método inválido.'},405);
      const state=url.searchParams.get('state');
      const cookie=request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('ml_oauth='))?.slice(9);
      if(!state || !cookie || state!==cookie) return reply({error:'Autorização inválida. Inicie a conexão novamente no Rocket.'},400);
      const consumed=await database(env,`ml_oauth_states?state=eq.${encodeURIComponent(state)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,{method:'DELETE',headers:{Prefer:'return=representation'}});
      if(!consumed.ok) return reply({error:'Não foi possível validar a autorização.'},503);
      const states=await consumed.json() as {user_id:string;verifier:string}[];
      if(states.length!==1) return reply({error:'Autorização expirada ou já utilizada.'},400);
      const profile=await database(env,`profiles?id=eq.${states[0].user_id}&is_active=eq.true&is_admin=eq.true&select=id`);
      if(!profile.ok || !(await profile.json() as unknown[]).length) return reply({error:'Acesso não autorizado.'},403);
      const redirect=(result:string)=>new Response(null,{status:303,headers:{Location:`/contas?ml=${result}`,'Set-Cookie':'ml_oauth=; Path=/api/marketplaces/mercadolivre; HttpOnly; Secure; SameSite=Lax; Max-Age=0','Cache-Control':'no-store'}});
      const code=url.searchParams.get('code');
      if(!code || url.searchParams.has('error')) return redirect('cancelled');
      const token=await fetch('https://api.mercadolibre.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:env.ML_CLIENT_ID,client_secret:env.ML_CLIENT_SECRET,code,redirect_uri:env.ML_REDIRECT_URI,code_verifier:states[0].verifier})});
      if(!token.ok) {
        console.error('Mercado Livre OAuth: token exchange failed', {status:token.status});
        return redirect('error');
      }
      const data=await token.json() as {access_token?:string;refresh_token?:string;expires_in?:number|string;user_id?:number|string};
      const expiresIn=Number(data.expires_in);
      if(!data.access_token || !data.refresh_token || !data.user_id || !Number.isFinite(expiresIn)) {
        console.error('Mercado Livre OAuth: token response missing required fields', {fields:Object.keys(data), types:Object.fromEntries(Object.entries(data).map(([key,value])=>[key,typeof value]))});
        return redirect('error');
      }
      const saved=await database(env,'ml_connections?on_conflict=seller_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({seller_id:String(data.user_id),connected_by:states[0].user_id,access_token:data.access_token,refresh_token:data.refresh_token,expires_at:new Date(Date.now()+expiresIn*1000).toISOString(),updated_at:new Date().toISOString()})});
      if(!saved.ok) console.error('Mercado Livre OAuth: connection save failed', {status:saved.status});
      return redirect(saved.ok?'connected':'error');
    }
    const user=await admin(env,request.headers.get('Authorization'));
    if(!user) return reply({error:'Somente administradores ativos podem conectar contas.'},403);
    if(url.pathname.endsWith('/shipping-quote') && request.method==='POST') {
      const body=await request.json() as {seller_id?:string;dimensions?:string;item_price?:number;listing_type_id?:string;mode?:string;logistic_type?:string;condition?:string;free_shipping?:boolean};
      const connectionPath=body.seller_id?`ml_connections?seller_id=eq.${encodeURIComponent(body.seller_id)}&select=seller_id,access_token`: 'ml_connections?select=seller_id,access_token&limit=1';
      const found=await database(env,connectionPath); const connections=found.ok?await found.json() as {seller_id:string;access_token:string}[]:[];
      if(!connections.length)return reply({error:'Nenhuma conta Mercado Livre conectada.'},404);
      if(!body.dimensions||!Number.isFinite(Number(body.item_price)))return reply({error:'Informe dimensões e preço para simular o frete.'},400);
      const q=new URLSearchParams({dimensions:body.dimensions,item_price:String(body.item_price),listing_type_id:body.listing_type_id||'gold_special',mode:body.mode||'me2',condition:body.condition||'new',logistic_type:body.logistic_type||'drop_off',free_shipping:String(body.free_shipping??true),verbose:'true'});
      const quote=await fetch(`https://api.mercadolibre.com/users/${encodeURIComponent(connections[0].seller_id)}/shipping_options/free?${q}`,{headers:{Authorization:`Bearer ${connections[0].access_token}`,'x-format-new':'true'}});
      const data=await quote.json(); if(!quote.ok)return reply({error:'Mercado Livre não retornou uma cotação.',details:data},502);
      return reply({seller_id:connections[0].seller_id,source:'mercadolivre.shipping_options',quote:data});
    }
    if(url.pathname.endsWith('/status') && request.method==='GET') {
      const response=await database(env,'ml_connections?select=seller_id,expires_at,updated_at,access_token');
      if(!response.ok) return reply({error:'Prepare as tabelas da integração no Supabase.'},503);
      const rows=await response.json() as {seller_id:string;expires_at:string;updated_at?:string;access_token:string}[];
      const connections=await Promise.all(rows.map(async row=>{
        let account_name='Conta Mercado Livre';
        try {
          const profile=await fetch(`https://api.mercadolibre.com/users/${encodeURIComponent(row.seller_id)}`,{headers:{Authorization:`Bearer ${row.access_token}`}});
          if(profile.ok){const data=await profile.json() as {nickname?:string};if(data.nickname) account_name=data.nickname;}
        } catch {}
        return {seller_id:row.seller_id,account_name,expires_at:row.expires_at,updated_at:row.updated_at};
      }));
      return reply({connections});
    }
    if(!url.pathname.endsWith('/connect') || request.method!=='POST') return reply({error:'Rota inválida.'},404);
    if(request.headers.get('Origin')!==url.origin) return reply({error:'Origem inválida.'},403);
    const state=base64(crypto.getRandomValues(new Uint8Array(32)));
    const verifier=base64(crypto.getRandomValues(new Uint8Array(32)));
    const challenge=base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
    const saved=await database(env,'ml_oauth_states',{method:'POST',body:JSON.stringify({state,user_id:user,verifier,expires_at:new Date(Date.now()+600000).toISOString()})});
    if(!saved.ok) return reply({error:'Prepare as tabelas da integração no Supabase.'},503);
    const target=new URL('https://auth.mercadolivre.com.br/authorization');
    target.search=new URLSearchParams({response_type:'code',client_id:env.ML_CLIENT_ID,redirect_uri:env.ML_REDIRECT_URI,state,scope:'offline_access read write',code_challenge:challenge,code_challenge_method:'S256'}).toString();
    const result=reply({url:target.href});
    result.headers.set('Set-Cookie',`ml_oauth=${state}; Path=/api/marketplaces/mercadolivre; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    return result;
  } catch { return reply({error:'Falha de comunicação com a integração. Tente novamente.'},502); }
}

import {listings} from './listings';
import { listUsers } from './users';
import { mercadoLivre } from './mercadolivre';
import { pricing } from './pricing';
import { quoteFreightGroup } from './freight';
export interface Env {
  APP_ENV: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ML_CLIENT_ID?: string;
  ML_CLIENT_SECRET?: string;
  ML_REDIRECT_URI?: string;
  SHOPEE_PARTNER_ID?: string;
  SHOPEE_PARTNER_KEY?: string;
  SHOPEE_REDIRECT_URI?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/listings/')) return listings(request,env);
    if (url.pathname === '/api/pricing/freight-group/quote') return quoteFreightGroup(request, env);
    if (url.pathname === '/api/pricing/recalculate') return pricing(request, env);
    if (url.pathname === '/api/admin/users') return listUsers(request, env);
    if (url.pathname.startsWith('/api/marketplaces/mercadolivre/')) return mercadoLivre(request, env);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        app: "Ruta Direct Gestor",
        env: env.APP_ENV,
        integrations: {
          supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
          mercadolivre: Boolean(env.ML_CLIENT_ID && env.ML_CLIENT_SECRET),
          shopee: Boolean(env.SHOPEE_PARTNER_ID && env.SHOPEE_PARTNER_KEY),
        },
      });
    }

    if (url.pathname === "/api/marketplaces/mercadolivre/status") {
      return json({
        configured: Boolean(env.ML_CLIENT_ID && env.ML_CLIENT_SECRET),
        message: env.ML_CLIENT_ID ? "Credenciais presentes." : "Adicione ML_CLIENT_ID e ML_CLIENT_SECRET como secrets."
      });
    }

    if (url.pathname === "/api/marketplaces/shopee/status") {
      return json({
        configured: Boolean(env.SHOPEE_PARTNER_ID && env.SHOPEE_PARTNER_KEY),
        message: env.SHOPEE_PARTNER_ID ? "Credenciais presentes." : "Adicione SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY como secrets."
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Rota ainda não implementada na V1 inicial." }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

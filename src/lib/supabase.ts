import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || 'https://hgxeybqujthsucfhejqx.supabase.co';
// Public browser key. Database RLS enforces authenticated catalog access.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_txYXIGRQTc9pv-w0S6SIGw_p37c7tPW';

export const hasSupabase = Boolean(url && key);

export const supabase = hasSupabase
  ? createClient(url!, key!)
  : null;


import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase Client Warning] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Ensure environment variables are configured in Vercel project settings.'
  );
}

/**
 * The canonical site URL used for auth redirects.
 *
 * Priority:
 *  1. VITE_SITE_URL   — set to production URL in Vercel env vars
 *  2. window.location.origin — automatic fallback for any other environment
 *
 * NEVER hardcode localhost here. localhost is handled by the fallback
 * when running `npm run dev` without VITE_SITE_URL set.
 */
export const siteUrl: string =
  import.meta.env.VITE_SITE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
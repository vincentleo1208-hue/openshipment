// =============================================================
// OpenShipment — Supabase Client Factory
// Separate clients for browser, server, and admin (service_role)
// =============================================================
import { createBrowserClient } from '@supabase/ssr';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─── Browser Client (Client Components) ───────────────────────
// Used in: PublicSite tracking lookup, CheckoutWizard

export function createBrowserSupabase() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ─── Server Client (Server Components & Route Handlers) ───────
// Reads cookies for session — respects RLS per authenticated user

export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }); } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }); } catch {}
      },
    },
  });
}

// ─── Admin Client (Service Role — bypasses RLS) ───────────────
// Used ONLY in: admin API routes (adjust-weight, vendor-tracking)
// NEVER expose the service_role key to the browser

export function createAdminSupabase() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

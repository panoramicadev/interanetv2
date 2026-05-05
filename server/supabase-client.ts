import { createClient as createSupabaseClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';

// Node < 22 no expone WebSocket nativo, y supabase-js v2.99 inicializa
// RealtimeClient durante createClient(), por lo que falla con
// "Node.js 20 detected without native WebSocket support".
// Inyectamos `ws` como transport solo si no hay WebSocket global.
let cachedTransport: any | undefined;
async function getRealtimeTransport(): Promise<any | undefined> {
  if (typeof (globalThis as any).WebSocket !== 'undefined') return undefined;
  if (cachedTransport !== undefined) return cachedTransport;
  const mod: any = await import('ws');
  cachedTransport = mod.default ?? mod.WebSocket ?? mod;
  return cachedTransport;
}

export async function createSupabase(
  url: string,
  key: string,
  options: SupabaseClientOptions<any> = {},
): Promise<SupabaseClient> {
  const transport = await getRealtimeTransport();
  const realtime = transport
    ? { ...(options.realtime ?? {}), transport }
    : options.realtime;
  return createSupabaseClient(url, key, { ...options, realtime });
}

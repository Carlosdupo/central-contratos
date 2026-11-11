import "server-only";
import { createClient } from "@supabase/supabase-js";
import { envPublico } from "@/lib/env";
import { envServidor } from "@/lib/env.server";

// Ignora a RLS. Uso restrito a: convite de usuários pelo admin (depois de checar o papel)
// e tarefas agendadas (cron). Nunca importar em código que roda no navegador.
export function criarClienteAdmin() {
  return createClient(envPublico.NEXT_PUBLIC_SUPABASE_URL, envServidor.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

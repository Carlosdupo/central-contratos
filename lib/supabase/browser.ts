import { createBrowserClient } from "@supabase/ssr";
import { envPublico } from "@/lib/env";

export function criarClienteNavegador() {
  return createBrowserClient(envPublico.NEXT_PUBLIC_SUPABASE_URL, envPublico.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

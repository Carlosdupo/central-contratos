import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./tipos";
import { envPublico } from "@/lib/env";

export function criarClienteNavegador() {
  return createBrowserClient<Database>(envPublico.NEXT_PUBLIC_SUPABASE_URL, envPublico.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./tipos";
import { envPublico } from "@/lib/env";

// Cliente com o JWT do usuário: toda consulta passa pela RLS.
// Criar um por requisição; nunca reaproveitar entre requisições.
export async function criarClienteServidor() {
  const loja = await cookies();
  return createServerClient<Database>(envPublico.NEXT_PUBLIC_SUPABASE_URL, envPublico.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return loja.getAll();
      },
      setAll(lista) {
        try {
          lista.forEach(({ name, value, options }) => loja.set(name, value, options));
        } catch {
          // Chamado de um Server Component, que não grava cookie. O proxy renova a sessão.
        }
      },
    },
  });
}

import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Links temporários (5 min) das fotos. Só chamar com caminhos lidos pela RLS do usuário
 * (pessoas.foto_path), nunca com caminho vindo do navegador.
 */
export async function linksDasFotos(caminhos: (string | null | undefined)[]): Promise<Map<string, string>> {
  const validos = [...new Set(caminhos.filter((c): c is string => !!c))];
  if (validos.length === 0) return new Map();
  const { data } = await criarClienteAdmin().storage.from("documentos").createSignedUrls(validos, 300);
  const pares: [string, string][] = [];
  for (const d of data ?? []) if (d.path && d.signedUrl) pares.push([d.path, d.signedUrl]);
  return new Map(pares);
}

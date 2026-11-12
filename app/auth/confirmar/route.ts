import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { criarClienteServidor } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/destino-seguro";

const TIPOS: EmailOtpType[] = ["invite", "recovery", "email", "email_change"];

// Destino dos links enviados por e-mail (convite e recuperação de senha). Aceita os dois formatos:
// - ?code=... (link padrão do Supabase, fluxo PKCE)
// - ?token_hash=...&type=... (modelos próprios em supabase/templates, quando houver SMTP próprio)
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  const proximo = url.searchParams.get("proximo");
  const destino = destinoSeguro(proximo, "/painel");

  // Link padrão do Supabase com fluxo PKCE (recuperação de senha pedida pelo próprio sistema): ?code=...
  const codigo = url.searchParams.get("code");
  if (codigo) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }

  if (tokenHash && tipo && TIPOS.includes(tipo)) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }

  return NextResponse.redirect(new URL("/login?erro=link", url.origin));
}

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { criarClienteServidor } from "@/lib/supabase/server";

const TIPOS: EmailOtpType[] = ["invite", "recovery", "email", "email_change"];

// Destino dos links enviados por e-mail (convite e recuperação de senha).
// Os modelos de e-mail do Supabase precisam apontar para:
// {{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=<tipo>&proximo=/definir-senha
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  const proximo = url.searchParams.get("proximo");
  const destino = proximo?.startsWith("/") && !proximo.startsWith("//") ? proximo : "/painel";

  if (tokenHash && tipo && TIPOS.includes(tipo)) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }

  return NextResponse.redirect(new URL("/login?erro=link", url.origin));
}

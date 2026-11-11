import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// /api/cron se autentica pelo CRON_SECRET, não por sessão.
const ROTAS_PUBLICAS = ["/login", "/recuperar-senha", "/convite", "/auth", "/api/cron"];

// Renova a sessão do Supabase a cada requisição e manda para o login quem não está autenticado.
// A autorização de verdade (papéis) acontece no servidor de cada tela/ação e na RLS.
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(lista, cabecalhos) {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
          Object.entries(cabecalhos).forEach(([chave, valor]) => resposta.headers.set(chave, valor));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const caminho = request.nextUrl.pathname;
  const publica = ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(`${r}/`));

  if (!data?.claims && !publica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = caminho === "/" ? "" : `?proximo=${encodeURIComponent(caminho)}`;
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};

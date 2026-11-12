import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { montarCsp } from "@/lib/csp";

// /api/cron se autentica pelo CRON_SECRET, não por sessão.
const ROTAS_PUBLICAS = ["/login", "/recuperar-senha", "/convite", "/auth", "/api/cron"];

// Renova a sessão do Supabase a cada requisição e manda para o login quem não está autenticado.
// A autorização de verdade (papéis) acontece no servidor de cada tela/ação e na RLS.
// Também gera o nonce da CSP: o Next lê o cabeçalho Content-Security-Policy da requisição e aplica o nonce nos scripts.
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = montarCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    desenvolvimento: process.env.NODE_ENV === "development",
  });

  // Resposta que repassa à página os cookies atuais da requisição (inclusive os recém-renovados) e o nonce.
  const novaResposta = () => {
    const cabecalhos = new Headers(request.headers);
    cabecalhos.set("x-nonce", nonce);
    cabecalhos.set("content-security-policy", csp);
    const r = NextResponse.next({ request: { headers: cabecalhos } });
    r.headers.set("content-security-policy", csp);
    return r;
  };
  let resposta = novaResposta();

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
          resposta = novaResposta();
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

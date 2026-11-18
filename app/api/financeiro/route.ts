import { NextResponse, type NextRequest } from "next/server";
import { obterUsuarioAtual } from "@/modules/acesso/sessao";
import { temAlgumPapel } from "@/modules/acesso/papeis";
import { agoraNoFuso } from "@/lib/datas";
import { formatarCnpj } from "@/lib/documentos-br";
import { competenciaAtual } from "@/modules/terceiros/dominio/documentos";
import { PAPEIS_FINANCEIRO, painelFinanceiro } from "@/modules/financeiro/consultas";
import { competenciaDoParametro, csvFinanceiro } from "@/modules/financeiro/dominio";

// Exportação da aba Liberação financeira (CSV para o Excel). O banco confere o acesso de novo.
export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioAtual();
  if (!usuario || usuario.tipo !== "interno" || usuario.trocarSenha || !temAlgumPapel(usuario.papeis, PAPEIS_FINANCEIRO)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 403 });
  }
  const hoje = agoraNoFuso().data;
  const competencia = competenciaDoParametro(request.nextUrl.searchParams.get("competencia") ?? undefined, competenciaAtual(hoje));
  const linhas = await painelFinanceiro(competencia);
  return new NextResponse(csvFinanceiro(linhas, competencia, hoje, formatarCnpj), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="liberacao-financeira-${competencia.slice(0, 7)}.csv"`,
      "cache-control": "no-store",
    },
  });
}

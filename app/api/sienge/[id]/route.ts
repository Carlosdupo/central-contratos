import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { obterUsuarioAtual } from "@/modules/acesso/sessao";
import { solicitacaoCompleta } from "@/modules/sienge/consultas";
import { gerarCsvSienge, nomeArquivoSienge } from "@/lib/solicitacao-sienge";

// CSV de importação da solicitação no Sienge. Quem pode ver é conferido pela RLS (quem vê a obra).
export async function GET(_: NextRequest, { params }: RouteContext<"/api/sienge/[id]">) {
  const usuario = await obterUsuarioAtual();
  if (!usuario || usuario.tipo !== "interno" || usuario.trocarSenha) return NextResponse.json({ erro: "não autorizado" }, { status: 403 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ erro: "não encontrada" }, { status: 404 });
  const s = await solicitacaoCompleta(id, usuario.id);
  if (!s) return NextResponse.json({ erro: "não encontrada" }, { status: 404 });
  const csv = gerarCsvSienge({ unidade_construtiva: s.unidadeConstrutiva, conta_financeira: s.contaFinanceira, itens: s.itens }, s.eap);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nomeArquivoSienge(s.titulo)}"`,
      "cache-control": "no-store",
    },
  });
}

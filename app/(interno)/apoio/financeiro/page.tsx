import type { Metadata } from "next";
import Link from "next/link";
import { exigirPapel } from "@/modules/acesso/sessao";
import { agoraNoFuso, formatarData } from "@/lib/datas";
import { competenciaAtual, formatarCompetencia } from "@/modules/terceiros/dominio/documentos";
import { PAPEIS_FINANCEIRO, painelFinanceiro } from "@/modules/financeiro/consultas";
import { competenciaDoParametro, prazoDaCompetencia, somarMesesCompetencia } from "@/modules/financeiro/dominio";
import { QuadroFinanceiro } from "@/components/app/quadro-financeiro";

export const metadata: Metadata = { title: "Liberação financeira" };

export default async function PaginaFinanceiro({ searchParams }: PageProps<"/apoio/financeiro">) {
  await exigirPapel(...PAPEIS_FINANCEIRO);
  const hoje = agoraNoFuso().data;
  const { competencia: param } = await searchParams;
  const competencia = competenciaDoParametro(typeof param === "string" ? param : undefined, competenciaAtual(hoje));
  const linhas = await painelFinanceiro(competencia);
  const meses = [-2, -1, 0, 1].map((n) => somarMesesCompetencia(competencia, n)).filter((c) => c <= competenciaAtual(hoje));
  const chave = competencia.slice(0, 7);

  return (
    <>
      <div>
        <h1 className="titulo">Liberação financeira</h1>
        <p className="mt-1.5 max-w-[70ch] text-[15px] text-muted-foreground">
          Empresas liberadas para receber na competência: a documentação mensal (empresa e funcionários liberados em obra) está completa e aprovada pelo RH e pela Segurança.
          A liberação é automática e aparece aqui na hora; o financeiro também recebe um e-mail com as liberadas na manhã seguinte.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Competência" className="flex flex-wrap gap-2">
            {meses.map((c) => (
              <Link key={c} href={`/apoio/financeiro?competencia=${c.slice(0, 7)}`} aria-current={c === competencia ? "page" : undefined} className="filtro-pilula">
                {formatarCompetencia(c)}
              </Link>
            ))}
          </nav>
          <a href={`/api/financeiro?competencia=${chave}`} className="botao" download={`liberacao-financeira-${chave}.csv`}>Exportar para Excel (CSV)</a>
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Competência {formatarCompetencia(competencia)}: a empresa envia até {formatarData(prazoDaCompetencia(competencia))}. Depois disso, quem não mandou tudo aparece em Atrasadas.
        </p>
      </div>
      <QuadroFinanceiro linhas={linhas} competencia={competencia} hoje={hoje} />
    </>
  );
}

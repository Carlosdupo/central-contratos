import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirPapel } from "@/modules/acesso/sessao";
import { detalheDoEnvio } from "@/modules/terceiros/analise";
import { aprovarDocumento, concluirAnalise, reprovarDocumento } from "@/modules/terceiros/acoes-rh";
import { formatarCompetencia } from "@/modules/terceiros/dominio/documentos";
import { agoraNoFuso, formatarData } from "@/lib/datas";
import { BotaoAbrirArquivo } from "@/components/app/documentos";
import { Formulario } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Analisar documentos" };

export default async function PaginaAnaliseEnvio({ params }: PageProps<"/terceiros/analise/[envioId]">) {
  await exigirPapel("rh");
  const { envioId } = await params;
  if (!z.uuid().safeParse(envioId).success) notFound();
  const d = await detalheDoEnvio(envioId);
  if (!d) notFound();

  const aberto = d.envio.situacao === "aberto";
  const faltam = d.itens.filter((i) => !i.decisao).length;

  return (
    <>
      <div>
        <Link href="/terceiros/analise" className="text-[14px] text-primary">← Análise do RH</Link>
        <h1 className="titulo mt-2">{d.pessoa ?? d.empresa}</h1>
        <p className="text-[15px] text-muted-foreground">
          {d.pessoa ? `${d.empresa} · ${d.obras.join(", ") || "sem obra"}` : "Documentos da empresa"} · enviado em {formatarData(agoraNoFuso(new Date(d.envio.enviado_em)).data)}
        </p>
      </div>

      <section className="painel">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="subtitulo">Documentos</h2>
          <span className="text-[13px] text-muted-foreground">{aberto ? (faltam ? `Faltam ${faltam} para decidir` : "Tudo decidido") : "Análise concluída"}</span>
        </div>
        <div className="lista-agrupada">
          {d.itens.map((item) => (
            <div key={item.id} className="flex flex-col gap-2.5 px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <div className="font-medium">{item.nome}{item.sensivel && <span className="ml-2 text-xs font-normal text-faint">dado de saúde</span>}</div>
                  <div className="text-[12.5px] text-muted-foreground">
                    {[item.valorTexto, item.competencia && `Competência ${formatarCompetencia(item.competencia)}`, item.validade && `Válido até ${formatarData(item.validade)}`].filter(Boolean).join(" · ") || "Sem validade"}
                  </div>
                  {item.decisao === "reprovado" && <div className="text-[12.5px] text-bad">Reprovado: {item.motivo}</div>}
                </div>
                <div className="flex items-center gap-3">
                  {item.arquivoId && <BotaoAbrirArquivo arquivoId={item.arquivoId} />}
                  {item.decisao === "aprovado" && <span className="selo selo-ok">Aprovado</span>}
                  {item.decisao === "reprovado" && <span className="selo selo-erro">Reprovado</span>}
                </div>
              </div>
              {aberto && !item.decisao && (
                <div className="flex flex-wrap items-start gap-3">
                  <Formulario acao={aprovarDocumento.bind(null, item.id)} textoBotao="Aprovar" className="flex" />
                  <Formulario acao={reprovarDocumento.bind(null, item.id)} textoBotao="Reprovar" variante="perigo" className="flex flex-wrap items-center gap-2">
                    <input name="motivo" placeholder="Motivo (a empresa vai ver)" aria-label="Motivo da reprovação" className="campo max-w-[300px] py-1.5" />
                  </Formulario>
                </div>
              )}
            </div>
          ))}
        </div>
        {aberto && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t-[.5px] border-sep pt-4">
            <p className="text-[13px] text-muted-foreground">Ao concluir, a empresa recebe o resultado e, se aprovado, a data da integração.</p>
            {faltam === 0 ? <Formulario acao={concluirAnalise.bind(null, envioId)} textoBotao="Concluir análise" /> : <button className="botao botao-primario" disabled>Concluir análise</button>}
          </div>
        )}
      </section>
    </>
  );
}

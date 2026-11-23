import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirPapel } from "@/modules/acesso/sessao";
import { detalheDoEnvio, type Responsavel } from "@/modules/terceiros/analise";
import { aprovarDocumento, concluirAnalise, reprovarDocumento } from "@/modules/terceiros/acoes-rh";
import { BlocoAnalise, type ItemAnalise } from "@/components/app/bloco-analise";
import { progressoDocumentos, type EstadoItem } from "@/modules/terceiros/dominio/documentos";
import { agoraNoFuso, formatarData } from "@/lib/datas";
import { Formulario } from "@/components/app/formulario";
import { ProgressoDocumentos } from "@/components/app/progresso-documentos";

export const metadata: Metadata = { title: "Analisar documentos" };

const BLOCOS: { chave: Responsavel; titulo: string; area: string }[] = [
  { chave: "rh", titulo: "Para o RH", area: "RH" },
  { chave: "sst", titulo: "Para a Segurança do Trabalho", area: "Segurança" },
];

const estadoDaDecisao = (i: ItemAnalise): EstadoItem => (i.decisao === "aprovado" ? "aprovado" : i.decisao === "reprovado" ? "reprovado" : "enviado");

export default async function PaginaAnaliseEnvio({ params }: PageProps<"/terceiros/analise/[envioId]">) {
  const usuario = await exigirPapel("rh", "sst");
  const { envioId } = await params;
  if (!z.uuid().safeParse(envioId).success) notFound();
  const d = await detalheDoEnvio(envioId);
  if (!d) notFound();

  const aberto = d.envio.situacao === "aberto";
  const faltam = d.itens.filter((i) => !i.decisao).length;
  const blocos = BLOCOS.map((b) => ({ ...b, itens: d.itens.filter((i) => i.responsavel === b.chave), meu: usuario.papeis.includes(b.chave) }))
    .filter((b) => b.itens.length > 0)
    .sort((a, b) => Number(b.meu) - Number(a.meu));

  return (
    <>
      <div>
        <Link href="/terceiros/analise" className="text-[14px] text-primary">← Análise de documentos</Link>
        <h1 className="titulo mt-2">{d.pessoa ?? d.empresa}</h1>
        <p className="text-[15px] text-muted-foreground">
          {d.pessoa ? `${d.empresa} · ${d.obras.join(", ") || "sem obra"}` : "Documentos da empresa"} · enviado em {formatarData(agoraNoFuso(new Date(d.envio.enviado_em)).data)}
        </p>
      </div>

      <section className="painel" aria-label="Andamento da análise">
        <ProgressoDocumentos progresso={progressoDocumentos(d.itens.map(estadoDaDecisao))} rotulo="Aprovados neste envio" />
        {blocos.length > 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {blocos.map((b) => (
              <ProgressoDocumentos key={b.chave} progresso={progressoDocumentos(b.itens.map(estadoDaDecisao))} rotulo={`Aprovados pelo ${b.area}`} />
            ))}
          </div>
        )}
      </section>

      {blocos.map((b) => (
        <BlocoAnalise
          key={b.chave}
          bloco={b}
          aberto={aberto}
          aprovar={(id) => aprovarDocumento.bind(null, id)}
          devolver={(id) => reprovarDocumento.bind(null, id)}
        />
      ))}

      {aberto && (
        <section className="painel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[60ch] text-[13px] text-muted-foreground">
              {d.itens.length === 0
                ? "Sem documento novo: a pessoa já tem tudo aprovado e vai para mais uma obra. Conclua para marcar a integração."
                : faltam
                ? `Faltam ${faltam} documentos. A análise pode ser concluída quando RH e Segurança decidirem todos.`
                : "Tudo decidido. Ao concluir, a empresa recebe o resultado e, se aprovado, a data da integração."}
            </p>
            <Formulario acao={concluirAnalise.bind(null, envioId)} textoBotao="Concluir análise" desabilitado={faltam > 0} sensivel="Conclui a análise e avisa a empresa; quem foi aprovado entra na integração." />
          </div>
        </section>
      )}
    </>
  );
}

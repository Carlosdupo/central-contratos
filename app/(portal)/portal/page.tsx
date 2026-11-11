import type { Metadata } from "next";
import { exigirExterno } from "@/modules/acesso/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { documentosDaEmpresa, equipeDaEmpresa } from "@/modules/terceiros/consultas";
import { linksDasFotos } from "@/modules/terceiros/fotos";
import { ListaEquipe } from "@/components/app/lista-equipe";
import Link from "next/link";
import { enviarDocumentosEmpresa } from "@/modules/terceiros/acoes";
import { podeEnviarParaAnalise } from "@/modules/terceiros/dominio/documentos";
import { ListaDocumentosEmpresa } from "@/components/app/lista-documentos-empresa";
import { agoraNoFuso, formatarData } from "@/lib/datas";
import { Formulario } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Portal da empresa" };

const SITUACAO: Record<string, [string, string, string]> = {
  convidada: ["selo-neutro", "Cadastro incompleto", "Anexe os documentos abaixo e envie para análise."],
  cadastro_incompleto: ["selo-neutro", "Cadastro incompleto", "Anexe os documentos abaixo e envie para análise."],
  em_analise: ["selo-info", "Em análise do RH", "O RH está conferindo os documentos. Você recebe o resultado por e-mail."],
  pendente: ["selo-erro", "Documentos pendentes", "Alguns documentos foram reprovados. Veja o motivo, corrija e envie de novo."],
  aprovada: ["selo-ok", "Documentos aprovados", "Os documentos da empresa estão em dia."],
  bloqueada: ["selo-erro", "Bloqueada", "Fale com o setor de suprimentos da construtora."],
};

export default async function PaginaPortal() {
  const { empresaId } = await exigirExterno();
  const supabase = await criarClienteServidor();
  // Primeiro acesso: a empresa deixa de aparecer como "convidada" para a equipe interna.
  await supabase.rpc("registrar_primeiro_acesso", { p_empresa: empresaId });
  const [{ data: empresa }, { itens }, { data: prazo }] = await Promise.all([
    supabase.from("empresas_terceiras").select("situacao").eq("id", empresaId).single(),
    documentosDaEmpresa(empresaId),
    supabase.from("parametros").select("valor").eq("chave", "prazo_analise_rh").maybeSingle(),
  ]);
  const prazoRh = prazo?.valor as { dias: number; uteis: boolean } | undefined;

  const equipe = await equipeDaEmpresa(empresaId);
  const { data: avisos } = await supabase.from("notificacoes").select("id, assunto, texto, criado_em").eq("empresa_id", empresaId).order("criado_em", { ascending: false }).limit(10);
  const fotos = await linksDasFotos(equipe.map((m) => m.fotoPath));
  const [classe, rotulo, explicacao] = SITUACAO[empresa?.situacao ?? "cadastro_incompleto"];
  const faltam = itens.filter((i) => ["falta", "reprovado", "vencido"].includes(i.estado)).length;
  const aprovados = itens.filter((i) => i.estado === "aprovado").length;
  const podeEnviar = podeEnviarParaAnalise(itens.map((i) => i.estado));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Documentos da empresa</h1>
          <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">{explicacao}</p>
        </div>
        <span className={`selo ${classe}`}>{rotulo}</span>
      </div>

      <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <div className="painel gap-1.5"><span className="text-[40px] leading-none font-bold tracking-tight tabular-nums">{aprovados}<span className="text-xl text-faint">/{itens.length}</span></span><span className="text-[13px] font-medium text-muted-foreground">Aprovados</span></div>
        <div className="painel gap-1.5"><span className={`text-[40px] leading-none font-bold tracking-tight tabular-nums ${faltam ? "text-bad" : ""}`}>{faltam}</span><span className="text-[13px] font-medium text-muted-foreground">Faltam ou precisam de correção</span></div>
        <div className="painel gap-1.5"><span className="text-[40px] leading-none font-bold tracking-tight tabular-nums">{prazoRh?.dias ?? "—"}</span><span className="text-[13px] font-medium text-muted-foreground">{prazoRh?.uteis === false ? "Dias" : "Dias úteis"} para o RH analisar</span></div>
      </div>

      <section className="painel">
        <div>
          <h2 className="subtitulo">O que precisa ser enviado</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">PDF, JPG ou PNG de até 10 MB. Documentos com validade pedem a data.</p>
        </div>
        <ListaDocumentosEmpresa itens={itens} editavel podeAbrir />
        {podeEnviar ? (
          <Formulario acao={enviarDocumentosEmpresa} textoBotao="Enviar para análise" />
        ) : (
          faltam > 0 && <p className="text-right text-[13px] text-muted-foreground">O envio para análise libera quando todos os documentos estiverem anexados.</p>
        )}
      </section>

      <section className="painel">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="subtitulo">Equipe</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Funcionários e sócios que vão à obra. Cada pessoa tem os próprios documentos.</p>
          </div>
          <Link href="/portal/equipe/nova" className="botao botao-primario botao-pequeno">+ Adicionar pessoa</Link>
        </div>
        <ListaEquipe equipe={equipe} fotos={fotos} linkBase="/portal/equipe" />
      </section>
      <section className="painel">
        <div>
          <h2 className="subtitulo">Avisos recebidos</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Resultados das análises do RH. Também são enviados para o e-mail da empresa.</p>
        </div>
        {(avisos ?? []).length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Nenhum aviso ainda.</p>
        ) : (
          <div className="lista-agrupada">
            {(avisos ?? []).map((a) => (
              <details key={a.id} className="px-3.5 py-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{a.assunto}</span>
                  <span className="font-mono text-xs text-faint">{formatarData(agoraNoFuso(new Date(a.criado_em)).data)}</span>
                </summary>
                <p className="mt-2 text-[13.5px] whitespace-pre-line text-muted-foreground">{a.texto.split("\n\nAcesse o portal")[0]}</p>
              </details>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirExterno } from "@/modules/acesso/sessao";
import { documentosDoVinculo } from "@/modules/terceiros/consultas";
import { enviarDocumentosPessoa } from "@/modules/terceiros/acoes";
import { linksDasFotos } from "@/modules/terceiros/fotos";
import { podeEnviarParaAnalise } from "@/modules/terceiros/dominio/documentos";
import { SITUACAO_ALOCACAO, TIPO_VINCULO } from "@/modules/terceiros/rotulos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { agoraNoFuso, formatarData, somarDias } from "@/lib/datas";
import { Avatar } from "@/components/app/avatar";
import { EnviarArquivo } from "@/components/app/documentos";
import { ListaDocumentosPessoa } from "@/components/app/lista-documentos-pessoa";
import { Formulario } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Pessoa" };

const SITUACAO_VISITA: Record<string, [string, string]> = {
  solicitada: ["selo-info", "Aguardando o RH"],
  aprovada: ["selo-ok", "Aprovada"],
  recusada: ["selo-erro", "Recusada"],
};

export default async function PaginaPessoaPortal({ params }: PageProps<"/portal/equipe/[vinculoId]">) {
  const { empresaId } = await exigirExterno();
  const { vinculoId } = await params;
  if (!z.uuid().safeParse(vinculoId).success) notFound();

  const supabase = await criarClienteServidor();
  const [{ data: v }, dados, { data: obras }, { data: visitas }, { data: param }] = await Promise.all([
    supabase.from("vinculos").select("id, tipo, funcao, eletricidade, empresa_id, pessoas(id, nome, foto_path), alocacoes(situacao, integracao_data, obras(nome))").eq("id", vinculoId).maybeSingle(),
    documentosDoVinculo(vinculoId),
    supabase.from("empresa_obras").select("obra_id, obras(nome)").eq("empresa_id", empresaId).eq("ativo", true),
    supabase.from("visitas").select("id, data, situacao, motivo, obras(nome)").eq("vinculo_id", vinculoId).order("data", { ascending: false }),
    supabase.from("parametros").select("valor").eq("chave", "antecedencia_visita_dias").maybeSingle(),
  ]);
  if (!v || v.empresa_id !== empresaId || !dados || !v.pessoas) notFound();

  const { data: cpf } = await supabase.rpc("cpf_mascarado", { p_pessoa: v.pessoas.id });
  const fotos = await linksDasFotos([v.pessoas.foto_path]);
  const esporadico = v.tipo === "socio_esporadico";
  const podeEnviar = podeEnviarParaAnalise(dados.itens.map((i) => i.estado));
  const faltam = dados.itens.filter((i) => ["falta", "reprovado", "vencido"].includes(i.estado)).length;

  return (
    <>
      <div>
        <Link href="/portal" className="text-[14px] text-primary">← Portal</Link>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Avatar nome={v.pessoas.nome} url={v.pessoas.foto_path ? fotos.get(v.pessoas.foto_path) : null} grande />
          <div className="min-w-0">
            <h1 className="titulo text-[28px]">{v.pessoas.nome}</h1>
            <p className="text-[14px] text-muted-foreground">{v.funcao} · {TIPO_VINCULO[v.tipo]}{v.eletricidade ? " · eletricidade" : ""} · CPF {cpf ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {esporadico ? (
          <section className="painel">
            <div>
              <h2 className="subtitulo">Pedir visita</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">Com pelo menos {(param?.valor as number) ?? 1} dia(s) de antecedência. Anexe um documento com foto (RG ou CNH).</p>
            </div>
            <EnviarArquivo
              dono={{ tipo: "visita", vinculo: vinculoId }}
              tipoDoc="visita"
              textoBotao="Pedir visita"
              visita={{ obras: (obras ?? []).map((o) => ({ id: o.obra_id, nome: o.obras?.nome ?? "" })), dataMinima: somarDias(agoraNoFuso().data, (param?.valor as number) ?? 1) }}
            />
            {(visitas ?? []).length > 0 && (
              <div className="lista-agrupada">
                {(visitas ?? []).map((vi) => {
                  const [classe, rotulo] = SITUACAO_VISITA[vi.situacao];
                  return (
                    <div key={vi.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                      <span>{formatarData(vi.data)} · {vi.obras?.nome}{vi.motivo ? <span className="block text-xs text-bad">{vi.motivo}</span> : null}</span>
                      <span className={`selo ${classe}`}>{rotulo}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="painel">
            <div>
              <h2 className="subtitulo">Documentos</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{dados.itens.length} exigidos para {v.tipo === "funcionario" ? "funcionário" : "sócio com acesso diário"}. PDF, JPG ou PNG de até 10 MB.</p>
            </div>
            <ListaDocumentosPessoa vinculoId={vinculoId} itens={dados.itens} editavel podeAbrir={() => true} />
            {podeEnviar ? (
              <Formulario acao={enviarDocumentosPessoa.bind(null, vinculoId)} textoBotao="Enviar para análise" />
            ) : (
              faltam > 0 && <p className="text-right text-[13px] text-muted-foreground">Faltam {faltam} documento(s). O envio libera quando tudo estiver anexado.</p>
            )}
          </section>
        )}

        <div className="flex flex-col gap-5">
          {!esporadico && (
            <section className="painel">
              <h2 className="subtitulo">Situação por obra</h2>
              <div className="lista-agrupada">
                {(v.alocacoes ?? []).map((a, i) => {
                  const [classe, rotulo] = SITUACAO_ALOCACAO[a.situacao];
                  return (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                      <span>{a.obras?.nome}{a.integracao_data ? <span className="block text-xs text-muted-foreground">Integração em {formatarData(a.integracao_data)}</span> : null}</span>
                      <span className={`selo ${classe}`}>{rotulo}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          <section className="painel">
            <h2 className="subtitulo">Foto do crachá</h2>
            <p className="text-[13px] text-muted-foreground">Foto de rosto, de frente, JPG ou PNG.</p>
            <EnviarArquivo dono={{ tipo: "foto", vinculo: vinculoId }} tipoDoc="foto" textoBotao="Enviar foto" />
          </section>
        </div>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirInterno } from "@/modules/acesso/sessao";
import { temAlgumPapel } from "@/modules/acesso/papeis";
import { documentosDoVinculo } from "@/modules/terceiros/consultas";
import { linksDasFotos } from "@/modules/terceiros/fotos";
import { SITUACAO_ALOCACAO, TIPO_VINCULO } from "@/modules/terceiros/rotulos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData } from "@/lib/datas";
import { Avatar } from "@/components/app/avatar";
import { BotaoAbrir } from "@/components/app/documentos";
import { aproveitarDocumento, baixarFotoPessoa } from "@/modules/terceiros/acoes-rh";
import { Formulario } from "@/components/app/formulario";
import { agoraNoFuso } from "@/lib/datas";
import { ListaDocumentosPessoa } from "@/components/app/lista-documentos-pessoa";

export const metadata: Metadata = { title: "Pessoa" };

export default async function PaginaPessoaInterna({ params }: PageProps<"/terceiros/pessoas/[vinculoId]">) {
  const usuario = await exigirInterno();
  const { vinculoId } = await params;
  if (!z.uuid().safeParse(vinculoId).success) notFound();

  const supabase = await criarClienteServidor();
  const [{ data: v }, dados] = await Promise.all([
    supabase.from("vinculos").select("id, tipo, funcao, eletricidade, empresa_id, empresas_terceiras(razao_social), pessoas(id, nome, foto_path), alocacoes(situacao, integracao_data, liberado_em, obras(nome))").eq("id", vinculoId).maybeSingle(),
    documentosDoVinculo(vinculoId),
  ]);
  if (!v || !v.pessoas || !dados) notFound();
  const [{ data: cpf }, fotos, { data: deOutras }] = await Promise.all([
    supabase.rpc("cpf_mascarado", { p_pessoa: v.pessoas.id }),
    linksDasFotos([v.pessoas.foto_path]),
    supabase
      .from("documentos")
      .select("id, tipo_documento, data_validade, tipos_documento!inner(nome, responsavel, aproveitavel), vinculos!inner(pessoa_id, empresas_terceiras(razao_social))")
      .eq("vinculos.pessoa_id", v.pessoas.id)
      .eq("tipos_documento.aproveitavel", true)
      .eq("situacao", "aprovado")
      .neq("vinculo_id", vinculoId),
  ]);
  const hoje = agoraNoFuso().data;
  const estadoAqui = new Map(dados.itens.map((i) => [i.tipo.codigo, i.estado]));
  const aproveitaveis = (deOutras ?? []).filter((d) => !d.data_validade || d.data_validade >= hoje);

  // Mesmas regras da RLS: dado de saúde só RH/SST; demais arquivos para quem trata documentos.
  const saude = temAlgumPapel(usuario.papeis, ["rh", "sst"]);
  const comum = saude || temAlgumPapel(usuario.papeis, ["admin", "suprimentos", "contratos"]);

  return (
    <>
      <div>
        <Link href={`/terceiros/empresas/${v.empresa_id}`} className="text-[14px] text-primary">← {v.empresas_terceiras?.razao_social}</Link>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Avatar nome={v.pessoas.nome} url={v.pessoas.foto_path ? fotos.get(v.pessoas.foto_path) : null} grande />
          <div className="min-w-0">
            <h1 className="titulo text-[28px]">{v.pessoas.nome}</h1>
            <p className="text-[14px] text-muted-foreground">{v.funcao} · {TIPO_VINCULO[v.tipo]}{v.eletricidade ? " · eletricidade" : ""} · CPF {cpf ?? "—"}</p>
            {saude && v.pessoas.foto_path && <BotaoAbrir acao={baixarFotoPessoa.bind(null, vinculoId)} texto="Baixar foto (catraca)" />}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="painel">
          <h2 className="subtitulo">Documentos</h2>
          {v.tipo === "socio_esporadico" ? (
            <p className="text-[14px] text-muted-foreground">Sócio com acesso esporádico: não envia documentação; cada visita é pedida com antecedência.</p>
          ) : (
            <ListaDocumentosPessoa vinculoId={vinculoId} itens={dados.itens} editavel={false} podeAbrir={(sensivel) => (sensivel ? saude : comum)} />
          )}
        </section>
        <div className="flex flex-col gap-5">
        {aproveitaveis.length > 0 && (
          <section className="painel">
            <div>
              <h2 className="subtitulo">Aprovados em outra empresa</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">RG/CNH e certificados de NR da pessoa. Quem analisa o tipo decide se aproveita; a validade continua a mesma.</p>
            </div>
            <div className="lista-agrupada">
              {aproveitaveis.map((d) => {
                const nome = d.tipos_documento.nome;
                const empresa = d.vinculos.empresas_terceiras?.razao_social ?? "outra empresa";
                const jaTem = ["aprovado", "enviado"].includes(estadoAqui.get(d.tipo_documento) ?? "");
                const podeDecidir = usuario.papeis.includes(d.tipos_documento.responsavel as "rh" | "sst");
                return (
                  <div key={d.id} className="flex flex-col gap-2 px-3.5 py-2.5">
                    <span>
                      {nome}
                      <span className="block text-xs text-muted-foreground">{empresa}{d.data_validade ? ` · vale até ${formatarData(d.data_validade)}` : ""}</span>
                    </span>
                    {jaTem ? (
                      <span className="text-[13px] text-muted-foreground">Já aprovado ou em análise nesta empresa.</span>
                    ) : podeDecidir ? (
                      <Formulario
                        acao={aproveitarDocumento.bind(null, d.id, vinculoId)}
                        textoBotao={`Aproveitar ${nome}`}
                        variante="neutro"
                        confirmar={`O documento aprovado em ${empresa} passa a valer para esta empresa, com a mesma validade.`}
                      />
                    ) : (
                      <span className="text-[13px] text-muted-foreground">{d.tipos_documento.responsavel === "sst" ? "Decisão da Segurança do Trabalho." : "Decisão do RH."}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <section className="painel">
          <h2 className="subtitulo">Situação por obra</h2>
          <div className="lista-agrupada">
            {(v.alocacoes ?? []).length === 0 && <p className="px-3.5 py-2.5 text-[14px] text-muted-foreground">Sem obra.</p>}
            {(v.alocacoes ?? []).map((a, i) => {
              const [classe, rotulo] = SITUACAO_ALOCACAO[a.situacao];
              return (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                  <span>
                    {a.obras?.nome}
                    {a.integracao_data && <span className="block text-xs text-muted-foreground">Integração {formatarData(a.integracao_data)}</span>}
                  </span>
                  <span className={`selo ${classe}`}>{rotulo}</span>
                </div>
              );
            })}
          </div>
        </section>
        </div>
      </div>
    </>
  );
}

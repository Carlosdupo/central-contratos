import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirInterno } from "@/modules/acesso/sessao";
import { temAlgumPapel, type Papel } from "@/modules/acesso/papeis";
import { detalheDaContratacao } from "@/modules/contratacoes/consultas";
import { TIPO_CONTRATACAO, TRILHAS, formatarReais } from "@/modules/contratacoes/rotulos";
import {
  assinarContrato, cancelarContratacao, concluirEtapa, definirFornecedor, novaProposta, pularNegociacao, reabrirEtapa, registrarCotacao, salvarCampoEtapa, salvarCondicoesGerente, salvarEmailFornecedor,
} from "@/modules/contratacoes/acoes";
import { equipeDaEmpresa } from "@/modules/terceiros/consultas";
import { linksDasFotos } from "@/modules/terceiros/fotos";
import { formatarCnpj } from "@/lib/documentos-br";
import { formatarData } from "@/lib/datas";
import { SeloPrazo } from "@/components/app/selo-prazo";
import { CampoFornecedor } from "@/components/app/campo-fornecedor";
import { ChecklistEtapa } from "@/components/app/checklist-etapa";
import { CamposCondicoesGerente } from "@/components/app/campos-condicoes-gerente";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CampoTexto, Formulario } from "@/components/app/formulario";
import { ListaEquipe } from "@/components/app/lista-equipe";

export const metadata: Metadata = { title: "Contratação" };

const CAMPO: Record<number, { rotulo: string; chave: "sienge_solicitacao" | "sienge_contrato" }> = {
  4: { rotulo: "Nº da solicitação no Sienge", chave: "sienge_solicitacao" },
  7: { rotulo: "Código do contrato no Sienge", chave: "sienge_contrato" },
};

export default async function PaginaContratacao({ params, searchParams }: PageProps<"/contratacoes/[id]">) {
  const usuario = await exigirInterno();
  const { id } = await params;
  const { etapa: etapaParam } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const d = await detalheDaContratacao(id);
  if (!d) notFound();
  const { c, etapas, cotacoes, assinantes } = d;

  // Mesmas regras de app.pode_agir_como (o banco confere de novo). Coordenador: a RLS já limita às obras dele.
  const podeComo = (papel: Papel | null) =>
    !!papel && (papel === "suprimentos" ? temAlgumPapel(usuario.papeis, ["suprimentos", "gerente_suprimentos"]) : usuario.papeis.includes(papel));
  const emAndamento = etapas.filter((e) => e.situacao === "em_andamento");
  const numero = Number(etapaParam) || (emAndamento.find((e) => podeComo(e.papel)) ?? emAndamento[0] ?? etapas[11]).etapa;
  const sel = etapas.find((e) => e.etapa === numero) ?? etapas[0];
  const ativa = c.situacao === "em_andamento" && sel.situacao === "em_andamento";
  const pode = ativa && podeComo(sel.papel);
  const negociaObra = c.negociacao === "obra" && !c.negociacao_pulada;
  // Negociação pela obra: em 5, Suprimentos só ajusta o valor do fornecedor que a obra escolheu.
  const fornecedorTravado = sel.etapa === 5 && negociaObra && !!c.fornecedor_cnpj;
  const proxAssinante = assinantes.find((a) => !a.assinadoEm);
  const empresa = c.empresas_terceiras as { id: string; razao_social: string; situacao: string } | null;
  const equipe = empresa ? await equipeDaEmpresa(empresa.id) : [];
  const fotos = await linksDasFotos(equipe.map((m) => m.fotoPath));
  const ehAdmin = usuario.papeis.includes("admin");

  const podeEscolher = (sel.etapa === 3 && c.negociacao === "obra") || sel.etapa === 5;
  // Rodadas de negociação: obra na etapa 3 (negociação pela obra) ou Suprimentos na etapa 5.
  const podeNegociar = (sel.etapa === 3 && c.negociacao === "obra") || sel.etapa === 5;
  const opcoes = fornecedorTravado ? cotacoes.filter((q) => q.escolhida) : cotacoes;
  const empresasCadastradas =
    sel.etapa === 2 && pode
      ? ((await (await criarClienteServidor()).from("empresas_terceiras").select("razao_social, cnpj").order("razao_social")).data ?? []).map((e) => ({ razao: e.razao_social, cnpj: e.cnpj }))
      : [];
  const menor = cotacoes.length ? Math.min(...cotacoes.map((x) => Number(x.valor))) : 0;

  return (
    <>
      <div>
        <Link href="/contratacoes" className="text-[14px] text-primary">← Contratações</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[13px] text-muted-foreground">{c.codigo}</div>
            <h1 className="titulo">{c.servico}</h1>
          </div>
          {c.situacao === "liberada" && <span className="selo selo-ok">Liberada para a obra</span>}
          {c.situacao === "cancelada" && <span className="selo selo-neutro">Cancelada: {c.cancelamento_motivo}</span>}
        </div>
      </div>

      <div className="painel flex-row flex-wrap gap-x-8 gap-y-3 py-4 text-[14px]">
        {[
          ["Obra", c.obras?.nome],
          ["Tipo", TIPO_CONTRATACAO[c.tipo]],
          ["Fornecedor", c.fornecedor_nome ? `${c.fornecedor_nome} · ${formatarCnpj(c.fornecedor_cnpj ?? "")}` : "a definir"],
          ["Serviço da EAP", c.pacote ?? "—"],
          ["Negociação", negociaObra ? "Pela obra" : "Pelo Suprimentos"],
          ["Orçado", c.valor_orcado == null ? "não informado" : formatarReais(Number(c.valor_orcado))],
          ["Negociado", formatarReais(c.valor_negociado ? Number(c.valor_negociado) : null)],
          ["Sienge", [c.sienge_solicitacao && `SS ${c.sienge_solicitacao}`, c.sienge_contrato].filter(Boolean).join(" · ") || "—"],
        ].map(([r, v]) => (
          <div key={r as string}><div className="text-xs font-medium text-faint">{r}</div>{v}</div>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-5">
          {TRILHAS.map((t) => (
            <div key={t.chave}>
              <div className="flex items-baseline justify-between px-4 pb-1.5">
                <h2 className="text-[12.5px] font-semibold tracking-wide text-faint uppercase">{t.nome}</h2>
                {t.nota && <span className="text-xs text-faint">{t.nota}</span>}
              </div>
              <div className="flex flex-col overflow-hidden rounded-[14px] bg-card">
                {etapas.filter((e) => e.trilha === t.chave).map((e) => (
                  <Link
                    key={e.etapa}
                    href={`/contratacoes/${id}?etapa=${e.etapa}`}
                    scroll={false}
                    className={`relative grid grid-cols-[26px_minmax(0,1fr)] items-center gap-3 px-4 py-2.5 transition-colors [&+&]:border-t-[.5px] [&+&]:border-sep ${e.etapa === sel.etapa ? "bg-primary-soft" : "hover:bg-fill"}`}
                  >
                    <span className={`grid size-[26px] place-items-center rounded-full text-xs font-semibold ${
                      e.situacao === "concluida" || e.situacao === "pulada" ? "bg-[var(--ok-fill)] text-white" : e.situacao === "em_andamento" ? "border-2 border-primary bg-card text-primary" : "border-[1.5px] border-input text-faint"
                    }`}>{e.situacao === "concluida" ? "✓" : e.situacao === "pulada" ? "–" : e.etapa}</span>
                    <span className="min-w-0">
                      <span className={`block font-medium ${e.etapa === sel.etapa ? "text-primary" : e.situacao === "pendente" ? "text-muted-foreground" : ""}`}>{e.nome}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-faint">{e.responsavel}</span>
                        {e.concluidaEm && <span>{e.situacao === "pulada" ? "pulada" : "concluída"} {formatarData(e.concluidaEm).slice(0, 5)}</span>}
                        {e.prazo && <SeloPrazo prazo={e.prazo} uteis={!!e.prazoConfig?.uteis} />}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <section className="painel">
            <div>
              <div className="text-xs font-semibold text-faint">Etapa {sel.etapa} · {sel.responsavel}</div>
              <h2 className="subtitulo mt-1">{sel.nome}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                <span>{sel.prazoConfig ? `Prazo: ${sel.prazoConfig.dias} ${sel.prazoConfig.uteis ? "dias úteis" : "dias"}` : "Prazo ainda não definido"}</span>
                {sel.desde && <span>Início {formatarData(sel.desde)}</span>}
                {sel.prazo && <SeloPrazo prazo={sel.prazo} uteis={!!sel.prazoConfig?.uteis} />}
              </div>
            </div>

            {sel.situacao === "pendente" && (
              <p className="rounded-xl bg-fill px-3.5 py-2.5 text-[13px] text-muted-foreground">
                Começa quando concluir: {sel.dependencias.map((n) => etapas.find((e) => e.etapa === n)?.nome).join(" e ")}.
              </p>
            )}

            {sel.itens.length > 0 && sel.situacao !== "pendente" && (
              <ChecklistEtapa
                key={`${id}-${sel.etapa}`}
                contratacao={id}
                etapa={sel.etapa}
                itens={sel.itens}
                marcados={sel.marcados}
                editavel={pode}
                concluir={pode ? concluirEtapa.bind(null, id, sel.etapa) : null}
                textoBotao={sel.etapa === 6 ? "Autorizar" : "Concluir etapa"}
              />
            )}

            {CAMPO[sel.etapa] && sel.situacao !== "pendente" && (
              pode ? (
                <Formulario acao={salvarCampoEtapa.bind(null, id, sel.etapa)} textoBotao="Salvar" className="flex flex-wrap items-end gap-2">
                  <CampoTexto nome="valor" rotulo={CAMPO[sel.etapa].rotulo} padrao={c[CAMPO[sel.etapa].chave] as string | null} className="min-w-[220px] flex-1" />
                </Formulario>
              ) : (
                <p className="text-[13px]"><span className="text-muted-foreground">{CAMPO[sel.etapa].rotulo}:</span> {String(c[CAMPO[sel.etapa].chave] ?? "—")}</p>
              )
            )}

            {[2, 3, 5].includes(sel.etapa) && sel.situacao !== "pendente" && (
              <div className="flex flex-col gap-2">
                <h3 className="text-[14px] font-semibold">Cotações ({cotacoes.length}/3)</h3>
                <div className="lista-agrupada">
                  {cotacoes.length === 0 && <p className="px-3.5 py-2.5 text-[13px] text-muted-foreground">Nenhuma cotação registrada.</p>}
                  {cotacoes.map((q) => (
                    <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                      <span className="min-w-0">
                        <span className="block font-medium">{q.fornecedor}{Number(q.valor) === menor && cotacoes.length > 1 && <span className="ml-2 rounded-full bg-ok-soft px-2 py-px text-[11px] font-semibold text-ok">menor valor</span>}</span>
                        <span className="block font-mono text-xs text-muted-foreground">{formatarCnpj(q.cnpj)} · {formatarReais(Number(q.valor))}{q.prazo_dias ? ` · ${q.prazo_dias} d` : ""}</span>
                        {q.cotacao_propostas.length > 1 && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {[...q.cotacao_propostas].sort((a, b) => a.rodada - b.rodada).map((r) => `${r.rodada}ª ${formatarReais(Number(r.valor))}`).join(" → ")}
                          </span>
                        )}
                        {pode && podeNegociar && (
                          <details className="mt-1.5">
                            <summary className="cursor-pointer text-[12.5px] font-medium text-primary">Nova proposta</summary>
                            <Formulario acao={novaProposta.bind(null, id, q.id)} textoBotao="Registrar" className="mt-1.5 flex flex-wrap items-center gap-2">
                              <input name="valor" placeholder="Novo valor (R$)" aria-label={`Nova proposta de ${q.fornecedor}`} className="campo max-w-[180px] py-1.5" />
                            </Formulario>
                          </details>
                        )}
                      </span>
                      {q.escolhida && <span className="selo selo-info">Escolhido{c.valor_negociado ? ` · final ${formatarReais(Number(c.valor_negociado))}` : ""}</span>}
                    </div>
                  ))}
                </div>
                {sel.etapa === 2 && pode && cotacoes.length < 3 && (
                  <Formulario acao={registrarCotacao.bind(null, id)} textoBotao="Registrar cotação" className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                    <CampoFornecedor empresas={empresasCadastradas} />
                    <CampoTexto nome="valor" rotulo="Valor (R$)" />
                    <CampoTexto nome="prazo" rotulo="Prazo (dias)" />
                  </Formulario>
                )}
                {pode && podeEscolher && cotacoes.length > 0 && (
                  <Formulario acao={definirFornecedor.bind(null, id)} textoBotao="Salvar escolha" className="flex flex-col gap-3 rounded-xl border-[.5px] border-sep p-3.5">
                    <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-2 max-sm:grid-cols-1">
                      <label className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-[12.5px] font-medium text-muted-foreground">{fornecedorTravado ? "Fornecedor escolhido pela obra" : "Escolher a empresa"}</span>
                        <select name="cotacao" className="campo" defaultValue={cotacoes.find((q) => q.escolhida)?.id ?? ""}>
                          <option value="" disabled>Escolha</option>
                          {opcoes.map((q) => <option key={q.id} value={q.id}>{q.fornecedor} · {formatarReais(Number(q.valor))}</option>)}
                        </select>
                      </label>
                      <CampoTexto nome="valor" rotulo="Valor final (R$)" padrao={c.valor_negociado ? String(c.valor_negociado).replace(".", ",") : null} />
                    </div>
                  </Formulario>
                )}
                {sel.etapa === 3 && c.negociacao === "obra" && (
                  <p className="rounded-xl bg-fill px-3.5 py-2.5 text-[13px] text-muted-foreground">Negociação pela obra: escolha a empresa e informe o valor final. Se preferir, deixe a negociação para Suprimentos.</p>
                )}
                {sel.etapa === 5 && c.negociacao_pulada && <p className="rounded-xl bg-primary-soft px-3.5 py-2.5 text-[13px]">A obra não negociou. A equalização e a negociação ficam com Suprimentos.</p>}
              </div>
            )}

            {sel.etapa === 9 && sel.situacao !== "pendente" && (
              <div className="flex flex-col gap-2">
                <h3 className="text-[14px] font-semibold">Ordem de assinatura</h3>
                <div className="lista-agrupada">
                  {assinantes.map((a) => (
                    <div key={a.ordem} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                      <span className="grid size-[22px] place-items-center rounded-full bg-fill-2 text-xs font-semibold text-muted-foreground">{a.ordem}</span>
                      <span className="min-w-0 flex-1 text-[14px]">{a.rotulo}</span>
                      {a.assinadoEm ? (
                        <span className="selo selo-ok">Assinado {formatarData(a.assinadoEm).slice(0, 5)}</span>
                      ) : a.ordem === proxAssinante?.ordem && ativa && podeComo(a.papel as Papel) ? (
                        <Formulario acao={assinarContrato.bind(null, id, a.ordem)} textoBotao={a.papel === "contratos" ? "Registrar assinatura" : "Assinar"} className="flex" />
                      ) : (
                        <span className={`selo ${a.ordem === proxAssinante?.ordem ? "selo-alerta" : "selo-neutro"}`}>{a.ordem === proxAssinante?.ordem ? "Aguardando" : "Na fila"}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sel.etapa === 6 && sel.situacao !== "pendente" && (
              <div className="flex flex-col gap-2">
                <h3 className="text-[14px] font-semibold">Condições da contratação</h3>
                {pode ? (
                  <Formulario acao={salvarCondicoesGerente.bind(null, id)} textoBotao="Salvar condições">
                    <CamposCondicoesGerente inicial={c} />
                  </Formulario>
                ) : (
                  <div className="lista-agrupada text-[13.5px]">
                    {[
                      ["Permuta", c.permuta == null ? "—" : c.permuta ? `Sim · ${formatarReais(Number(c.permuta_valor))} · ${c.permuta_formato}` : "Não"],
                      ["Faturamento direto", c.fat_direto == null ? "—" : c.fat_direto ? `Sim · ${formatarReais(Number(c.fat_direto_valor))} · ${String(c.fat_direto_percentual).replace(".", ",")}%` : "Não"],
                      ["Sinal", c.sinal == null ? "—" : c.sinal ? `Sim · ${formatarReais(Number(c.sinal_valor))}` : "Não"],
                      ["Caução", c.caucao == null ? "—" : c.caucao === "na" ? "N.A." : `${c.caucao}%`],
                    ].map(([r, v]) => (
                      <div key={r} className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-muted-foreground">{r}</span><span>{v}</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(sel.etapa === 5 || (sel.etapa === 6 && !c.fornecedor_email && !empresa)) && sel.situacao !== "pendente" && c.fornecedor_cnpj && (
              <div className="flex flex-col gap-2">
                <h3 className="text-[14px] font-semibold">Acesso do fornecedor ao portal</h3>
                {empresa ? (
                  <p className="text-[13px] text-muted-foreground">
                    {c.fornecedor_nome} já está cadastrado como empresa.
                  </p>
                ) : sel.situacao === "em_andamento" && pode ? (
                  <Formulario acao={salvarEmailFornecedor.bind(null, id)} textoBotao="Salvar e-mail" className="flex flex-wrap items-end gap-2">
                    <CampoTexto nome="email" rotulo={`E-mail de ${c.fornecedor_nome ?? "fornecedor"} para o portal`} tipo="email" padrao={c.fornecedor_email} className="min-w-[240px] flex-1" />
                  </Formulario>
                ) : (
                  <p className="text-[13px]"><span className="text-muted-foreground">E-mail para o portal:</span> {c.fornecedor_email ?? "—"}</p>
                )}
                {!empresa && sel.situacao === "em_andamento" && (
                  <p className="text-[12.5px] text-muted-foreground">Com a autorização do gerente, a empresa recebe o convite do portal neste e-mail.</p>
                )}
              </div>
            )}
            {sel.etapa === 10 && empresa && <p className="rounded-xl bg-primary-soft px-3.5 py-2.5 text-[13px]">A situação da equipe vem do portal da empresa (abaixo). O RH confere os documentos em Análise do RH.</p>}

            {ativa && sel.etapa !== 9 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t-[.5px] border-sep pt-4">
                <span className="text-[12.5px] text-muted-foreground">{pode ? "" : `Etapa de ${sel.responsavel}.`}</span>
                <span className="flex flex-wrap gap-2">
                  {sel.pode_pular && pode && c.negociacao === "obra" && <Formulario acao={pularNegociacao.bind(null, id)} textoBotao="Pular: deixar para Suprimentos" variante="neutro" className="flex" />}
                  {pode && sel.itens.length === 0 && <Formulario acao={concluirEtapa.bind(null, id, sel.etapa)} textoBotao={sel.etapa === 6 ? "Autorizar" : "Concluir etapa"} confirmar={sel.etapa === 6 ? "Autorizar esta contratação?" : `Concluir a etapa "${sel.nome}"?`} className="flex" />}
                </span>
              </div>
            )}
            {ehAdmin && (sel.situacao === "concluida" || sel.situacao === "pulada") && c.situacao === "em_andamento" && (
              <Formulario acao={reabrirEtapa.bind(null, id, sel.etapa)} textoBotao="Reabrir etapa" variante="neutro" confirmar="Reabrir esta etapa? O motivo fica registrado na auditoria." className="flex flex-wrap items-center gap-2 border-t-[.5px] border-sep pt-4">
                <input name="motivo" placeholder="Motivo da reabertura" aria-label="Motivo da reabertura" className="campo max-w-[280px] py-1.5" />
              </Formulario>
            )}
          </section>

          {empresa && (
            <section className="painel">
              <div>
                <h2 className="subtitulo">Equipe de {empresa.razao_social}</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">Resumo da empresa (A2). <Link href={`/terceiros/empresas/${empresa.id}`} className="text-primary">Ver documentos da empresa</Link></p>
              </div>
              <ListaEquipe equipe={equipe} fotos={fotos} linkBase="/terceiros/pessoas" />
            </section>
          )}

          {ehAdmin && c.situacao === "em_andamento" && (
            <section className="painel">
              <h2 className="subtitulo">Cancelar contratação</h2>
              <Formulario acao={cancelarContratacao.bind(null, id)} textoBotao="Cancelar contratação" variante="perigo" confirmar="Cancelar esta contratação? Não dá para desfazer." className="flex flex-wrap items-center gap-2">
                <input name="motivo" placeholder="Motivo" aria-label="Motivo do cancelamento" className="campo max-w-[320px] py-1.5" />
              </Formulario>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

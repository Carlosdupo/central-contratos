import type { Metadata } from "next";
import Link from "next/link";
import { exigirInterno } from "@/modules/acesso/sessao";
import { temAlgumPapel } from "@/modules/acesso/papeis";
import { etapasEmAberto, type EtapaAberta } from "@/modules/contratacoes/consultas";
import { assinaturasMinhas, etapaEhMinha } from "@/modules/painel/pendencias";
import { criarClienteServidor } from "@/lib/supabase/server";
import { agoraNoFuso, formatarData, type SituacaoPrazo } from "@/lib/datas";
import { SeloPrazo } from "@/components/app/selo-prazo";
import { ReguaEtapas, type SituacaoEtapa } from "@/components/app/regua-etapas";
import { AbasAreas, type Aba } from "@/components/app/abas-areas";
import { PainelRh } from "@/components/app/painel-rh";
import { PainelSst } from "@/components/app/painel-sst";
import { PainelSuprimentos } from "@/components/app/painel-suprimentos";
import { resumoSuprimentos } from "@/modules/contratacoes/painel-suprimentos";
import { resumoSst } from "@/modules/terceiros/painel-sst";
import { filaDeAnalise, vencimentosProximos, visitasSolicitadas } from "@/modules/terceiros/analise";
import { lerParametros } from "@/lib/configuracao";

export const metadata: Metadata = { title: "Painel" };

// Verbo + objeto do botão de cada etapa (Etapa 13 das instruções: botões dizem a ação).
const ACAO_DA_ETAPA: Record<number, string> = {
  1: "Concluir escopo",
  2: "Abrir cotação",
  3: "Abrir negociação",
  4: "Informar solicitação",
  5: "Validar negociação",
  6: "Autorizar contratação",
  7: "Lançar contrato",
  8: "Aprovar alçada",
  10: "Conferir documentação",
  11: "Registrar integração",
  12: "Liberar equipe",
};

type Tarefa = { chave: string; titulo: string; contexto: string; href: string; acao: string; prazo: SituacaoPrazo; uteis: boolean; urgencia: number };

const URGENCIA: Record<SituacaoPrazo["tipo"], number> = { atrasada: 0, vence_hoje: 1, vence_amanha: 2, no_prazo: 3, sem_prazo: 4 };
const FAIXA: Record<SituacaoPrazo["tipo"], string> = { atrasada: "bg-bad", vence_hoje: "bg-hot", vence_amanha: "bg-warn", no_prazo: "bg-primary", sem_prazo: "bg-primary" };

function saudacao() {
  const hora = Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }));
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

function Kpi({ n, rotulo, tom }: { n: number; rotulo: string; tom?: "hot" | "bad" }) {
  const zero = n === 0;
  return (
    <div className={`flex flex-col gap-1 rounded-[14px] border border-sep px-4 py-3.5 ${zero ? "" : "bg-card"}`}>
      <span className={`font-heading text-[30px] leading-[1.1] tabular-nums ${zero ? "font-medium text-muted-foreground" : tom === "bad" ? "font-semibold text-bad" : tom === "hot" ? "font-semibold text-hot" : "font-semibold"}`}>{n}</span>
      <span className="text-[13px] text-muted-foreground">{rotulo}</span>
    </div>
  );
}

export default async function PaginaPainel({ searchParams }: PageProps<"/painel">) {
  const usuario = await exigirInterno();
  const { minhas: soMinhasParam } = await searchParams;
  const soMinhas = soMinhasParam === "1";
  const supabase = await criarClienteServidor();
  const ehRh = usuario.papeis.includes("rh");
  const ehSst = usuario.papeis.includes("sst");
  const ehSuprimentos = temAlgumPapel(usuario.papeis, ["suprimentos", "gerente_suprimentos"]);

  const [abertas, assinaturas, { data: contratacoes }, rh, sst, supr] = await Promise.all([
    etapasEmAberto(),
    assinaturasMinhas(usuario.papeis),
    supabase
      .from("contratacoes")
      .select("id, codigo, servico, situacao, fornecedor_nome, obras(nome), contratacao_etapas(etapa, situacao)")
      .order("created_at", { ascending: false }),
    ehRh ? Promise.all([filaDeAnalise(), visitasSolicitadas(), vencimentosProximos(30), lerParametros()]).catch(() => null) : Promise.resolve(null),
    ehSst ? resumoSst().catch(() => null) : Promise.resolve(null),
    ehSuprimentos ? resumoSuprimentos().catch(() => null) : Promise.resolve(null),
  ]);

  const minhas = abertas.filter((a) => etapaEhMinha(a, usuario.papeis));
  const comMinhaAcao = new Set([...minhas.map((a) => a.contratacaoId), ...assinaturas.map((a) => a.contratacaoId)]);

  // "O que precisa de você hoje": etapas e assinaturas da pessoa, fila do RH e integrações; os 3 mais urgentes.
  const tarefas: Tarefa[] = [
    ...minhas.map((a) => ({
      chave: `${a.contratacaoId}-${a.etapa.etapa}`,
      titulo: `${ACAO_DA_ETAPA[a.etapa.etapa] ?? "Abrir contratação"} · ${a.codigo}`,
      contexto: `${a.servico} · ${a.obra} · ${a.etapa.nome} · parada há ${a.prazo.usados} ${a.prazo.usados === 1 ? "dia" : "dias"}`,
      href: `/contratacoes/${a.contratacaoId}?etapa=${a.etapa.etapa}`,
      acao: ACAO_DA_ETAPA[a.etapa.etapa] ?? "Abrir contratação",
      prazo: a.prazo,
      uteis: a.uteis,
      urgencia: URGENCIA[a.prazo.tipo],
    })),
    ...assinaturas.map((a) => ({
      chave: `${a.contratacaoId}-ass`,
      titulo: `Assinar contrato · ${a.codigo}`,
      contexto: `${a.servico} · ${a.obra} · assinatura de ${a.rotulo}`,
      href: `/contratacoes/${a.contratacaoId}?etapa=9`,
      acao: "Assinar contrato",
      prazo: a.prazo,
      uteis: a.uteis,
      urgencia: URGENCIA[a.prazo.tipo],
    })),
    ...(rh?.[0] ?? []).map((e) => ({
      chave: `rh-${e.id}`,
      titulo: `Conferir documentos de ${e.pessoa ?? e.empresa}`,
      contexto: `${e.pessoa ? `${e.empresa} · documentos da pessoa` : "Documentos da empresa"} · enviado ${formatarData(e.enviadoEm).slice(0, 5)}`,
      href: `/terceiros/analise/${e.id}`,
      acao: "Conferir documentos",
      prazo: e.prazo,
      uteis: !!rh?.[3].prazoAnaliseRh.uteis,
      urgencia: URGENCIA[e.prazo.tipo],
    })),
  ].sort((a, b) => a.urgencia - b.urgencia);
  const integracoesHoje = sst ? sst.agendadas.filter((a) => a.data <= sst.hoje).length : 0;
  const hoje = tarefas.slice(0, integracoesHoje > 0 ? 2 : 3);

  const emAndamento = (contratacoes ?? []).filter((c) => c.situacao === "em_andamento");
  const liberadas = (contratacoes ?? []).filter((c) => c.situacao === "liberada").length;
  const comAtraso = new Set(abertas.filter((a) => a.prazo.tipo === "atrasada").map((a) => a.contratacaoId)).size;
  const porContratacao = new Map<string, EtapaAberta[]>();
  for (const a of abertas) porContratacao.set(a.contratacaoId, [...(porContratacao.get(a.contratacaoId) ?? []), a]);
  const lista = emAndamento.filter((c) => !soMinhas || comMinhaAcao.has(c.id));
  const totalPendencias = minhas.length + assinaturas.length + (rh?.[0].length ?? 0) + integracoesHoje;

  const abas: Aba[] = [];
  if (supr) abas.push({ chave: "suprimentos", rotulo: "Suprimentos", contador: supr.fila.length + supr.assinaturas.length, conteudo: <PainelSuprimentos {...supr} ehGerente={usuario.papeis.includes("gerente_suprimentos")} /> });
  if (rh) abas.push({ chave: "rh", rotulo: "RH", contador: rh[0].length, conteudo: <PainelRh fila={rh[0]} visitas={rh[1].length} vencendo={rh[2].vencendo} vencidos={rh[2].vencidos} prazoUteis={rh[3].prazoAnaliseRh.uteis} /> });
  if (sst) abas.push({ chave: "sst", rotulo: "Segurança do trabalho", contador: integracoesHoje, conteudo: <PainelSst {...sst} /> });

  const hojeTexto = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo">{saudacao()}, {usuario.nome.split(" ")[0]}</h1>
          <p className="mt-1 max-w-[60ch] text-muted-foreground">
            <span className="first-letter:uppercase">{hojeTexto}</span>.{" "}
            {totalPendencias === 0 ? "Nada espera por você agora." : totalPendencias === 1 ? "Um item espera por você." : `${totalPendencias} itens esperam por você.`}
          </p>
        </div>
        {usuario.papeis.includes("coordenador_obra") && <Link href="/contratacoes/nova" className="botao botao-primario">Nova contratação</Link>}
      </div>

      {usuario.papeis.length === 0 && (
        <section className="painel">
          <h2 className="subtitulo">Seu usuário ainda não tem perfil</h2>
          <p className="text-[14px] text-muted-foreground">Peça ao administrador para atribuir seus perfis de acesso.</p>
        </section>
      )}

      {(hoje.length > 0 || integracoesHoje > 0) && (
        <section aria-labelledby="hoje-titulo" className="flex flex-col gap-3">
          <h2 id="hoje-titulo" className="subtitulo">O que precisa de você hoje</h2>
          <ul className="flex flex-col gap-3">
            {hoje.map((t) => (
              <li key={t.chave} className="flex flex-wrap items-center gap-3.5 rounded-[14px] border border-sep bg-card px-4 py-3.5">
                <span className={`w-1 self-stretch rounded ${FAIXA[t.prazo.tipo]}`} aria-hidden="true" />
                <span className="min-w-0 flex-[1_1_260px]">
                  <span className="block font-semibold">{t.titulo}</span>
                  <span className="block text-[13px] text-muted-foreground">{t.contexto}</span>
                </span>
                <SeloPrazo prazo={t.prazo} uteis={t.uteis} />
                <Link href={t.href} className="botao botao-primario botao-pequeno">{t.acao}</Link>
              </li>
            ))}
            {integracoesHoje > 0 && (
              <li className="flex flex-wrap items-center gap-3.5 rounded-[14px] border border-sep bg-card px-4 py-3.5">
                <span className="w-1 self-stretch rounded bg-warn" aria-hidden="true" />
                <span className="min-w-0 flex-[1_1_260px]">
                  <span className="block font-semibold">{integracoesHoje === 1 ? "1 pessoa aguarda" : `${integracoesHoje} pessoas aguardam`} a integração de hoje</span>
                  <span className="block text-[13px] text-muted-foreground">Marque a presença para liberar a pessoa para a obra.</span>
                </span>
                <span className="selo selo-alerta">Hoje</span>
                <Link href="/terceiros/integracao" className="botao botao-pequeno">Ver lista de integração</Link>
              </li>
            )}
          </ul>
          {tarefas.length > hoje.length && <p className="text-[13px] text-muted-foreground">E mais {tarefas.length - hoje.length} na lista abaixo.</p>}
        </section>
      )}

      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
        <Kpi n={minhas.length + assinaturas.length} rotulo="Contratações que aguardam você" tom="hot" />
        <Kpi n={emAndamento.length} rotulo="Contratações em andamento" />
        <Kpi n={comAtraso} rotulo="Com etapa atrasada" tom="bad" />
        <Kpi n={liberadas} rotulo="Liberadas para a obra" />
      </div>

      <section aria-labelledby="andamento-titulo" className="painel gap-3 p-0 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-[18px]">
          <h2 id="andamento-titulo" className="subtitulo">Contratações em andamento</h2>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar contratações">
            <Link href="/painel" aria-current={!soMinhas ? "true" : undefined} className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] font-medium ${!soMinhas ? "border-foreground bg-foreground text-background" : "border-sep-strong bg-card"}`}>Todas {emAndamento.length}</Link>
            <Link href="/painel?minhas=1" aria-current={soMinhas ? "true" : undefined} className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] font-medium ${soMinhas ? "border-foreground bg-foreground text-background" : "border-sep-strong bg-card"}`}>Só minhas {comMinhaAcao.size}</Link>
            <Link href="/contratacoes/panorama" className="px-1 text-[13px] font-semibold text-primary">Ver panorama</Link>
          </div>
        </div>
        {lista.length === 0 ? (
          <p className="px-[18px] pb-5 text-[14px] text-muted-foreground">
            {soMinhas ? "Nenhuma contratação aguarda você agora." : "Nenhuma contratação em andamento. Novas contratações são abertas pelo coordenador da obra."}
          </p>
        ) : (
          <ul>
            {lista.map((c) => {
              const situacoes: SituacaoEtapa[] = Array.from({ length: 12 }, (_, i) => (c.contratacao_etapas.find((e) => e.etapa === i + 1)?.situacao ?? "pendente") as SituacaoEtapa);
              const atuais = (porContratacao.get(c.id) ?? []).sort((a, b) => a.etapa.etapa - b.etapa.etapa);
              const principal = [...atuais].sort((a, b) => URGENCIA[a.prazo.tipo] - URGENCIA[b.prazo.tipo])[0];
              const texto = atuais.length
                ? `Etapa ${atuais[0].etapa.etapa} de 12 · ${atuais[0].etapa.nome}${atuais.length > 1 ? ` (e mais ${atuais.length - 1} em paralelo)` : ""}`
                : "Etapas concluídas";
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 border-t border-sep px-[18px] py-3">
                  <div className="min-w-0 flex-[1_1_240px]">
                    <Link href={`/contratacoes/${c.id}`} className="line-clamp-2 font-semibold hover:text-primary">{c.servico}</Link>
                    <span className="block text-[13px] text-muted-foreground">
                      <span className="font-mono">{c.codigo}</span> · {c.obras?.nome}{c.fornecedor_nome ? ` · ${c.fornecedor_nome}` : ""}
                      {atuais.length > 0 && ` · com ${[...new Set(atuais.map((a) => a.etapa.responsavel))].join(" e ")}`}
                    </span>
                    <ReguaEtapas situacoes={situacoes} texto={texto} />
                  </div>
                  <span className="flex flex-wrap items-center gap-2">
                    {comMinhaAcao.has(c.id) && <span className="selo selo-urgente">Aguarda você</span>}
                    {principal && <SeloPrazo prazo={principal.prazo} uteis={principal.uteis} />}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {abas.length > 0 && (
        <section aria-labelledby="areas-titulo" className="flex flex-col gap-3">
          <h2 id="areas-titulo" className="subtitulo">{abas.length > 1 ? "Suas áreas" : abas[0].rotulo}</h2>
          <AbasAreas abas={abas} />
        </section>
      )}
      <p className="sr-only">Atualizado em {formatarData(agoraNoFuso().data)}.</p>
    </>
  );
}

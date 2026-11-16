import "server-only";
import { codigoExibicao } from "@/lib/sienge";
import { criarClienteServidor } from "@/lib/supabase/server";
import { agoraNoFuso, formatarData, situacaoPrazo, type Prazo } from "@/lib/datas";
import { carregarFeriados } from "@/lib/configuracao";
import { resumoDaEquipePorObra } from "@/lib/equipe-obra";
import { areaDoPapel, type ContratacaoPanorama, type PassoPanorama } from "@/lib/panorama";
import { carregarFluxos } from "@/modules/contratacoes/consultas";

const LIMITE = 500;

type LinhaEscopo = { matriz_contratacao: { id: string; atividade: string; forma_legal: string; ordem: number } | null };
const escopoDe = (rotulo: string | null, linhas: LinhaEscopo[]): ContratacaoPanorama["escopo"] => {
  const atividades = linhas
    .flatMap((l) => (l.matriz_contratacao ? [l.matriz_contratacao] : []))
    .sort((a, b) => a.ordem - b.ordem)
    .map((m) => ({ id: m.id, atividade: m.atividade, formaLegal: m.forma_legal }));
  return atividades.length > 1 ? { rotulo, atividades } : null;
};
const dataDe = (instante: string) => agoraNoFuso(new Date(instante)).data;

/**
 * Panorama das obras numa consulta só: contratações das obras que a pessoa vê (a RLS limita), com etapas, devoluções e obra.
 * Mostra as 500 mais recentes; se a lista crescer além disso, o próximo passo é paginar por obra.
 */
export async function panoramaDasObras(): Promise<ContratacaoPanorama[]> {
  const supabase = await criarClienteServidor();
  const [{ data }, fluxos, feriados] = await Promise.all([
    supabase
      .from("contratacoes")
      .select(
        "id, codigo, created_at, servico, pacote, situacao, urgente, urgente_data, urgente_motivo, fora_do_prazo, contrato_original, tipo, fornecedor_nome, valor_negociado, sienge_contrato, sienge_solicitacao, cancelamento_motivo, empresa_ja_liberada, prazos, fluxo_versao, obra_id, obras(nome, prefixo_sienge), empresas_terceiras(vinculos(tipo, ativo, alocacoes(obra_id, situacao))), contratacao_etapas(etapa, situacao, iniciada_em, concluida_em), contratacao_atividades(matriz_contratacao(id, atividade, forma_legal, ordem)), contratacao_devolucoes(tipo, para_etapa, motivo, em, usuarios:por(nome))",
      )
      .order("created_at", { ascending: false })
      .limit(LIMITE),
    carregarFluxos(),
    carregarFeriados(),
  ]);
  const hoje = agoraNoFuso().data;

  return (data ?? []).map((c) => {
    const fluxo = fluxos.get(c.fluxo_versao) ?? fluxos.get(1) ?? [];
    const linhas = new Map(c.contratacao_etapas.map((e) => [e.etapa, e]));
    const passos: PassoPanorama[] = fluxo
      .filter((f) => linhas.has(f.etapa))
      .map((f) => {
        const e = linhas.get(f.etapa)!;
        const prazoConfig = ((c.prazos as Record<string, Prazo | undefined> | null)?.[String(f.etapa)] ?? null) as Prazo | null;
        const prazo =
          e.situacao === "em_andamento" && e.iniciada_em
            ? situacaoPrazo({ inicio: dataDe(e.iniciada_em), hoje, prazo: prazoConfig, feriados })
            : null;
        return {
          etapa: f.etapa,
          chave: f.chave,
          nome: f.nome,
          area: areaDoPapel(f.papel),
          responsavel: f.responsavel,
          situacao: e.situacao,
          concluidaEm: e.concluida_em ? dataDe(e.concluida_em) : null,
          prazo: prazo ? { tipo: prazo.tipo, restantes: "restantes" in prazo ? prazo.restantes : null, uteis: !!prazoConfig?.uteis } : null,
        };
      });
    // Devolução ainda valendo: a última cuja etapa de destino está em andamento desde então.
    const ultima = [...c.contratacao_devolucoes]
      .filter((d) => d.tipo === "devolucao" && linhas.get(d.para_etapa)?.situacao === "em_andamento")
      .sort((a, b) => a.em.localeCompare(b.em))
      .at(-1);
    return {
      id: c.id,
      codigo: codigoExibicao(c),
      codigoInterno: c.codigo,
      servico: c.servico,
      obraId: c.obra_id,
      obra: c.obras?.nome ?? "—",
      prefixoSienge: c.obras?.prefixo_sienge ?? null,
      situacao: c.situacao,
      urgente: c.urgente,
      urgenteData: c.urgente_data,
      urgenteMotivo: c.urgente_motivo,
      aditivoDe: c.tipo === "aditivo" ? c.contrato_original : null,
      foraDoPrazo: c.fora_do_prazo,
      abertaEm: dataDe(c.created_at),
      fornecedor: c.fornecedor_nome,
      valor: c.valor_negociado == null ? null : Number(c.valor_negociado),
      sienge: c.sienge_contrato,
      motivoCancelamento: c.cancelamento_motivo,
      empresaJaLiberada: c.empresa_ja_liberada,
      escopo: escopoDe(c.pacote, c.contratacao_atividades),
      equipe: c.empresas_terceiras ? resumoDaEquipePorObra(c.empresas_terceiras.vinculos ?? [], c.obra_id) : null,
      devolucao: ultima ? `${(ultima.usuarios as { nome: string } | null)?.nome ?? "Alguém"} devolveu a etapa em ${formatarData(dataDe(ultima.em)).slice(0, 5)}: ${ultima.motivo}` : null,
      passos,
    };
  });
}

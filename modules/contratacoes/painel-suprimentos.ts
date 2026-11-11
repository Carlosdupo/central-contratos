import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import { etapasEmAberto, panoramaDasContratacoes, type EtapaAberta } from "./consultas";

export type ResumoObra = {
  obraId: string;
  obra: string;
  naObra: number;
  emSuprimentos: number;
  noContrato: number;
  emAssinatura: number;
  naDocumentacao: number;
  liberadas: number;
  atrasadas: number;
};

export type AssinaturaPendente = { contratacaoId: string; codigo: string; servico: string; obra: string; desde: EtapaAberta["desde"]; prazo: EtapaAberta["prazo"]; uteis: boolean };

/** Painel de Suprimentos: a fila (etapas 5 e 6), as assinaturas na vez de Suprimentos e um resumo por obra. */
export async function resumoSuprimentos() {
  const supabase = await criarClienteServidor();
  const [abertas, panorama, { data: assinadas }] = await Promise.all([
    etapasEmAberto(),
    panoramaDasContratacoes(),
    supabase.from("assinaturas").select("contratacao_id, ordem"),
  ]);

  const negociar = abertas.filter((a) => a.etapa.etapa === 5);
  const autorizar = abertas.filter((a) => a.etapa.etapa === 6);
  // Assinatura de Suprimentos é a 2ª da ordem: está na vez quando a 1ª (coordenador) já assinou e a 2ª não.
  const feitas = new Map<string, Set<number>>();
  for (const s of assinadas ?? []) feitas.set(s.contratacao_id, (feitas.get(s.contratacao_id) ?? new Set()).add(s.ordem));
  const assinaturas: AssinaturaPendente[] = abertas
    .filter((a) => a.etapa.etapa === 9 && feitas.get(a.contratacaoId)?.has(1) && !feitas.get(a.contratacaoId)?.has(2))
    .map((a) => ({ contratacaoId: a.contratacaoId, codigo: a.codigo, servico: a.servico, obra: a.obra, desde: a.desde, prazo: a.prazo, uteis: a.uteis }));
  const chegando = new Set(abertas.filter((a) => a.etapa.etapa <= 4).map((a) => a.contratacaoId)).size;

  const porObra = new Map<string, ResumoObra>();
  for (const l of panorama) {
    if (l.situacao === "cancelada") continue;
    const r = porObra.get(l.obraId) ?? { obraId: l.obraId, obra: l.obra, naObra: 0, emSuprimentos: 0, noContrato: 0, emAssinatura: 0, naDocumentacao: 0, liberadas: 0, atrasadas: 0 };
    if (l.situacao === "liberada") r.liberadas++;
    else {
      const [obra, supr, contrato, assin, doc, integ] = l.celulas.map((c) => c.tipo === "andamento");
      if (obra) r.naObra++;
      if (supr) r.emSuprimentos++;
      if (contrato) r.noContrato++;
      if (assin) r.emAssinatura++;
      if (doc || integ) r.naDocumentacao++;
      if (l.atrasada) r.atrasadas++;
    }
    porObra.set(l.obraId, r);
  }

  return {
    fila: [...autorizar, ...negociar],
    negociar: negociar.length,
    autorizar: autorizar.length,
    atrasadas: [...negociar, ...autorizar].filter((a) => a.prazo.tipo === "atrasada").length,
    assinaturas,
    chegando,
    obras: [...porObra.values()].sort((a, b) => a.obra.localeCompare(b.obra)),
  };
}

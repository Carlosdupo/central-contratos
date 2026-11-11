import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import { carregarFeriados, lerParametros } from "@/lib/configuracao";
import { agoraNoFuso, situacaoPrazo, type DataISO, type SituacaoPrazo } from "@/lib/datas";
import { carregarCatalogo } from "./consultas";
import { validadeDoDocumento } from "./dominio/documentos";

export type EnvioNaFila = {
  id: string;
  empresa: string;
  empresaId: string;
  pessoa: string | null;
  enviadoEm: DataISO;
  prazo: SituacaoPrazo;
};

const dataNoFuso = (instante: string): DataISO => agoraNoFuso(new Date(instante)).data;
const ORDEM: Record<string, number> = { atrasada: 0, vence_hoje: 1, vence_amanha: 2, no_prazo: 3, sem_prazo: 4 };

/** Envios esperando o RH, com o prazo (dias úteis com feriados), os mais urgentes primeiro. */
export async function filaDeAnalise(): Promise<EnvioNaFila[]> {
  const supabase = await criarClienteServidor();
  const [{ data, error }, parametros, feriados] = await Promise.all([
    supabase
      .from("envios_analise")
      .select("id, enviado_em, empresa_id, empresas_terceiras(razao_social), vinculos(pessoas(nome))")
      .eq("situacao", "aberto")
      .order("enviado_em"),
    lerParametros(),
    carregarFeriados(),
  ]);
  if (error) throw new Error("Falha ao carregar a fila.");
  const hoje = agoraNoFuso().data;
  return (data ?? [])
    .map((e) => {
      const enviadoEm = dataNoFuso(e.enviado_em);
      return {
        id: e.id,
        empresa: e.empresas_terceiras?.razao_social ?? "—",
        empresaId: e.empresa_id,
        pessoa: e.vinculos?.pessoas?.nome ?? null,
        enviadoEm,
        prazo: situacaoPrazo({ inicio: enviadoEm, hoje, prazo: parametros.prazoAnaliseRh, feriados }),
      };
    })
    .sort((a, b) => ORDEM[a.prazo.tipo] - ORDEM[b.prazo.tipo]);
}

export async function visitasSolicitadas() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("visitas")
    .select("id, data, created_at, obras(nome), vinculos(empresas_terceiras(razao_social), pessoas(nome))")
    .eq("situacao", "solicitada")
    .order("data");
  return (data ?? []).map((v) => ({
    id: v.id,
    data: v.data,
    obra: v.obras?.nome ?? "—",
    empresa: v.vinculos?.empresas_terceiras?.razao_social ?? "—",
    pessoa: v.vinculos?.pessoas?.nome ?? "—",
  }));
}

export async function detalheDoEnvio(envioId: string) {
  const supabase = await criarClienteServidor();
  const [{ data: envio }, { data: itens }, catalogo] = await Promise.all([
    supabase
      .from("envios_analise")
      .select("id, situacao, enviado_em, empresa_id, vinculo_id, empresas_terceiras(razao_social, situacao), vinculos(funcao, pessoas(nome), alocacoes(obras(nome)))")
      .eq("id", envioId)
      .maybeSingle(),
    supabase
      .from("envio_itens")
      .select("id, arquivo_id, decisao, motivo, documentos(tipo_documento, data_emissao, data_validade, competencia, valor_texto)")
      .eq("envio_id", envioId),
    carregarCatalogo(),
  ]);
  if (!envio) return null;
  const linhas = (itens ?? [])
    .map((i) => {
      const doc = i.documentos;
      const tipo = doc ? catalogo.tipos.get(doc.tipo_documento) : undefined;
      return {
        id: i.id,
        arquivoId: i.arquivo_id,
        decisao: i.decisao,
        motivo: i.motivo,
        nome: tipo?.nome ?? doc?.tipo_documento ?? "Documento",
        sensivel: tipo?.sensivel ?? false,
        ordem: tipo?.ordem ?? 999,
        valorTexto: doc?.valor_texto ?? null,
        competencia: doc?.competencia ?? null,
        validade: tipo && doc ? validadeDoDocumento(tipo, doc, catalogo.meses) : null,
      };
    })
    .sort((a, b) => a.ordem - b.ordem);
  return {
    envio,
    itens: linhas,
    empresa: envio.empresas_terceiras?.razao_social ?? "—",
    empresaAprovada: envio.empresas_terceiras?.situacao === "aprovada",
    pessoa: envio.vinculos?.pessoas?.nome ?? null,
    obras: (envio.vinculos?.alocacoes ?? []).map((a) => a.obras?.nome).filter((n): n is string => !!n),
  };
}

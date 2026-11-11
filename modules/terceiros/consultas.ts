import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import { agoraNoFuso, type DataISO } from "@/lib/datas";
import {
  competenciaAtual,
  documentosExigidos,
  estadoDoItem,
  validadeDoDocumento,
  type EstadoItem,
  type ItemMatriz,
  type SituacaoDocumento,
  type TipoDocumento,
  type ValidadeMeses,
} from "./dominio/documentos";

// Consultas com o cliente do usuário: a RLS decide o que cada um enxerga.

export async function carregarCatalogo() {
  const supabase = await criarClienteServidor();
  const [tipos, matriz, validade] = await Promise.all([
    supabase.from("tipos_documento").select("codigo, nome, regra_validade, chave_validade, sensivel, aceita_texto, observacao, ordem").eq("ativo", true).order("ordem"),
    supabase.from("matriz_documental").select("tipo_documento, aplica_a, condicao").eq("ativo", true),
    supabase.from("parametros").select("valor").eq("chave", "validade_documentos_meses").maybeSingle(),
  ]);
  if (tipos.error || matriz.error || validade.error) throw new Error("Falha ao carregar o catálogo de documentos.");
  return {
    tipos: new Map((tipos.data as TipoDocumento[]).map((t) => [t.codigo, t])),
    matriz: matriz.data as ItemMatriz[],
    meses: (validade.data?.valor ?? { aso: 12, nr: 24, rg_cnh: 120 }) as ValidadeMeses,
  };
}

export type ItemDocumentoEmpresa = {
  tipo: TipoDocumento;
  estado: EstadoItem;
  documentoId: string | null;
  arquivoId: string | null;
  validade: DataISO | null;
  competencia: DataISO | null;
  valorTexto: string | null;
  motivo: string | null;
};

/** Documentos exigidos da empresa com a situação de cada um. */
export async function documentosDaEmpresa(empresaId: string): Promise<{ itens: ItemDocumentoEmpresa[]; hoje: DataISO; competencia: DataISO }> {
  const supabase = await criarClienteServidor();
  const hoje = agoraNoFuso().data;
  const competencia = competenciaAtual(hoje);
  const [catalogo, { data: docs, error }] = await Promise.all([
    carregarCatalogo(),
    supabase
      .from("documentos")
      .select("id, tipo_documento, competencia, situacao, data_emissao, data_validade, valor_texto, arquivo_atual_id, motivo_reprovacao")
      .eq("empresa_id", empresaId)
      .is("vinculo_id", null),
  ]);
  if (error) throw new Error("Falha ao carregar os documentos.");

  const exigidos = documentosExigidos(catalogo.matriz, "empresa", { pessoasNaObra: await pessoasNaObraDaEmpresa(empresaId) });
  const itens = exigidos
    .map((codigo) => catalogo.tipos.get(codigo))
    .filter((t): t is TipoDocumento => !!t)
    .map((tipo) => {
      const doc = (docs ?? []).find((d) => d.tipo_documento === tipo.codigo && (tipo.regra_validade !== "mensal" || d.competencia === competencia));
      const validade = doc ? validadeDoDocumento(tipo, doc, catalogo.meses) : null;
      return {
        tipo,
        estado: estadoDoItem(doc ? { situacao: doc.situacao as SituacaoDocumento, validade } : undefined, hoje),
        documentoId: doc?.id ?? null,
        arquivoId: doc?.arquivo_atual_id ?? null,
        validade,
        competencia: tipo.regra_validade === "mensal" ? competencia : null,
        valorTexto: doc?.valor_texto ?? null,
        motivo: doc?.motivo_reprovacao ?? null,
      };
    });
  return { itens, hoje, competencia };
}

// Equipe (F2) ---------------------------------------------------------------------------------

export type ItemDocumentoPessoa = Omit<ItemDocumentoEmpresa, "competencia" | "valorTexto">;

/** Documentos exigidos de uma pessoa (pela matriz, conforme tipo e eletricidade), com a situação de cada um. */
export async function documentosDoVinculo(vinculoId: string) {
  const supabase = await criarClienteServidor();
  const hoje = agoraNoFuso().data;
  const [catalogo, { data: vinculo }, { data: docs, error }] = await Promise.all([
    carregarCatalogo(),
    supabase.from("vinculos").select("id, tipo, eletricidade, empresa_id").eq("id", vinculoId).maybeSingle(),
    supabase
      .from("documentos")
      .select("id, tipo_documento, situacao, data_emissao, data_validade, arquivo_atual_id, motivo_reprovacao")
      .eq("vinculo_id", vinculoId),
  ]);
  if (error) throw new Error("Falha ao carregar os documentos.");
  if (!vinculo) return null;
  if (vinculo.tipo === "socio_esporadico") return { vinculo, itens: [] as ItemDocumentoPessoa[], hoje };

  const exigidos = documentosExigidos(catalogo.matriz, vinculo.tipo, { eletricidade: vinculo.eletricidade });
  const itens: ItemDocumentoPessoa[] = exigidos
    .map((codigo) => catalogo.tipos.get(codigo))
    .filter((t): t is TipoDocumento => !!t)
    .map((tipo) => {
      const doc = (docs ?? []).find((d) => d.tipo_documento === tipo.codigo);
      const validade = doc ? validadeDoDocumento(tipo, doc, catalogo.meses) : null;
      return {
        tipo,
        estado: estadoDoItem(doc ? { situacao: doc.situacao as SituacaoDocumento, validade } : undefined, hoje),
        documentoId: doc?.id ?? null,
        arquivoId: doc?.arquivo_atual_id ?? null,
        validade,
        motivo: doc?.motivo_reprovacao ?? null,
      };
    });
  return { vinculo, itens, hoje };
}

export type MembroEquipe = {
  vinculoId: string;
  pessoaId: string;
  nome: string;
  tipo: "funcionario" | "socio_diario" | "socio_esporadico";
  funcao: string;
  fotoPath: string | null;
  alocacoes: { obra: string; situacao: string; integracaoData: string | null }[];
};

export async function equipeDaEmpresa(empresaId: string): Promise<MembroEquipe[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("vinculos")
    .select("id, tipo, funcao, pessoas(id, nome, foto_path), alocacoes(situacao, integracao_data, obras(nome))")
    .eq("empresa_id", empresaId)
    .eq("ativo", true);
  if (error) throw new Error("Falha ao carregar a equipe.");
  return (data ?? [])
    .map((v) => ({
      vinculoId: v.id,
      pessoaId: v.pessoas?.id ?? "",
      nome: v.pessoas?.nome ?? "—",
      fotoPath: v.pessoas?.foto_path ?? null,
      tipo: v.tipo,
      funcao: v.funcao,
      alocacoes: (v.alocacoes ?? []).map((a) => ({ obra: a.obras?.nome ?? "—", situacao: a.situacao, integracaoData: a.integracao_data })),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Pessoas que contam para a regra da CIPA (todas as alocadas, exceto sócio esporádico). P10 pendente: por obra ou total. */
export async function pessoasNaObraDaEmpresa(empresaId: string): Promise<number> {
  const supabase = await criarClienteServidor();
  const { count } = await supabase
    .from("vinculos")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .neq("tipo", "socio_esporadico");
  return count ?? 0;
}

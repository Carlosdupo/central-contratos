"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirInterno } from "@/modules/acesso/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";
import { decodificarCsv } from "@/lib/csv";
import { lerCronograma, lerData, lerPlanilha } from "@/lib/planilha";

// Calendário e planilhas de Suprimentos. Quem pode o quê é conferido no banco (gerente define o calendário;
// Suprimentos importa e edita a planilha; administrador ou gerente importa o cronograma).

const uuid = z.uuid();
const LIMITE_ARQUIVO = 1.5 * 1024 * 1024;

async function lerArquivoCsv(dados: FormData, campo: string): Promise<{ texto: string } | { erro: string }> {
  const arquivo = dados.get(campo);
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha o arquivo CSV." };
  if (arquivo.size > LIMITE_ARQUIVO) return { erro: "Arquivo grande demais (até 1,5 MB)." };
  const nome = arquivo.name.toLowerCase();
  if (!/\.(csv|txt)$/.test(nome) || /\.(xlsx?|ods)$/.test(nome)) return { erro: "Salve a planilha como CSV no Excel (Arquivo > Salvar como > CSV) e envie o arquivo .csv." };
  if (arquivo.type && !/^(text\/|application\/(vnd\.ms-excel|csv))/.test(arquivo.type)) return { erro: "O arquivo não parece ser um CSV." };
  return { texto: decodificarCsv(await arquivo.arrayBuffer()) };
}

export async function salvarCalendario(ano: number, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!Number.isInteger(ano)) return { erro: "Ano inválido." };
  const ciclos: { mes: number; ciclo: number; limite: string; inicio: string }[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    for (const ciclo of [1, 2]) {
      const limite = lerData(String(dados.get(`limite_${mes}_${ciclo}`) ?? ""));
      const inicio = lerData(String(dados.get(`inicio_${mes}_${ciclo}`) ?? ""));
      if (limite === undefined || inicio === undefined) return { erro: `Confira as datas de ${mes}/${ano}, ciclo ${ciclo}.` };
      if (!limite && !inicio) continue;
      if (!limite || !inicio) return { erro: `Preencha o limite e o início de ${mes}/${ano}, ciclo ${ciclo}.` };
      ciclos.push({ mes, ciclo, limite, inicio });
    }
  }
  if (ciclos.length === 0) return { erro: "Preencha pelo menos um ciclo." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("salvar_calendario", { p_ano: ano, p_ciclos: ciclos });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível salvar o calendário.") };
  revalidatePath("/apoio/calendario");
  revalidatePath("/contratacoes/nova");
  return { ok: `Calendário de ${ano} salvo: ${data} ciclos.` };
}

export async function importarPlanilha(obra: string, tipo: "MO" | "MAT", _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(obra).success || (tipo !== "MO" && tipo !== "MAT")) return { erro: "Dados inválidos." };
  const arquivo = await lerArquivoCsv(dados, "arquivo");
  if ("erro" in arquivo) return arquivo;
  const lida = lerPlanilha(arquivo.texto);
  if (lida.erro) return { erro: lida.erro };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("importar_planejamento", { p_obra: obra, p_tipo: tipo, p_itens: lida.itens });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível importar a planilha.") };
  revalidatePath(`/apoio/planilha/${tipo.toLowerCase()}`);
  return { ok: `${data} itens importados. Itens que já têm contratação foram mantidos.` };
}

export async function importarCronograma(obra: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(obra).success) return { erro: "Dados inválidos." };
  const arquivo = await lerArquivoCsv(dados, "arquivo");
  if ("erro" in arquivo) return arquivo;
  const lido = lerCronograma(arquivo.texto);
  if (lido.erro) return { erro: lido.erro };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("importar_cronograma", { p_obra: obra, p_pacotes: lido.pacotes });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível importar o cronograma.") };
  revalidatePath("/apoio/planilha", "layout");
  revalidatePath(`/admin/obras/${obra}`);
  return { ok: `Cronograma importado: ${data} pacotes. As datas da planilha foram recalculadas.` };
}

const numeroOuNulo = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : /^\d{1,4}$/.test(t) ? Number(t) : NaN;
};

export async function editarItemPlanejamento(id: string, tipo: "MO" | "MAT", _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(id).success) return { erro: "Dados inválidos." };
  const compras = numeroOuNulo(dados.get("prazo_compras"));
  const chegada = numeroOuNulo(dados.get("prazo_chegada"));
  if (Number.isNaN(compras) || Number.isNaN(chegada)) return { erro: "Os prazos são números de dias (0 a 9999)." };
  const inicio = lerData(String(dados.get("inicio") ?? ""));
  if (inicio === undefined) return { erro: "Data de início inválida." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("editar_planejamento_item", {
    p_id: id,
    p_responsavel: String(dados.get("responsavel") ?? "").trim().slice(0, 120),
    p_prazo_compras: compras as number,
    p_prazo_chegada: chegada as number,
    p_inicio_manual: inicio as string,
    p_observacao: String(dados.get("observacao") ?? "").trim().slice(0, 500),
  });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível salvar.") };
  revalidatePath(`/apoio/planilha/${tipo.toLowerCase()}`);
  return { ok: "Item salvo." };
}

"use server";

import { revalidatePath } from "next/cache";
import { exigirInterno } from "@/modules/acesso/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";
import type { PacoteDeAvisos } from "./avisos-tipos";

// Avisos internos da pessoa logada. A leitura é limitada pela RLS: cada pessoa só lê os próprios avisos.
export async function carregarAvisos(): Promise<PacoteDeAvisos> {
  const usuario = await exigirInterno();
  const supabase = await criarClienteServidor();
  const [{ data: avisos }, { count }, { data: pref }] = await Promise.all([
    supabase.from("avisos_internos").select("id, tipo, titulo, texto, contratacao_id, criado_em, lido_em").order("criado_em", { ascending: false }).limit(20),
    supabase.from("avisos_internos").select("id", { count: "exact", head: true }).is("lido_em", null),
    supabase.from("preferencias_aviso").select("som, email").eq("usuario_id", usuario.id).maybeSingle(),
  ]);
  return {
    avisos: (avisos ?? []).map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo, texto: a.texto, contratacaoId: a.contratacao_id, criadoEm: a.criado_em, lido: !!a.lido_em })),
    naoLidos: count ?? 0,
    preferencias: { som: pref?.som ?? true, email: pref?.email ?? true },
  };
}

export async function marcarAvisosLidos(): Promise<EstadoFormulario> {
  await exigirInterno();
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("marcar_avisos_lidos");
  if (error) return { erro: mensagemDeErro(error, "Não foi possível marcar como lidos.") };
  revalidatePath("/", "layout");
  return { ok: "Avisos marcados como lidos." };
}

export async function salvarPreferenciasAviso(som: boolean, email: boolean): Promise<EstadoFormulario> {
  await exigirInterno();
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("salvar_preferencias_aviso", { p_som: som, p_email: email });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível salvar a preferência.") };
  return { ok: "Preferência salva." };
}

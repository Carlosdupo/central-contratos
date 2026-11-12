"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPapel } from "@/modules/acesso/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { carregarFeriados } from "@/lib/configuracao";
import { agoraNoFuso, formatarData, proximoDiaUtil } from "@/lib/datas";
import { envPublico } from "@/lib/env";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";
import { despacharPendentes } from "@/modules/notificacoes/enviar";

// Integração de segurança: só SST (exigirPapel exige a verificação em duas etapas; o banco confere de novo).
export async function registrarIntegracao(alocacaoId: string, presente: boolean): Promise<EstadoFormulario> {
  await exigirPapel("sst");
  if (!z.uuid().safeParse(alocacaoId).success) return { erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: a } = await supabase
    .from("alocacoes")
    .select("integracao_data, obras(nome), vinculos(pessoas(nome))")
    .eq("id", alocacaoId)
    .maybeSingle();
  if (!a) return { erro: "Pessoa não encontrada." };

  const pessoa = a.vinculos?.pessoas?.nome ?? "A pessoa";
  const obra = a.obras?.nome ?? "a obra";
  const hoje = agoraNoFuso().data;
  // Falta: remarca para o próximo dia útil depois de hoje (ou da data marcada, se ainda for futura).
  const base = a.integracao_data && a.integracao_data > hoje ? a.integracao_data : hoje;
  const novaData = presente ? null : proximoDiaUtil(base, await carregarFeriados());
  const assunto = presente ? `${pessoa} liberado(a) para a obra` : `${pessoa} não compareceu à integração`;
  const texto = presente
    ? `${pessoa} fez a integração de segurança e está liberado(a) para entrar na obra ${obra}.`
    : `${pessoa} não compareceu à integração de segurança. Nova data: ${formatarData(novaData!)}.`;

  const { error } = await supabase.rpc("registrar_integracao", {
    p_alocacao: alocacaoId,
    p_presente: presente,
    p_nova_data: novaData ?? hoje, // ignorada quando presente
    p_assunto: assunto,
    p_texto: `${texto}\n\nAcesse o portal: ${envPublico.NEXT_PUBLIC_SITE_URL}/portal\n\nNexo`,
  });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível registrar.") };
  after(() => despacharPendentes(5).catch(() => undefined)); // depois da resposta: não faz o usuário esperar o e-mail
  revalidatePath("/terceiros/integracao");
  return { ok: presente ? `${pessoa} liberado(a).` : `Remarcado para ${formatarData(novaData!)}.` };
}

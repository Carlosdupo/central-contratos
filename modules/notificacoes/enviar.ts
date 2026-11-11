import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { envServidor } from "@/lib/env.server";

const MAX_TENTATIVAS = 5;

export const emailConfigurado = (): boolean => !!(envServidor.RESEND_API_KEY && envServidor.EMAIL_REMETENTE);

/**
 * Envia os avisos pendentes da fila pelo Resend. Chamado logo depois de enfileirar (melhor esforço)
 * e pela tarefa agendada (/api/cron/notificacoes), que repete os que falharam.
 * Sem RESEND_API_KEY/EMAIL_REMETENTE, não faz nada: os avisos continuam visíveis nas telas.
 */
export async function despacharPendentes(limite = 20): Promise<{ configurado: boolean; enviadas: number; erros: number }> {
  if (!emailConfigurado()) return { configurado: false, enviadas: 0, erros: 0 };
  const admin = criarClienteAdmin();
  const { data: fila } = await admin
    .from("notificacoes")
    .select("id, destinatario, assunto, texto, tentativas")
    .in("situacao", ["pendente", "erro"])
    .lt("tentativas", MAX_TENTATIVAS)
    .order("criado_em")
    .limit(limite);

  let enviadas = 0;
  let erros = 0;
  for (const n of fila ?? []) {
    let erro: string | null = null;
    try {
      const resposta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${envServidor.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: envServidor.EMAIL_REMETENTE, to: [n.destinatario], subject: n.assunto, text: n.texto }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!resposta.ok) erro = `HTTP ${resposta.status}`;
    } catch (e) {
      erro = e instanceof Error ? e.message.slice(0, 200) : "falha de rede";
    }
    await admin
      .from("notificacoes")
      .update(erro ? { situacao: "erro", erro, tentativas: n.tentativas + 1 } : { situacao: "enviada", erro: null, tentativas: n.tentativas + 1, enviado_em: new Date().toISOString() })
      .eq("id", n.id);
    if (erro) erros++;
    else enviadas++;
  }
  return { configurado: true, enviadas, erros };
}

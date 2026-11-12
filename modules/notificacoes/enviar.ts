import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { envServidor } from "@/lib/env.server";

const MAX_TENTATIVAS = 5;
const ENVIOS_EM_PARALELO = 5;

export const emailConfigurado = (): boolean => !!(envServidor.RESEND_API_KEY && envServidor.EMAIL_REMETENTE);

type Aviso = { id: string; destinatario: string; assunto: string; texto: string };

async function enviarPeloResend(aviso: Aviso): Promise<string | null> {
  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${envServidor.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        // Se a gravação do resultado falhar e o aviso voltar à fila, o Resend reconhece o mesmo envio e não duplica.
        "Idempotency-Key": `notificacao-${aviso.id}`,
      },
      body: JSON.stringify({ from: envServidor.EMAIL_REMETENTE, to: [aviso.destinatario], subject: aviso.assunto, text: aviso.texto }),
      signal: AbortSignal.timeout(10_000),
    });
    return resposta.ok ? null : `HTTP ${resposta.status}`;
  } catch (e) {
    return e instanceof Error ? e.message.slice(0, 200) : "falha de rede";
  }
}

/**
 * Envia os avisos pendentes da fila pelo Resend. Chamado logo depois de enfileirar (melhor esforço)
 * e pela tarefa agendada (/api/cron/notificacoes), que repete os que falharam.
 * Os avisos são reservados no banco (reservar_notificacoes): dois processos ao mesmo tempo nunca enviam o mesmo.
 * Sem RESEND_API_KEY/EMAIL_REMETENTE, não faz nada: os avisos continuam visíveis nas telas.
 */
export async function despacharPendentes(limite = 20): Promise<{ configurado: boolean; enviadas: number; erros: number }> {
  if (!emailConfigurado()) return { configurado: false, enviadas: 0, erros: 0 };
  const admin = criarClienteAdmin();
  const { data: fila, error } = await admin.rpc("reservar_notificacoes", { p_limite: limite, p_max_tentativas: MAX_TENTATIVAS });
  if (error) {
    console.error("[notificacoes] falha ao reservar a fila:", error.message);
    return { configurado: true, enviadas: 0, erros: 0 };
  }

  let enviadas = 0;
  let erros = 0;
  const avisos = fila ?? [];
  for (let i = 0; i < avisos.length; i += ENVIOS_EM_PARALELO) {
    await Promise.all(
      avisos.slice(i, i + ENVIOS_EM_PARALELO).map(async (aviso) => {
        const erro = await enviarPeloResend(aviso);
        const { error: erroGravacao } = await admin
          .from("notificacoes")
          .update(erro ? { situacao: "erro", erro, reservado_em: null } : { situacao: "enviada", erro: null, enviado_em: new Date().toISOString(), reservado_em: null })
          .eq("id", aviso.id)
          .eq("situacao", "enviando");
        if (erroGravacao) console.error("[notificacoes] falha ao gravar o resultado:", erroGravacao.message);
        if (erro) erros++;
        else enviadas++;
      }),
    );
  }
  return { configurado: true, enviadas, erros };
}

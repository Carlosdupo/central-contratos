import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { envServidor } from "@/lib/env.server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { agoraNoFuso } from "@/lib/datas";
import { despacharPendentes } from "@/modules/notificacoes/enviar";

// Tarefa diária: marca documentos vencidos, bloqueia quem ficou irregular (A5) e enfileira os avisos de 30/15/0 dias.
export async function GET(request: NextRequest) {
  const segredo = envServidor.CRON_SECRET;
  const recebido = request.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;
  const valido = !!segredo && recebido.length === esperado.length && timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
  if (!valido) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const { data, error } = await criarClienteAdmin().rpc("processar_vencimentos", { p_hoje: agoraNoFuso().data });
  if (error) return NextResponse.json({ erro: "falha ao processar vencimentos" }, { status: 500 });
  const envio = await despacharPendentes(50);
  return NextResponse.json({ vencimentos: data, email: envio });
}

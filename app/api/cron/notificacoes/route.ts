import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { envServidor } from "@/lib/env.server";
import { despacharPendentes } from "@/modules/notificacoes/enviar";

// Tarefa agendada (Vercel Cron, vercel.json). A Vercel manda "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: NextRequest) {
  const segredo = envServidor.CRON_SECRET;
  const recebido = request.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;
  const valido = !!segredo && recebido.length === esperado.length && timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
  if (!valido) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const resultado = await despacharPendentes(50);
  return NextResponse.json(resultado);
}

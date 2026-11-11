import type { SituacaoPrazo } from "@/lib/datas";

// Selo de prazo no padrão do protótipo: atrasada, vence hoje, vence amanhã, no prazo.
export function SeloPrazo({ prazo, uteis }: { prazo: SituacaoPrazo; uteis: boolean }) {
  const un = uteis ? "d úteis" : "d";
  if (prazo.tipo === "sem_prazo") return <span className="selo selo-neutro">{prazo.usados} {un} · prazo a definir</span>;
  if (prazo.tipo === "atrasada") return <span className="selo selo-erro">Atrasada {-prazo.restantes} {un}</span>;
  if (prazo.tipo === "vence_hoje") return <span className="selo selo-alerta">Vence hoje</span>;
  if (prazo.tipo === "vence_amanha") return <span className="selo selo-alerta">Vence em 1 {uteis ? "dia útil" : "dia"}</span>;
  return <span className="selo selo-ok">{prazo.restantes} {un} restantes</span>;
}

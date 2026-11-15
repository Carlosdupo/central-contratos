// Calendário de suprimentos: dois ciclos por mês. O pedido entra no primeiro ciclo cujo limite ainda não passou (o banco confere igual).
export type Ciclo = { limite: string; inicio: string };
export type CicloDoAno = Ciclo & { mes: number; ciclo: number };

export function cicloDoPedido(hoje: string, ciclos: Ciclo[]): Ciclo | null {
  return [...ciclos].sort((a, b) => a.limite.localeCompare(b.limite)).find((c) => c.limite >= hoje) ?? null;
}

const dois = (n: number) => String(n).padStart(2, "0");
const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/** Ciclos de um ano a partir de um padrão: o dia-limite de cada um dos dois ciclos, aplicado aos 12 meses. O início é o dia seguinte ao limite. */
export function ciclosDoPadrao(ano: number, diaLimite1: number, diaLimite2: number): CicloDoAno[] {
  return Array.from({ length: 12 }, (_, i) => i + 1).flatMap((mes) =>
    [diaLimite1, diaLimite2].map((dia, k) => {
      const d = Math.min(dia, ultimoDia(ano, mes));
      const seguinte = new Date(Date.UTC(ano, mes - 1, d + 1));
      return { mes, ciclo: k + 1, limite: `${ano}-${dois(mes)}-${dois(d)}`, inicio: `${seguinte.getUTCFullYear()}-${dois(seguinte.getUTCMonth() + 1)}-${dois(seguinte.getUTCDate())}` };
    }),
  );
}

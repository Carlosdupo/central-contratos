export type EventoDaLinha = { id: string; quando: string; texto: string; destaque?: boolean };

const formatar = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Linha do tempo da contratação: abertura, etapas concluídas, devoluções e reaberturas, da mais antiga para a mais nova.
export function LinhaDoTempo({ eventos }: { eventos: EventoDaLinha[] }) {
  return (
    <ol aria-label="Linha do tempo da contratação" className="flex flex-col">
      {eventos.map((e) => (
        <li key={e.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-t-[.5px] border-sep py-2 text-[13px] first:border-t-0">
          <time dateTime={e.quando} className="text-xs text-muted-foreground">{formatar(e.quando)}</time>
          <span className={e.destaque ? "font-medium" : undefined}>{e.texto}</span>
        </li>
      ))}
    </ol>
  );
}

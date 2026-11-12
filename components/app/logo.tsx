// Marca do Nexo. As cores vêm dos tokens (--azul = destaque, --azul-tinta = desenho sobre o destaque).

export function Logo({ tamanho = 34, className }: { tamanho?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={tamanho} height={tamanho} aria-hidden="true" focusable="false" className={`shrink-0 ${className ?? ""}`}>
      <rect width="40" height="40" rx="11" fill="var(--azul)" />
      <path d="M12 28V12M28 28V12M12 12l16 16" fill="none" stroke="var(--azul-tinta)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" fill="var(--azul-tinta)" />
      <circle cx="28" cy="28" r="3" fill="var(--azul-tinta)" />
    </svg>
  );
}

/** Logo + NEXO + subtítulo (versão horizontal). */
export function Marca({ tamanho = 34, subtitulo = true, grande = false }: { tamanho?: number; subtitulo?: boolean; grande?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Logo tamanho={tamanho} />
      <span className="min-w-0 leading-none">
        <span className={`block font-heading font-bold tracking-[.14em] ${grande ? "text-[24px]" : "text-[19px]"}`}>NEXO</span>
        {subtitulo && <span className="mt-1 block truncate text-[11px] font-normal tracking-normal text-muted-foreground">Contratação e liberação de terceiros</span>}
      </span>
    </span>
  );
}

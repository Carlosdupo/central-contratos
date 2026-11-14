// Marca do NEXUS: dois elos entrelaçados (a empresa e a obra) ao lado da palavra NEXUS.
// Cores pelos tokens: --azul = destaque, --azul-tinta = desenho sobre o destaque, currentColor = texto.
// O entrelaçado é feito com um traço da cor do fundo por baixo do elo de cima. Desenho original em docs/marca/.

const ELO_ESQ = "M11 11H17A9 9 0 0 1 17 29H11A9 9 0 0 1 11 11Z";
const ELO_DIR = "M23 11H29A9 9 0 0 1 29 29H23A9 9 0 0 1 23 11Z";
const CRUZA = "M25.3 23.5A9 9 0 0 1 17 29";

// Cores por classe (a CSP do site bloqueia atributo style no HTML do servidor).
function Elos({ traco, corte, esquerdo, direito, fundo }: { traco: number; corte: number; esquerdo: string; direito: string; fundo: string }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={traco}>
      <path d={ELO_ESQ} className={esquerdo} />
      <path d={ELO_DIR} className={fundo} strokeWidth={corte} strokeLinecap="butt" />
      <path d={ELO_DIR} className={direito} />
      <path d={CRUZA} className={fundo} strokeWidth={corte} strokeLinecap="butt" />
      <path d={CRUZA} className={esquerdo} />
    </g>
  );
}

/** Símbolo em quadrado azul (ícone do app, topo do portal). */
export function Logo({ tamanho = 34, className }: { tamanho?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={tamanho} height={tamanho} aria-hidden="true" focusable="false" className={`shrink-0 ${className ?? ""}`}>
      <rect width="40" height="40" rx="9" className="fill-[var(--azul)]" />
      <g transform="translate(5 5) scale(0.75)">
        <Elos
          traco={4.4}
          corte={9}
          esquerdo="stroke-[var(--azul-tinta)]"
          direito="stroke-[color-mix(in_srgb,var(--azul-tinta)_65%,var(--azul))]"
          fundo="stroke-[var(--azul)]"
        />
      </g>
    </svg>
  );
}

/** Elos + NEXUS (versão horizontal), sempre sobre o fundo --superficie (cartão, menu, telas de acesso).
 *  `altura` é a altura das letras em px, com folga do traço. */
export function Marca({ altura = 22, subtitulo = true }: { altura?: number; subtitulo?: boolean }) {
  return (
    <span className="flex min-w-0 flex-col gap-1.5 leading-none">
      <svg viewBox="0 0 270 40" height={altura} width={(altura * 270) / 40} role="img" aria-label="NEXUS" focusable="false" className="shrink-0">
        <g transform="translate(-1.25 -15) scale(1.75)">
          <Elos traco={2.57} corte={5.6} esquerdo="stroke-current" direito="stroke-[var(--azul)]" fundo="stroke-[var(--superficie)]" />
        </g>
        <g transform="translate(80 0)" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 36V4L30 36V4" />
          <path d="M64 4H42V36H64M42 20H60" />
          <path d="M78 4L106 36M106 4L78 36" />
          <path d="M120 4V23A13 13 0 0 0 146 23V4" />
          <path d="M186 4H168A8 8 0 0 0 168 20H178A8 8 0 0 1 178 36H160" />
        </g>
      </svg>
      {subtitulo && <span className="block truncate text-[11px] font-normal tracking-normal text-muted-foreground">Contratação e liberação de terceiros</span>}
    </span>
  );
}

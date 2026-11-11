import type { ReactNode } from "react";

function Icone({ children, tamanho = 18 }: { children: ReactNode; tamanho?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconePainel = () => (
  <Icone>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Icone>
);

export const IconeAdmin = () => (
  <Icone>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icone>
);

export const IconeEmpresas = () => (
  <Icone>
    <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
    <path d="M9 7.5V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3.5 12.5h17" />
  </Icone>
);

export const IconeBusca = () => (
  <Icone>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Icone>
);

export const IconeAnalise = () => (
  <Icone>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4.5V3h6v1.5M8.5 11l1.5 1.5 3-3M8.5 16.5h7" />
  </Icone>
);

export const IconeIntegracao = () => (
  <Icone>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4M8.5 14.5l2 2 4-4" />
  </Icone>
);

export const IconeApp = () => (
  <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#3d9bff] to-[#0062d6] text-white shadow-[inset_0_0_0_.5px_rgba(0,0,0,.15),0_2px_6px_rgba(0,98,214,.3)]">
    <Icone tamanho={20}>
      <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9.5 14.5l2 2 3.5-4" />
    </Icone>
  </span>
);

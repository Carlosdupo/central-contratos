"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/admin/usuarios", rotulo: "Usuários" },
  { href: "/admin/obras", rotulo: "Obras" },
  { href: "/admin/parametros", rotulo: "Parâmetros" },
  { href: "/admin/feriados", rotulo: "Feriados" },
  { href: "/admin/auditoria", rotulo: "Auditoria" },
];

export function AbasAdmin() {
  const caminho = usePathname();
  return (
    <nav aria-label="Seções da administração" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-fill-2 p-1">
      {ABAS.map((a) => {
        const ativa = caminho === a.href || caminho.startsWith(`${a.href}/`);
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-[13.5px] font-medium whitespace-nowrap transition-colors ${
              ativa ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

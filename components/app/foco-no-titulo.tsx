"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Ao trocar de página, leva o foco ao título (h1) da nova página, para o leitor de tela anunciar onde a pessoa está.
// Na primeira carga não mexe no foco.
export function FocoNoTitulo() {
  const caminho = usePathname();
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const titulo = document.querySelector<HTMLElement>("#conteudo h1");
    if (!titulo) return;
    if (!titulo.hasAttribute("tabindex")) titulo.setAttribute("tabindex", "-1");
    titulo.focus({ preventScroll: true });
  }, [caminho]);
  return null;
}

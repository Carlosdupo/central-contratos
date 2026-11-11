"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarItem } from "@/modules/contratacoes/acoes";

// Item do checklist da etapa: marca no servidor (que confere se a etapa é da área de quem marca).
export function ItemChecklist({ contratacao, etapa, item, texto, marcado, editavel }: { contratacao: string; etapa: number; item: number; texto: string; marcado: boolean; editavel: boolean }) {
  const router = useRouter();
  const [valor, setValor] = useState(marcado);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  return (
    <label className={`flex items-center gap-3 px-3.5 py-2.5 ${editavel ? "cursor-pointer hover:bg-fill-2" : ""}`}>
      <input
        type="checkbox"
        checked={valor}
        disabled={!editavel || pendente}
        onChange={(e) => {
          const novo = e.target.checked;
          setValor(novo);
          setErro("");
          iniciar(async () => {
            const r = await marcarItem(contratacao, etapa, item, novo);
            if (r.erro) {
              setValor(!novo);
              setErro(r.erro);
            } else router.refresh();
          });
        }}
        className="size-[20px] accent-primary"
      />
      <span className="text-[14px]">
        {texto}
        {erro && <span className="block text-xs text-bad">{erro}</span>}
      </span>
    </label>
  );
}

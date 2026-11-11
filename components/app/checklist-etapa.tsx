"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarItem } from "@/modules/contratacoes/acoes";
import { Formulario } from "@/components/app/formulario";
import type { EstadoFormulario } from "@/lib/formulario";

type Props = {
  contratacao: string;
  etapa: number;
  itens: readonly string[];
  marcados: boolean[];
  editavel: boolean;
  concluir: ((estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>) | null;
  textoBotao: string;
};

// Itens da etapa (começam desmarcados) e o botão de concluir no mesmo bloco:
// o botão só libera com tudo marcado e gravado, então não há "Marque todos os itens" por corrida.
export function ChecklistEtapa({ contratacao, etapa, itens, marcados, editavel, concluir, textoBotao }: Props) {
  const router = useRouter();
  const [valores, setValores] = useState(marcados);
  const [gravando, setGravando] = useState(0);
  const [erro, setErro] = useState("");
  const [, iniciar] = useTransition();
  const faltam = valores.filter((v) => !v).length;

  const alternar = (i: number, novo: boolean) => {
    setValores((v) => v.map((x, j) => (j === i ? novo : x)));
    setErro("");
    setGravando((n) => n + 1);
    iniciar(async () => {
      const r = await marcarItem(contratacao, etapa, i + 1, novo);
      setGravando((n) => n - 1);
      if (r.erro) {
        setValores((v) => v.map((x, j) => (j === i ? !novo : x)));
        setErro(r.erro);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="lista-agrupada">
        {itens.map((texto, i) => (
          <label key={i} className={`flex items-center gap-3 px-3.5 py-2.5 ${editavel ? "cursor-pointer hover:bg-fill-2" : ""}`}>
            <input
              type="checkbox"
              checked={valores[i]}
              disabled={!editavel}
              onChange={(e) => alternar(i, e.target.checked)}
              className="size-[20px] shrink-0 accent-primary"
            />
            <span className={`text-[14px] ${valores[i] ? "text-muted-foreground line-through decoration-1" : ""}`}>{texto}</span>
          </label>
        ))}
      </div>
      {erro && <p role="alert" className="text-[13px] text-bad">{erro}</p>}
      {concluir && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-[12.5px] text-muted-foreground">
            {gravando > 0 ? "Salvando…" : faltam > 0 ? `Marque ${faltam === 1 ? "o item que falta" : `os ${faltam} itens que faltam`} para ${textoBotao === "Autorizar" ? "autorizar" : "concluir"}.` : "Tudo certo."}
          </span>
          <Formulario
            acao={async (estado, dados) => {
              const r = await concluir(estado, dados);
              router.refresh();
              return r;
            }}
            textoBotao={textoBotao}
            desabilitado={faltam > 0 || gravando > 0}
            className="flex"
          />
        </div>
      )}
    </div>
  );
}

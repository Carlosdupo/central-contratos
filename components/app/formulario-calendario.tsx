"use client";

import { useState } from "react";
import { Input } from "@ui-sdk/react/input";
import { Button } from "@ui-sdk/react/button";
import { Formulario } from "@/components/app/formulario";
import { ciclosDoPadrao } from "@/lib/calendario";
import { formatarData } from "@/lib/datas";
import type { EstadoFormulario } from "@/lib/formulario";

type Salvo = { mes: number; ciclo: number; limite: string; inicio: string };
type Acao = (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const chave = (mes: number, ciclo: number) => `${mes}_${ciclo}`;

// Calendário do ano: dois ciclos por mês. O gerente de suprimentos preenche um mês e copia o padrão para os outros.
export function FormularioCalendario({ ano, salvos, acao, podeEditar }: { ano: number; salvos: Salvo[]; acao: Acao; podeEditar: boolean }) {
  const [valores, setValores] = useState<Record<string, { limite: string; inicio: string }>>(() =>
    Object.fromEntries(salvos.map((s) => [chave(s.mes, s.ciclo), { limite: s.limite, inicio: s.inicio }])),
  );
  const mudar = (mes: number, ciclo: number, campo: "limite" | "inicio", valor: string) =>
    setValores((v) => ({ ...v, [chave(mes, ciclo)]: { limite: v[chave(mes, ciclo)]?.limite ?? "", inicio: v[chave(mes, ciclo)]?.inicio ?? "", [campo]: valor } }));

  const copiarPadrao = () => {
    const dia = (ciclo: number) => Number((valores[chave(1, ciclo)]?.limite ?? "").slice(8, 10));
    if (!dia(1) || !dia(2)) return;
    setValores(Object.fromEntries(ciclosDoPadrao(ano, dia(1), dia(2)).map((c) => [chave(c.mes, c.ciclo), { limite: c.limite, inicio: c.inicio }])));
  };
  const padraoPronto = !!valores[chave(1, 1)]?.limite && !!valores[chave(1, 2)]?.limite;

  if (!podeEditar) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MESES.map((nome, i) => (
          <section key={nome} aria-label={nome} className="painel gap-1 text-[13px]">
            <h3 className="subtitulo">{nome}</h3>
            {[1, 2].map((ciclo) => {
              const v = valores[chave(i + 1, ciclo)];
              return <p key={ciclo}>{v ? `Ciclo ${ciclo}: pedir até ${formatarData(v.limite)}; negocia a partir de ${formatarData(v.inicio)}` : `Ciclo ${ciclo}: não definido`}</p>;
            })}
          </section>
        ))}
      </div>
    );
  }

  return (
    <Formulario acao={acao} textoBotao={`Salvar o calendário de ${ano}`} sensivel="Grava o calendário de suprimentos do ano, igual para todas as obras.">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" className="botao" disabled={!padraoPronto} onClick={copiarPadrao}>Copiar o padrão de janeiro para os outros meses</Button>
        <span className="text-[12.5px] text-muted-foreground">Preencha os dois ciclos de janeiro (limite e início) e copie: o dia de cada ciclo vale para todos os meses.</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MESES.map((nome, i) => (
          <section key={nome} aria-label={nome} className="painel gap-2">
            <h3 className="subtitulo">{nome}</h3>
            {[1, 2].map((ciclo) => (
              <div key={ciclo} className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold text-muted-foreground">Ciclo {ciclo}</span>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" name={`limite_${i + 1}_${ciclo}`} aria-label={`${nome}, ciclo ${ciclo}: a obra pode solicitar até`} className="campo" value={valores[chave(i + 1, ciclo)]?.limite ?? ""} onChange={(e) => mudar(i + 1, ciclo, "limite", e.target.value)} />
                  <Input type="date" name={`inicio_${i + 1}_${ciclo}`} aria-label={`${nome}, ciclo ${ciclo}: Suprimentos negocia a partir de`} className="campo" value={valores[chave(i + 1, ciclo)]?.inicio ?? ""} onChange={(e) => mudar(i + 1, ciclo, "inicio", e.target.value)} />
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Formulario>
  );
}

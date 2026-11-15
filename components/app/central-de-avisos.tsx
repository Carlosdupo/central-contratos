"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@ui-sdk/react/popover";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { Button } from "@ui-sdk/react/button";
import type { PacoteDeAvisos } from "@/modules/notificacoes/avisos-tipos";

type Props = {
  inicial: PacoteDeAvisos;
  carregar: () => Promise<PacoteDeAvisos>;
  marcarLidos: () => Promise<unknown>;
  salvarPreferencias: (som: boolean, email: boolean) => Promise<unknown>;
  /** Intervalo da busca de avisos novos, em milissegundos. */
  intervalo?: number;
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Som curto e próprio, gerado na hora (sem arquivo). Os navegadores só deixam tocar depois de um clique na página.
function tocarSom() {
  try {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) return;
    const ctx = new Contexto();
    const t = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, t + i * 0.14);
      ganho.gain.exponentialRampToValueAtTime(0.12, t + i * 0.14 + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.14 + 0.16);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(t + i * 0.14);
      osc.stop(t + i * 0.14 + 0.18);
    });
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    // sem som: o aviso continua escrito na tela
  }
}

// Sino do topo: contador, lista dos últimos avisos, preferências de som e e-mail. O aviso nunca depende só do som:
// aparece escrito na lista e é anunciado ao leitor de tela.
export function CentralDeAvisos({ inicial, carregar, marcarLidos, salvarPreferencias, intervalo = 60_000 }: Props) {
  const [pacote, setPacote] = useState(inicial);
  const [anuncio, setAnuncio] = useState("");
  const vistos = useRef(new Set(inicial.avisos.map((a) => a.id)));
  const clicou = useRef(false);

  useEffect(() => {
    const marcar = () => { clicou.current = true; };
    window.addEventListener("pointerdown", marcar, { once: true });
    window.addEventListener("keydown", marcar, { once: true });
    return () => {
      window.removeEventListener("pointerdown", marcar);
      window.removeEventListener("keydown", marcar);
    };
  }, []);

  const atualizar = useCallback(async () => {
    const novo = await carregar();
    const chegaram = novo.avisos.filter((a) => !a.lido && !vistos.current.has(a.id));
    novo.avisos.forEach((a) => vistos.current.add(a.id));
    setPacote(novo);
    if (chegaram.length > 0) {
      setAnuncio(chegaram.length === 1 ? `Novo aviso: ${chegaram[0].titulo}` : `${chegaram.length} avisos novos. O mais recente: ${chegaram[0].titulo}`);
      if (novo.preferencias.som && clicou.current) tocarSom();
    }
  }, [carregar]);

  useEffect(() => {
    const id = window.setInterval(() => void atualizar().catch(() => undefined), intervalo);
    return () => window.clearInterval(id);
  }, [atualizar, intervalo]);

  const lerTodos = async () => {
    await marcarLidos();
    setPacote((p) => ({ ...p, naoLidos: 0, avisos: p.avisos.map((a) => ({ ...a, lido: true })) }));
  };
  const mudarPreferencia = async (som: boolean, email: boolean) => {
    setPacote((p) => ({ ...p, preferencias: { som, email } }));
    await salvarPreferencias(som, email);
  };

  const rotulo = pacote.naoLidos > 0 ? `Avisos, ${pacote.naoLidos} ${pacote.naoLidos === 1 ? "não lido" : "não lidos"}` : "Avisos, nenhum não lido";
  return (
    <>
      <p role="status" className="sr-only">{anuncio}</p>
      <Popover>
        <PopoverTrigger className="botao relative" aria-label={rotulo}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9Z" />
            <path d="M10 20a2 2 0 0 0 4 0" />
          </svg>
          {pacote.naoLidos > 0 && (
            <span aria-hidden="true" className="ml-1 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{pacote.naoLidos > 99 ? "99+" : pacote.naoLidos}</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="central-avisos">
          <div className="flex items-center justify-between gap-3">
            <PopoverTitle className="subtitulo">Avisos</PopoverTitle>
            <Button type="button" className="botao" disabled={pacote.naoLidos === 0} onClick={() => void lerTodos()}>Marcar todos como lidos</Button>
          </div>
          {pacote.avisos.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nenhum aviso por enquanto.</p>
          ) : (
            <ul className="flex max-h-[320px] flex-col overflow-y-auto">
              {pacote.avisos.map((a) => (
                <li key={a.id} data-lido={a.lido || undefined} className="border-t-[.5px] border-sep py-2 text-[13px] first:border-t-0 data-[lido]:text-muted-foreground">
                  {a.contratacaoId ? <Link href={`/contratacoes/${a.contratacaoId}`} className="font-medium text-primary">{a.titulo}</Link> : <span className="font-medium">{a.titulo}</span>}
                  {a.texto && <span className="block">{a.texto}</span>}
                  <time dateTime={a.criadoEm} className="block text-xs text-muted-foreground">{quando(a.criadoEm)}{a.lido ? "" : " · novo"}</time>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2 border-t-[.5px] border-sep pt-3">
            <label className="flex items-center justify-between gap-3 text-[13px]">
              Tocar som quando chegar aviso
              <Switch checked={pacote.preferencias.som} onCheckedChange={(v) => void mudarPreferencia(v === true, pacote.preferencias.email)}>
                <SwitchThumb />
              </Switch>
            </label>
            <label className="flex items-center justify-between gap-3 text-[13px]">
              Receber os avisos também por e-mail
              <Switch checked={pacote.preferencias.email} onCheckedChange={(v) => void mudarPreferencia(pacote.preferencias.som, v === true)}>
                <SwitchThumb />
              </Switch>
            </label>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

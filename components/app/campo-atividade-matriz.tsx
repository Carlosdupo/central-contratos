"use client";

import { useMemo, useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxGroup, ComboboxGroupLabel, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxList } from "@ui-sdk/react/combobox";
import { DetalheAtividade } from "@/components/app/detalhe-atividade";
import { CampoTexto, Marcador } from "@/components/app/formulario";
import { formaLegalMaisRigorosa, formasDiferentes, rotuloDoEscopo } from "@/lib/escopo";
import type { AtividadeMatriz } from "@/modules/matriz/consultas";

const plural = (n: number) => `${n} ${n === 1 ? "atividade" : "atividades"}`;

// Escopo da contratação na abertura: a busca lista três níveis (grupo inteiro, subgrupo e atividade). Grupo ou subgrupo traz as
// atividades dele, todas marcadas; a obra desmarca o que não entra (pelo menos uma fica). Atividade: só ela, como antes.
// O formulário envia "matriz" (o item escolhido, ex.: "s:21.1 Elétrica") e, no pacote, uma "atividades" por atividade marcada.
export function CampoAtividadeMatriz({ atividades }: { atividades: AtividadeMatriz[] }) {
  const [chave, setChave] = useState<string | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState("");
  const [naoConsta, setNaoConsta] = useState(false);

  const { grupos, subgrupos } = useMemo(() => {
    const g = new Map<string, AtividadeMatriz[]>();
    const s = new Map<string, AtividadeMatriz[]>();
    for (const a of atividades) {
      g.set(a.grupo, [...(g.get(a.grupo) ?? []), a]);
      if (a.subgrupo) s.set(a.subgrupo, [...(s.get(a.subgrupo) ?? []), a]);
    }
    return { grupos: g, subgrupos: s };
  }, [atividades]);

  const doPacote = chave?.startsWith("g:") ? (grupos.get(chave.slice(2)) ?? []) : chave?.startsWith("s:") ? (subgrupos.get(chave.slice(2)) ?? []) : [];
  const unica = chave?.startsWith("a:") ? (atividades.find((a) => a.id === chave.slice(2)) ?? null) : null;
  const incluidas = doPacote.filter((a) => marcadas.has(a.id));

  const escolher = (nova: string | null) => {
    setChave(nova);
    setAviso("");
    const lista = nova?.startsWith("g:") ? (grupos.get(nova.slice(2)) ?? []) : nova?.startsWith("s:") ? (subgrupos.get(nova.slice(2)) ?? []) : [];
    setMarcadas(new Set(lista.map((a) => a.id)));
  };
  const alternar = (id: string, marcar: boolean) => {
    if (!marcar && marcadas.size === 1) return setAviso("Deixe pelo menos uma atividade marcada.");
    setAviso("");
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (marcar) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  };

  const marcarNaoConsta = (marcar: boolean) => {
    setNaoConsta(marcar);
    if (marcar) escolher(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {!naoConsta && <Combobox name="matriz" value={chave} onValueChange={(v: string | null) => escolher(v)}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <ComboboxLabel className="text-[13px] font-semibold">Escopo da matriz (atividade, subgrupo ou grupo)</ComboboxLabel>
          <ComboboxInput className="campo" placeholder="Digite para buscar: grupo inteiro, subgrupo ou atividade" autoComplete="off" />
          <span className="text-xs text-muted-foreground">Para contratar um pacote (ex.: toda a elétrica com uma empresa), escolha o grupo ou o subgrupo e tire o que não entra.</span>
        </div>
        <ComboboxContent>
          <ComboboxEmpty>Nada na matriz com esse nome.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              <ComboboxGroupLabel>Grupos inteiros</ComboboxGroupLabel>
              {[...grupos].map(([nome, lista]) => (
                <ComboboxItem key={`g:${nome}`} value={`g:${nome}`} label={`${nome} · ${plural(lista.length)}`} keywords={[nome]}>
                  <span className="font-medium">{nome} · {plural(lista.length)}</span>
                  <span className="text-xs text-muted-foreground">Grupo inteiro</span>
                </ComboboxItem>
              ))}
            </ComboboxGroup>
            <ComboboxGroup>
              <ComboboxGroupLabel>Subgrupos</ComboboxGroupLabel>
              {[...subgrupos].map(([nome, lista]) => (
                <ComboboxItem key={`s:${nome}`} value={`s:${nome}`} label={`${nome} · ${plural(lista.length)}`} keywords={[nome, lista[0].grupo]}>
                  <span className="font-medium">{nome} · {plural(lista.length)}</span>
                  <span className="text-xs text-muted-foreground">Subgrupo de {lista[0].grupo}</span>
                </ComboboxItem>
              ))}
            </ComboboxGroup>
            <ComboboxGroup>
              <ComboboxGroupLabel>Atividades</ComboboxGroupLabel>
              {atividades.map((a) => (
                <ComboboxItem key={`a:${a.id}`} value={`a:${a.id}`} label={a.atividade} keywords={[a.grupo, a.subgrupo ?? ""]}>
                  <span className="font-medium">{a.atividade}</span>
                  <span className="text-xs text-muted-foreground">{a.subgrupo ?? a.grupo}</span>
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>}

      <Marcador nome="nao_consta_matriz" rotulo="Não consta na matriz" marcadoAgora={naoConsta} aoMudar={marcarNaoConsta} className="flex cursor-pointer items-center gap-2 text-[13px]" />
      {naoConsta && (
        <CampoTexto nome="fora_matriz" rotulo="Atividade que não consta na matriz" dica="Descreva a atividade. Sem forma legal da matriz: Suprimentos define e avalia incluir na matriz." />
      )}

      {unica && <DetalheAtividade atividade={unica} />}

      {doPacote.length > 0 && (
        <section aria-label="Atividades do escopo" className="flex flex-col gap-2 rounded-xl bg-fill px-3.5 py-3 text-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              {rotuloDoEscopo(incluidas, atividades)}
            </p>
            <Button type="button" className="botao" disabled={incluidas.length === doPacote.length} onClick={() => setMarcadas(new Set(doPacote.map((a) => a.id)))}>Marcar todas</Button>
          </div>
          <p role="status" className="text-muted-foreground">
            {incluidas.length} de {plural(doPacote.length)} marcadas. Desmarque o que não entra na contratação.{aviso && <strong className="ml-1 text-bad">{aviso}</strong>}
          </p>
          <div className="lista-agrupada max-h-[280px] overflow-y-auto">
            {doPacote.map((a) => (
              <Marcador
                key={a.id}
                nome="atividades"
                valor={a.id}
                marcadoAgora={marcadas.has(a.id)}
                aoMudar={(marcar) => alternar(a.id, marcar)}
                rotulo={<>{a.atividade} <span className="text-xs text-muted-foreground">· {a.formaLegal}</span></>}
              />
            ))}
          </div>
          <ResumoFormaLegal formas={incluidas.map((a) => a.formaLegal)} />
        </section>
      )}
    </div>
  );
}

// "Forma legal: X (a mais rigorosa entre as atividades marcadas)"; se as marcadas têm formas diferentes, diz quais.
export function ResumoFormaLegal({ formas }: { formas: string[] }) {
  const forma = formaLegalMaisRigorosa(formas);
  if (!forma) return null;
  const diferentes = formasDiferentes(formas);
  return (
    <div className="flex flex-col gap-0.5 border-t-[.5px] border-sep pt-2">
      <p>
        <strong>Forma legal: {forma}</strong> <span className="text-muted-foreground">(a mais rigorosa entre as atividades marcadas)</span>
      </p>
      {diferentes.length > 1 && (
        <p className="text-muted-foreground">
          As atividades marcadas têm formas diferentes: {diferentes.map((f) => `${f} (${formas.filter((x) => x === f).length})`).join(", ")}.
        </p>
      )}
    </div>
  );
}

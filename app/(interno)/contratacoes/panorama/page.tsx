import type { Metadata } from "next";
import Link from "next/link";
import { exigirInterno } from "@/modules/acesso/sessao";
import { COLUNAS_PANORAMA, panoramaDasContratacoes, type CelulaPanorama, type LinhaPanorama } from "@/modules/contratacoes/consultas";
import { formatarReais } from "@/modules/contratacoes/rotulos";
import { formatarData } from "@/lib/datas";

export const metadata: Metadata = { title: "Panorama das obras" };

const FILTROS = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "andamento", rotulo: "Em andamento" },
  { chave: "atrasadas", rotulo: "Com atraso" },
  { chave: "liberadas", rotulo: "Liberadas" },
  { chave: "canceladas", rotulo: "Canceladas" },
] as const;

const filtra = (f: string) => (l: LinhaPanorama) =>
  f === "andamento" ? l.situacao === "em_andamento"
  : f === "atrasadas" ? l.situacao === "em_andamento" && l.atrasada
  : f === "liberadas" ? l.situacao === "liberada"
  : f === "canceladas" ? l.situacao === "cancelada"
  : true;

const IconeOk = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 3 3 5-6" />
  </svg>
);
const Traco = () => <i className="my-2.5 inline-block h-0.5 w-3.5 rounded bg-sep-strong opacity-60" aria-hidden="true" />;

function Celula({ c, cancelada }: { c: CelulaPanorama; cancelada: boolean }) {
  if (c.tipo === "ok")
    return (
      <span className="inline-flex flex-col items-center gap-0.5 text-[11px] font-medium text-ok tabular-nums">
        <IconeOk />
        <span><span className="sr-only">Liberado em </span>{formatarData(c.data).slice(0, 5)}</span>
      </span>
    );
  if (c.tipo === "na") return <span className="text-[12px] font-medium text-muted-foreground">N/A<span className="sr-only">: não se aplica</span></span>;
  if (c.tipo === "pendente") return cancelada ? <span className="sr-only">Cancelada</span> : <span><Traco /><span className="sr-only">Ainda não chegou</span></span>;
  const atrasada = c.prazo.tipo === "atrasada";
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span className="rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-semibold text-primary-foreground">
        <span className="sr-only">Está com esta área: </span>Agora
      </span>
      <span className="sr-only">Etapa: {c.etapa}.</span>
      {atrasada && <span className="text-[11px] font-semibold text-bad">Atrasada {-(c.prazo as { restantes: number }).restantes} d</span>}
      {(c.prazo.tipo === "vence_hoje" || c.prazo.tipo === "vence_amanha") && <span className="text-[11px] font-semibold text-hot">{c.prazo.tipo === "vence_hoje" ? "Vence hoje" : "Vence amanhã"}</span>}
    </span>
  );
}

function Status({ l }: { l: LinhaPanorama }) {
  if (l.situacao === "liberada") return <span className="selo selo-ok">Liberada</span>;
  if (l.situacao === "cancelada") return <span className="selo selo-neutro">Cancelada</span>;
  if (l.atrasada) return <span className="selo selo-erro">Com atraso</span>;
  return <span className="selo selo-info">Em andamento</span>;
}

export default async function PaginaPanorama({ searchParams }: PageProps<"/contratacoes/panorama">) {
  await exigirInterno();
  const { obra: obraParam, filtro: filtroParam } = await searchParams;
  const todas = await panoramaDasContratacoes();
  const obras = [...new Map(todas.map((l) => [l.obraId, l.obra])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const obraId = typeof obraParam === "string" && obras.some(([id]) => id === obraParam) ? obraParam : obras.length === 1 ? obras[0][0] : "";
  const filtro = typeof filtroParam === "string" && FILTROS.some((f) => f.chave === filtroParam) ? filtroParam : "todas";
  const daObra = todas.filter((l) => !obraId || l.obraId === obraId);
  const linhas = daObra.filter(filtra(filtro));
  const contar = (f: string) => daObra.filter(filtra(f)).length;
  const link = (o: string, f: string) => `/contratacoes/panorama?${new URLSearchParams({ ...(o ? { obra: o } : {}), ...(f !== "todas" ? { filtro: f } : {}) })}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Panorama das obras</h1>
          <p className="mt-1.5 max-w-[70ch] text-[15px] text-muted-foreground">
            Cada linha é uma contratação. Cada coluna mostra a data em que a área liberou, ou se ainda está com ela.
          </p>
        </div>
        <Link href="/contratacoes" className="botao">Ver como lista de contratações</Link>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por obra">
          {obras.length > 1 && (
            <Link href={link("", filtro)} aria-current={!obraId ? "true" : undefined} className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] font-medium ${!obraId ? "border-primary bg-primary text-primary-foreground" : "border-sep-strong bg-card hover:bg-fill"}`}>Todas as obras</Link>
          )}
          {obras.map(([id, nome]) => (
            <Link key={id} href={link(id, filtro)} aria-current={obraId === id ? "true" : undefined} className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] font-medium ${obraId === id ? "border-primary bg-primary text-primary-foreground" : "border-sep-strong bg-card hover:bg-fill"}`}>{nome}</Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
          {FILTROS.map((f) => (
            <Link key={f.chave} href={link(obraId, f.chave)} aria-current={filtro === f.chave ? "true" : undefined} className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] font-medium ${filtro === f.chave ? "border-foreground bg-foreground text-background" : "border-sep-strong bg-card hover:bg-fill"}`}>
              {f.rotulo} <span className="ml-1 tabular-nums opacity-75">{contar(f.chave)}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground" aria-label="Legenda">
        <span className="inline-flex items-center gap-1.5 text-ok"><IconeOk /><span className="text-muted-foreground">Área liberou, com a data</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-semibold text-primary-foreground">Agora</span>Está com esta área</span>
        <span className="inline-flex items-center gap-1.5"><Traco />Ainda não chegou</span>
        <span className="inline-flex items-center gap-1.5"><span className="font-medium">N/A</span>Não se aplica</span>
      </div>

      <section className="painel overflow-hidden p-0">
        {linhas.length === 0 ? (
          <p className="px-[18px] py-4 text-[14px] text-muted-foreground">Nenhuma contratação neste filtro. Escolha outra obra ou situação acima.</p>
        ) : (
          <div className="overflow-x-auto focus-visible:outline-offset-[-2px]" tabIndex={0} role="region" aria-label="Tabela do panorama. Role para o lado para ver todas as áreas.">
            <table className="tabela min-w-[1180px] border-separate border-spacing-0">
              <caption className="sr-only">Situação de cada contratação por área</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-[260px] min-w-[260px] bg-card pt-3.5 pl-[18px]">Contratação</th>
                  {!obraId && <th scope="col" className="pt-3.5">Obra</th>}
                  <th scope="col" className="pt-3.5">Com quem está</th>
                  {COLUNAS_PANORAMA.map((c) => <th scope="col" key={c.chave} className="pt-3.5 text-center">{c.titulo}</th>)}
                  <th scope="col" className="pt-3.5">Contrato Sienge</th>
                  <th scope="col" className="pt-3.5">Fornecedor e valor contratado</th>
                  <th scope="col" className="pt-3.5 pr-[18px]">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className={l.situacao === "cancelada" ? "opacity-55" : ""}>
                    <th scope="row" className="sticky left-0 z-10 w-[260px] max-w-[260px] min-w-[260px] border-b border-sep bg-card py-3 pr-3 pl-[18px] text-left align-top text-[14px] font-normal tracking-normal text-foreground normal-case">
                      <Link href={`/contratacoes/${l.id}`} className="line-clamp-2 font-semibold whitespace-normal hover:text-primary">{l.servico}</Link>
                      <span className="block text-[12px] whitespace-normal text-muted-foreground">
                        <span className="font-mono">{l.codigo}</span>{l.siengeSolicitacao ? ` · SS ${l.siengeSolicitacao}` : ""} · aberta {formatarData(l.abertaEm).slice(0, 5)}
                      </span>
                    </th>
                    {!obraId && <td className="text-[13px]">{l.obra}</td>}
                    <td className="text-[13px]">{l.situacao === "em_andamento" ? l.comQuem.join(", ") || "—" : "—"}</td>
                    {l.celulas.map((c, i) => <td key={i} className="text-center align-middle"><Celula c={c} cancelada={l.situacao === "cancelada"} /></td>)}
                    <td className="font-mono text-[12.5px]">{l.siengeContrato ?? "—"}</td>
                    <td className="text-[13px]">
                      {l.fornecedor ?? <span className="text-faint">a definir</span>}
                      {l.valorFinal != null && <div className="text-[12px] text-muted-foreground">Contratado: {formatarReais(l.valorFinal)}</div>}
                    </td>
                    <td className="pr-[18px]"><Status l={l} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

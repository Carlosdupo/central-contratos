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

function Celula({ c, cancelada }: { c: CelulaPanorama; cancelada: boolean }) {
  if (c.tipo === "ok") return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ok-soft px-2 py-0.5 text-[12px] font-semibold text-ok">✓ {formatarData(c.data).slice(0, 5)}</span>;
  if (c.tipo === "na") return <span className="text-[12px] font-medium text-faint">N/A</span>;
  if (c.tipo === "pendente") return <span className="text-[12px] text-faint">{cancelada ? "" : "—"}</span>;
  const atrasada = c.prazo.tipo === "atrasada";
  const alerta = c.prazo.tipo === "vence_hoje" || c.prazo.tipo === "vence_amanha";
  return (
    <span title={c.etapa} className={`inline-flex flex-col whitespace-nowrap rounded-lg px-2 py-0.5 text-[12px] font-semibold ${atrasada ? "bg-bad-soft text-bad" : alerta ? "bg-warn-soft text-warn" : "bg-primary-soft text-primary"}`}>
      {atrasada ? `Atrasada ${-(c.prazo as { restantes: number }).restantes}d` : alerta ? "Vence já" : "Em andamento"}
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
            Todas as solicitações de cada obra e em que área cada uma está. Cada coluna mostra a data em que a área liberou, ou se ainda está com ela.
          </p>
        </div>
        <Link href="/contratacoes" className="text-[14px] text-primary">Ver lista de contratações</Link>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {obras.length > 1 && (
            <Link href={link("", filtro)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${!obraId ? "bg-primary text-primary-foreground" : "bg-card hover:bg-fill-2"}`}>Todas as obras</Link>
          )}
          {obras.map(([id, nome]) => (
            <Link key={id} href={link(id, filtro)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${obraId === id ? "bg-primary text-primary-foreground" : "bg-card hover:bg-fill-2"}`}>{nome}</Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <Link key={f.chave} href={link(obraId, f.chave)} className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${filtro === f.chave ? "bg-foreground text-background" : "bg-fill-2 text-muted-foreground hover:text-foreground"}`}>
              {f.rotulo} <span className="tabular-nums opacity-70">{contar(f.chave)}</span>
            </Link>
          ))}
        </div>
      </div>

      <section className="painel p-0 py-2">
        {linhas.length === 0 ? (
          <p className="px-5 py-3 text-[14px] text-muted-foreground">Nenhuma contratação neste filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela min-w-[1180px]">
              <thead>
                <tr>
                  <th className="pl-5">Solicitação</th>
                  {!obraId && <th>Obra</th>}
                  <th>Com quem está</th>
                  {COLUNAS_PANORAMA.map((c) => <th key={c.chave} className="text-center">{c.titulo}</th>)}
                  <th>Contrato Sienge</th>
                  <th>Fornecedor</th>
                  <th className="pr-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className={l.situacao === "cancelada" ? "opacity-55" : ""}>
                    <td className="max-w-[280px] pl-5">
                      <Link href={`/contratacoes/${l.id}`} className="font-medium text-primary">{l.servico}</Link>
                      <div className="text-[12px] text-muted-foreground">
                        <span className="font-mono">{l.codigo}</span>{l.siengeSolicitacao ? ` · SS ${l.siengeSolicitacao}` : ""} · aberta {formatarData(l.abertaEm).slice(0, 5)}
                      </div>
                      {l.pacote && <div className="truncate text-[12px] text-faint">{l.pacote}</div>}
                    </td>
                    {!obraId && <td className="text-[13px]">{l.obra}</td>}
                    <td className="text-[13px]">{l.situacao === "em_andamento" ? l.comQuem.join(", ") || "—" : "—"}</td>
                    {l.celulas.map((c, i) => <td key={i} className="text-center"><Celula c={c} cancelada={l.situacao === "cancelada"} /></td>)}
                    <td className="font-mono text-[12.5px]">{l.siengeContrato ?? "—"}</td>
                    <td className="text-[13px]">
                      {l.fornecedor ?? <span className="text-faint">a definir</span>}
                      {l.valorFinal != null && <div className="text-[12px] text-muted-foreground">{formatarReais(l.valorFinal)}</div>}
                    </td>
                    <td className="pr-5"><Status l={l} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-[12.5px] text-faint">✓ data = área liberou · N/A = etapa não se aplica · — = ainda não chegou na área. Passe o mouse sobre &ldquo;Em andamento&rdquo; para ver a etapa.</p>
    </>
  );
}

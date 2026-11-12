import type { Metadata } from "next";
import Link from "next/link";
import { exigirInterno } from "@/modules/acesso/sessao";
import { carregarFluxo, etapasEmAberto } from "@/modules/contratacoes/consultas";
import { TIPO_CONTRATACAO, formatarReais } from "@/modules/contratacoes/rotulos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { SeloPrazo } from "@/components/app/selo-prazo";

export const metadata: Metadata = { title: "Contratações" };

const SITUACAO: Record<string, [string, string]> = {
  em_andamento: ["selo-info", "Em andamento"],
  liberada: ["selo-ok", "Liberada para a obra"],
  cancelada: ["selo-neutro", "Cancelada"],
};
const URGENCIA: Record<string, number> = { atrasada: 0, vence_hoje: 1, vence_amanha: 2, no_prazo: 3, sem_prazo: 4 };
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim().slice(0, 80) : "");

export default async function PaginaContratacoes({ searchParams }: PageProps<"/contratacoes">) {
  const usuario = await exigirInterno();
  const filtros = await searchParams;
  const busca = texto(filtros.q);
  const obraFiltro = texto(filtros.obra);
  const etapaFiltro = Number(texto(filtros.etapa)) || 0;
  const ordem = texto(filtros.ordem) === "prazo" ? "prazo" : "recentes";

  const supabase = await criarClienteServidor();
  const [{ data: contratacoes }, { data: etapas }, abertas, fluxo] = await Promise.all([
    supabase.from("contratacoes").select("id, codigo, servico, tipo, situacao, valor_orcado, valor_negociado, fornecedor_nome, obra_id, obras(nome)").order("created_at", { ascending: false }),
    supabase.from("contratacao_etapas").select("contratacao_id, situacao"),
    etapasEmAberto(),
    carregarFluxo(),
  ]);
  const feitas = (id: string) => (etapas ?? []).filter((e) => e.contratacao_id === id && (e.situacao === "concluida" || e.situacao === "pulada")).length;
  const atuaisDe = (id: string) => abertas.filter((a) => a.contratacaoId === id).sort((a, b) => URGENCIA[a.prazo.tipo] - URGENCIA[b.prazo.tipo]);

  const todas = contratacoes ?? [];
  const obras = [...new Map(todas.map((c) => [c.obra_id, c.obras?.nome ?? "—"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const termo = semAcento(busca);
  const lista = todas
    .filter((c) => !termo || semAcento(`${c.servico} ${c.codigo} ${c.fornecedor_nome ?? ""} ${c.obras?.nome ?? ""}`).includes(termo))
    .filter((c) => !obraFiltro || c.obra_id === obraFiltro)
    .filter((c) => !etapaFiltro || atuaisDe(c.id).some((a) => a.etapa.etapa === etapaFiltro))
    .sort((a, b) => {
      if (ordem !== "prazo") return 0;
      const pa = atuaisDe(a.id)[0];
      const pb = atuaisDe(b.id)[0];
      return (pa ? URGENCIA[pa.prazo.tipo] : 9) - (pb ? URGENCIA[pb.prazo.tipo] : 9) || (pb?.prazo.usados ?? 0) - (pa?.prazo.usados ?? 0);
    });
  const filtrando = !!(busca || obraFiltro || etapaFiltro || ordem === "prazo");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Contratações</h1>
          <p className="mt-1 max-w-[66ch] text-muted-foreground">Da solicitação da obra até a liberação da equipe.</p>
        </div>
        <span className="flex flex-wrap gap-2">
          <Link href="/contratacoes/panorama" className="botao">Ver panorama das obras</Link>
          {usuario.papeis.includes("coordenador_obra") && <Link href="/contratacoes/nova" className="botao botao-primario">Nova contratação</Link>}
        </span>
      </div>

      <form method="get" role="search" aria-label="Buscar e filtrar contratações" className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Buscar</span>
          <input name="q" type="search" defaultValue={busca} placeholder="Serviço, código, fornecedor ou obra" className="campo" />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Obra</span>
          <select name="obra" defaultValue={obraFiltro} className="campo">
            <option value="">Todas as obras</option>
            {obras.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Etapa atual</span>
          <select name="etapa" defaultValue={etapaFiltro || ""} className="campo">
            <option value="">Todas as etapas</option>
            {fluxo.map((f) => <option key={f.etapa} value={f.etapa}>{f.etapa}. {f.nome}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Ordenar</span>
          <select name="ordem" defaultValue={ordem} className="campo">
            <option value="recentes">Mais recentes</option>
            <option value="prazo">Prazo mais urgente</option>
          </select>
        </label>
        <span className="flex gap-2">
          <button type="submit" className="botao botao-primario">Aplicar filtros</button>
          {filtrando && <Link href="/contratacoes" className="botao">Limpar</Link>}
        </span>
      </form>
      <p role="status" aria-live="polite" className="-mt-2 text-[13px] text-muted-foreground">
        {lista.length === 1 ? "1 contratação" : `${lista.length} contratações`}{filtrando ? " encontradas com estes filtros" : ""}.
      </p>

      <section className="painel overflow-hidden p-0">
        {lista.length === 0 ? (
          <p className="px-[18px] py-4 text-[14px] text-muted-foreground">
            {todas.length === 0 ? "Nenhuma contratação ainda. O coordenador da obra abre a contratação em “Nova contratação”." : "Nenhuma contratação com estes filtros. Limpe a busca ou escolha outra obra ou etapa."}
          </p>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Lista de contratações. Role para o lado para ver todas as colunas.">
            <table className="tabela min-w-[980px]">
              <caption className="sr-only">Contratações, com etapa atual, progresso e prazo</caption>
              <thead>
                <tr>
                  <th scope="col" className="pt-3.5 pl-[18px]">Contratação</th>
                  <th scope="col" className="pt-3.5">Obra</th>
                  <th scope="col" className="pt-3.5">Fornecedor</th>
                  <th scope="col" className="pt-3.5">Valores</th>
                  <th scope="col" className="pt-3.5">Etapa atual</th>
                  <th scope="col" className="pt-3.5">Progresso</th>
                  <th scope="col" className="pt-3.5 pr-[18px]">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const atuais = atuaisDe(c.id);
                  const [classe, rotulo] = SITUACAO[c.situacao];
                  const n = feitas(c.id);
                  return (
                    <tr key={c.id}>
                      <td className="max-w-[300px] pl-[18px]">
                        <Link href={`/contratacoes/${c.id}`} className="line-clamp-2 font-semibold hover:text-primary" title={c.servico}>{c.servico}</Link>
                        <div className="text-[12.5px] text-muted-foreground"><span className="font-mono">{c.codigo}</span> · {TIPO_CONTRATACAO[c.tipo]}</div>
                      </td>
                      <td className="text-[13px]">{c.obras?.nome}</td>
                      <td className="text-[13px]">{c.fornecedor_nome ?? <span className="text-muted-foreground">a definir</span>}</td>
                      <td className="text-[13px] whitespace-nowrap">
                        <div><span className="text-muted-foreground">Orçado: </span>{c.valor_orcado == null ? "não informado" : formatarReais(Number(c.valor_orcado))}</div>
                        <div><span className="text-muted-foreground">Contratado: </span>{c.valor_negociado == null ? "a definir" : formatarReais(Number(c.valor_negociado))}</div>
                      </td>
                      <td className="text-[13px]">{c.situacao === "em_andamento" ? atuais.map((a) => <div key={a.etapa.etapa}>{a.etapa.etapa}. {a.etapa.nome}</div>) : <span className={`selo ${classe}`}>{rotulo}</span>}</td>
                      <td>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-fill-2" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${(n / 12) * 100}%` }} /></div>
                        <div className="mt-1 text-xs text-muted-foreground tabular-nums">{n} de 12 etapas</div>
                      </td>
                      <td className="pr-[18px]">{atuais[0] && <SeloPrazo prazo={atuais[0].prazo} uteis={atuais[0].uteis} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

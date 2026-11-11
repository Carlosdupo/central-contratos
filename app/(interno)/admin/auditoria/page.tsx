import type { Metadata } from "next";
import Link from "next/link";
import { exigirPapel } from "@/modules/acesso/sessao";
import { camposAlterados, formatarValor } from "@/modules/admin/auditoria";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Auditoria" };

const TABELAS: Record<string, string> = {
  usuarios: "Usuários",
  usuario_papeis: "Perfis",
  obras: "Obras",
  usuario_obras: "Obras do coordenador",
  parametros: "Parâmetros",
  feriados: "Feriados",
};
const ACOES: Record<string, [string, string]> = {
  INSERT: ["selo-ok", "Inclusão"],
  UPDATE: ["selo-info", "Alteração"],
  DELETE: ["selo-erro", "Exclusão"],
};
const LIMITE = 100;

const dataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

type Registro = Record<string, unknown> | null;

export default async function PaginaAuditoria({ searchParams }: PageProps<"/admin/auditoria">) {
  await exigirPapel("admin");
  const { tabela } = await searchParams;
  const filtro = typeof tabela === "string" && tabela in TABELAS ? tabela : null;

  const supabase = await criarClienteServidor();
  let consulta = supabase.from("auditoria").select("id, em, ator, acao, tabela, registro_id, antes, depois").order("em", { ascending: false }).limit(LIMITE);
  if (filtro) consulta = consulta.eq("tabela", filtro);
  const [{ data: registros }, { data: usuarios }] = await Promise.all([consulta, supabase.from("usuarios").select("id, nome")]);
  const nomes = new Map((usuarios ?? []).map((u) => [u.id, u.nome]));

  return (
    <section className="painel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="subtitulo">Últimas {LIMITE} alterações</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Registro automático feito pelo banco. Ninguém consegue alterar ou apagar.</p>
        </div>
        <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar por assunto">
          <Link href="/admin/auditoria" className={`rounded-full px-3 py-1 text-[13px] ${!filtro ? "bg-primary text-primary-foreground" : "bg-fill-2"}`}>Tudo</Link>
          {Object.entries(TABELAS).map(([t, rotulo]) => (
            <Link key={t} href={`/admin/auditoria?tabela=${t}`} className={`rounded-full px-3 py-1 text-[13px] ${filtro === t ? "bg-primary text-primary-foreground" : "bg-fill-2"}`}>{rotulo}</Link>
          ))}
        </nav>
      </div>
      <div className="lista-agrupada">
        {(registros ?? []).map((r) => {
          const [classe, rotulo] = ACOES[r.acao] ?? ["selo-neutro", r.acao];
          const alteracoes = camposAlterados(r.antes as Registro, r.depois as Registro);
          return (
            <details key={r.id} className="group px-3.5 py-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`selo ${classe}`}>{rotulo}</span>
                <span className="font-medium">{TABELAS[r.tabela] ?? r.tabela}</span>
                <span className="text-[13px] text-muted-foreground">{r.ator ? nomes.get(r.ator) ?? "Usuário" : "Sistema"}</span>
                <span className="ml-auto font-mono text-xs text-faint">{dataHora.format(new Date(r.em))}</span>
              </summary>
              <dl className="mt-2.5 grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px]">
                {alteracoes.map((a) => (
                  <div key={a.campo} className="contents">
                    <dt className="font-mono text-muted-foreground">{a.campo}</dt>
                    <dd className="min-w-0 break-words">
                      {r.acao === "UPDATE" ? <><span className="text-faint line-through">{formatarValor(a.de)}</span> → {formatarValor(a.para)}</> : formatarValor(r.acao === "DELETE" ? a.de : a.para)}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          );
        })}
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { exigirInterno } from "@/modules/acesso/sessao";
import { etapasEmAberto } from "@/modules/contratacoes/consultas";
import { TIPO_CONTRATACAO, formatarReais } from "@/modules/contratacoes/rotulos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { SeloPrazo } from "@/components/app/selo-prazo";

export const metadata: Metadata = { title: "Contratações" };

const SITUACAO: Record<string, [string, string]> = {
  em_andamento: ["selo-info", "Em andamento"],
  liberada: ["selo-ok", "Liberada para a obra"],
  cancelada: ["selo-neutro", "Cancelada"],
};

export default async function PaginaContratacoes() {
  const usuario = await exigirInterno();
  const supabase = await criarClienteServidor();
  const [{ data: contratacoes }, { data: etapas }, abertas] = await Promise.all([
    supabase.from("contratacoes").select("id, codigo, servico, tipo, situacao, valor_orcado, fornecedor_nome, obras(nome)").order("created_at", { ascending: false }),
    supabase.from("contratacao_etapas").select("contratacao_id, situacao"),
    etapasEmAberto(),
  ]);
  const feitas = (id: string) => (etapas ?? []).filter((e) => e.contratacao_id === id && (e.situacao === "concluida" || e.situacao === "pulada")).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Contratações</h1>
          <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">Da solicitação da obra até a liberação da equipe.</p>
        </div>
        {usuario.papeis.includes("coordenador_obra") && <Link href="/contratacoes/nova" className="botao botao-primario">+ Nova contratação</Link>}
      </div>
      <section className="painel">
        {(contratacoes ?? []).length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Nenhuma contratação ainda.</p>
        ) : (
          <div className="-mx-1.5 overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Contratação</th><th>Obra</th><th>Fornecedor</th><th>Etapa atual</th><th>Progresso</th><th>Prazo</th></tr></thead>
              <tbody>
                {(contratacoes ?? []).map((c) => {
                  const atuais = abertas.filter((a) => a.contratacaoId === c.id);
                  const [classe, rotulo] = SITUACAO[c.situacao];
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/contratacoes/${c.id}`} className="font-medium text-primary">{c.servico}</Link>
                        <div className="text-[12.5px] text-muted-foreground"><span className="font-mono">{c.codigo}</span> · {TIPO_CONTRATACAO[c.tipo]} · {formatarReais(c.valor_orcado)}</div>
                      </td>
                      <td className="text-[13px]">{c.obras?.nome}</td>
                      <td className="text-[13px]">{c.fornecedor_nome ?? <span className="text-faint">a definir</span>}</td>
                      <td className="text-[13px]">{c.situacao === "em_andamento" ? atuais.map((a) => <div key={a.etapa.etapa}>{a.etapa.nome}</div>) : <span className={`selo ${classe}`}>{rotulo}</span>}</td>
                      <td>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-fill-2"><div className="h-full rounded-full bg-primary" style={{ width: `${(feitas(c.id) / 12) * 100}%` }} /></div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">{feitas(c.id)}/12</div>
                      </td>
                      <td>{atuais[0] && <SeloPrazo prazo={atuais[0].prazo} uteis={atuais[0].uteis} />}</td>
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
